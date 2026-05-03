import mongoose from 'mongoose';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { PayoutRequest } from '../models/PayoutRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import { AppError } from '../utils/errors';
import { PayoutRequestStatus } from '@shared/types';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';
import { round } from '../utils/math';
import { NotificationService } from './notificationService';
import { NotificationType } from '../models/Notification';

export class WalletService {
  private static readonly COMMISSION_RATE = parseFloat(process.env.VELTO_COMMISSION_RATE || '0.10');
  private static readonly SELLER_COMMISSION_RATE = parseFloat(process.env.VELTO_SELLER_COMMISSION_RATE || '0.05');
  private static readonly RIDER_CANCEL_COMPENSATION = 15; // ₹15 for effort
  private static readonly MIN_PAYOUT_AMOUNT = 500;

  static async creditEarnings(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) {
        throw new AppError('Order or rider not found', 404);
      }

      if ((order.deliveryCharge || 0) <= 0) {
        await session.commitTransaction();
        return;
      }

      // Check if already credited
      const existingTx = await WalletTransaction.findOne({ orderId, user: order.rider, type: 'credit' }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        return;
      }

      const deliveryCharge = order.deliveryCharge || 0;
      const commission = round(deliveryCharge * this.COMMISSION_RATE);
      const earnings = round(deliveryCharge - commission);

      const rider = await User.findById(order.rider).session(session);
      if (!rider) throw new AppError('Rider not found', 404);

      // 🚨 AUTOMATED OFFSETTING LOGIC 🚨
      let finalCredit = earnings;
      let offsetReduction = 0;
      
      if ((rider.cashInHand || 0) > 0) {
        offsetReduction = Math.min(earnings, rider.cashInHand || 0);
        finalCredit = earnings - offsetReduction;
        
        await User.findByIdAndUpdate(
          order.rider,
          { $inc: { cashInHand: -offsetReduction } },
          { session }
        );

        // 🚨 Record Offset Transaction 🚨
        await WalletTransaction.create([{
          user: order.rider,
          amount: offsetReduction,
          type: 'debit',
          description: `Liability Offset: Settled COD cash against earnings for order #${orderId.toString().slice(-6).toUpperCase()}`,
          orderId: order._id
        }], { session });
      }

      // Update Rider Balance with remaining earnings
      const updatedRider = await User.findByIdAndUpdate(
        order.rider,
        { $inc: { walletBalance: finalCredit } },
        { session, new: true, select: 'walletBalance cashInHand' }
      );

      // Create Transaction Record
      await WalletTransaction.create([{
        user: order.rider,
        amount: earnings, // Record full earnings
        type: 'credit',
        description: offsetReduction > 0 
          ? `Earnings (Liability Offset: ₹${offsetReduction}) for order #${orderId.toString().slice(-6).toUpperCase()}`
          : `Earnings for delivering order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      // 🚨 RECORD SYSTEM REVENUE (COMMISSION) 🚨
      await WalletTransaction.create([{
        user: new mongoose.Types.ObjectId("000000000000000000000000"), // Virtual System ID
        amount: commission,
        type: 'credit',
        description: `Platform Commission: Rider Service Fee for order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();
      
      // Real-time Push
      if (updatedRider) {
        io.to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { 
          balance: updatedRider.walletBalance || 0,
          cashInHand: updatedRider.cashInHand || 0
        });
      }

      console.log(`[WALLET] Processed ₹${earnings} for rider ${order.rider}. Credit: ₹${finalCredit}, Offset: ₹${offsetReduction}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] Credit failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async creditSellerEarnings(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Order not found', 404);

      // Check if already credited
      const existingTx = await WalletTransaction.findOne({ orderId, user: order.seller, type: 'credit' }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        return;
      }

      const itemTotal = order.totalPrice - (order.deliveryCharge || 0);
      const commission = round(itemTotal * this.SELLER_COMMISSION_RATE);
      const earnings = round(itemTotal - commission);

      // Update Seller Balance
      const updatedSeller = await User.findByIdAndUpdate(
        order.seller,
        { $inc: { walletBalance: earnings } },
        { session, new: true, select: 'walletBalance' }
      );

      // Create Transaction Record
      await WalletTransaction.create([{
        user: order.seller,
        amount: earnings,
        type: 'credit',
        description: `Product Sale: Order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      // 🚨 RECORD SYSTEM REVENUE (COMMISSION) 🚨
      await WalletTransaction.create([{
        user: new mongoose.Types.ObjectId("000000000000000000000000"), // Virtual System ID
        amount: commission,
        type: 'credit',
        description: `Platform Commission: Seller Service Fee for order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      if (updatedSeller) {
        io.to(order.seller.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedSeller.walletBalance || 0 });
      }

      console.log(`[WALLET] Credited Seller ₹${earnings} (after ${this.SELLER_COMMISSION_RATE * 100}% comm) to ${order.seller}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] Seller Credit failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async processCODFulfillment(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) throw new AppError('Order or rider not found', 404);
      if (order.paymentMethod !== 'Cash on Delivery') {
         await session.commitTransaction();
         return;
      }

      // 1. Increment Rider Liability
      const updatedRider = await User.findByIdAndUpdate(
        order.rider,
        { $inc: { cashInHand: order.totalPrice } },
        { session, new: true, select: 'walletBalance cashInHand' }
      );

      // 🚨 Record COD Collection Liability 🚨
      await WalletTransaction.create([{
        user: order.rider,
        amount: order.totalPrice,
        type: 'debit',
        description: `COD Cash Collected: Order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      if (updatedRider) {
        io.to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { 
          balance: updatedRider.walletBalance || 0,
          cashInHand: updatedRider.cashInHand || 0
        });
      }

      console.log(`[WALLET] COD Fulfilled. Rider ${order.rider} Liability +₹${order.totalPrice}`);
    } catch (error) {
       if (session.inTransaction()) await session.abortTransaction();
       console.error('[WALLET] COD Processing failed:', error);
       throw error;
    } finally {
       session.endSession();
    }
  }

  static async compensateRiderForCancellation(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) {
        await session.commitTransaction();
        return;
      }

      // Check if already compensated
      const existing = await WalletTransaction.findOne({ 
        orderId, 
        user: order.rider, 
        description: /Effort Fee/ 
      }).session(session);

      if (existing) {
        await session.commitTransaction();
        return;
      }

      await User.findByIdAndUpdate(
        order.rider,
        { $inc: { walletBalance: this.RIDER_CANCEL_COMPENSATION } },
        { session }
      );

      await WalletTransaction.create([{
        user: order.rider,
        amount: this.RIDER_CANCEL_COMPENSATION,
        type: 'credit',
        description: `Cancellation Effort Fee: Order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      // 🚨 PLATFORM ABSORBS COST: Debit from System Revenue 🚨
      await WalletTransaction.create([{
        user: new mongoose.Types.ObjectId("000000000000000000000000"), // Virtual System ID
        amount: this.RIDER_CANCEL_COMPENSATION,
        type: 'debit',
        description: `Cancellation Liability: System-funded Rider Effort Fee for order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();
      
      io.to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, {});
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] Compensation failed:', error);
    } finally {
      session.endSession();
    }
  }

  static async requestPayout(userId: string, data: any) {
    let { amount, bankDetails } = data;

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // If bankDetails missing in request, fallback to saved profile details
    if (!bankDetails || !bankDetails.accountNumber) {
      if (user.bankDetails && user.bankDetails.accountNumber) {
        bankDetails = user.bankDetails;
      } else {
        throw new AppError('Bank details required for payout', 400);
      }
    }

    if (amount < this.MIN_PAYOUT_AMOUNT) {
      throw new AppError(`Minimum payout amount is ₹${this.MIN_PAYOUT_AMOUNT}`, 400);
    }

    const currentBalance = user.walletBalance || 0;
    if (currentBalance < amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Deduct from balance immediately
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { $inc: { walletBalance: -amount } }, 
        { session, new: true, select: 'walletBalance' }
      );

      // 2. Create Payout Request
      const request = await PayoutRequest.create([{
        rider: userId,
        amount,
        bankDetails,
        status: PayoutRequestStatus.PENDING
      }], { session });

      // 3. Create Debit Transaction
      await WalletTransaction.create([{
        user: userId,
        amount,
        type: 'debit',
        description: 'Payout request initiated',
        payoutId: request[0]._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      if (updatedUser) {
        io.to(userId).emit(SocketEvent.WALLET_UPDATED, { balance: updatedUser.walletBalance || 0 });
      }

      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const admin of admins) {
        await NotificationService.send({
          recipient: admin._id.toString(),
          type: NotificationType.PAYOUT,
          title: 'New Payout Request',
          message: `${user.name} requested a payout of ₹${amount}`,
          relatedId: request[0]._id.toString(),
        });
      }

      return request[0];
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async refundToWallet(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Order not found', 404);

      if ((order.status as string) === 'pending' || (order.status as string) === 'cancelled') {
        await session.commitTransaction();
        return;
      }

      const existingRefund = await WalletTransaction.findOne({ orderId, user: order.buyer, type: 'credit', description: /Refund/ }).session(session);
      if (existingRefund) {
        await session.commitTransaction();
        return;
      }

      const refundAmount = order.paymentMethod === 'Razorpay' 
        ? order.totalPrice 
        : (order.walletAmountPaid || 0);

      if (refundAmount <= 0) {
        await session.commitTransaction();
        return;
      }

      const dest = (order as any).refundDestination || 'wallet';

      if (dest === 'wallet' || dest === 'both') {
        await User.findByIdAndUpdate(
          order.buyer,
          { $inc: { walletBalance: refundAmount } },
          { session }
        );

        await WalletTransaction.create([{
          user: order.buyer,
          amount: refundAmount,
          type: 'credit',
          description: `Refund: Cancelled Order #${orderId.toString().slice(-6).toUpperCase()}${dest === 'both' ? ' (Wallet Portion)' : ''}`,
          orderId: order._id
        }], { session });

        if (dest === 'wallet') {
          await Order.findByIdAndUpdate(orderId, { refundStatus: 'completed' }, { session });
        }
      }

      if (dest === 'bank' || dest === 'both') {
        await Order.findByIdAndUpdate(orderId, { 
          refundStatus: 'pending',
          refundDestination: dest 
        }, { session });
      }

      await session.commitTransaction();

      // Emit balance update if wallet was credited
      if (dest === 'wallet' || dest === 'both') {
        const latestUser = await User.findById(order.buyer).select('walletBalance');
        if (latestUser) {
          io.to(order.buyer.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: latestUser.walletBalance || 0 });
        }
      }

      console.log(`[WALLET] Refunded ₹${refundAmount} back to buyer ${order.buyer} for order ${orderId}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] Refund failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async revertPayout(payoutId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await PayoutRequest.findById(payoutId).session(session);
      if (!request) throw new AppError('Payout request not found', 404);

      if (request.status !== PayoutRequestStatus.PENDING && request.status !== PayoutRequestStatus.PROCESSING) {
        await session.commitTransaction();
        return;
      }

      const updatedRider = await User.findByIdAndUpdate(
        request.rider,
        { $inc: { walletBalance: request.amount } },
        { session, new: true, select: 'walletBalance' }
      );

      await WalletTransaction.create([{
        user: request.rider,
        amount: request.amount,
        type: 'credit',
        description: 'Reversion: Payout request rejected/cancelled',
        payoutId: request._id
      }], { session });

      await session.commitTransaction();

      if (updatedRider) {
        io.to(request.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedRider.walletBalance || 0 });
      }

      console.log(`[WALLET] Reverted Payout Request ₹${request.amount} for rider ${request.rider}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] Reversion failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getWalletData(userId: string) {
    const user = await User.findById(userId).select('walletBalance cashInHand').lean();
    const transactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return {
      balance: user?.walletBalance || 0,
      cashInHand: user?.cashInHand || 0,
      transactions
    };
  }
}
