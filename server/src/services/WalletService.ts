import mongoose from 'mongoose';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { PayoutRequest } from '../models/PayoutRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import { AppError } from '../utils/errors';
import { PayoutRequestStatus } from '@shared/types';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';

export class WalletService {
  private static readonly COMMISSION_RATE = parseFloat(process.env.VELTO_COMMISSION_RATE || '0.10');
  private static readonly SELLER_COMMISSION_RATE = parseFloat(process.env.VELTO_SELLER_COMMISSION_RATE || '0.05');
  private static readonly MIN_PAYOUT_AMOUNT = 500;

  private static round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  static async creditEarnings(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) {
        throw new AppError('Order or rider not found', 404);
      }

      if (order.deliveryCharge <= 0) {
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
      const commission = this.round(deliveryCharge * this.COMMISSION_RATE);
      const earnings = this.round(deliveryCharge - commission);

      const rider = await User.findById(order.rider).session(session);
      if (!rider) throw new AppError('Rider not found', 404);

      // 🚨 AUTOMATED OFFSETTING LOGIC 🚨
      // If rider has cash liability, use these earnings to pay it off instead of increasing wallet balance.
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
        console.log(`[WALLET] Offset ₹${offsetReduction} from rider liability. Remaining liability: ${(rider.cashInHand || 0) - offsetReduction}`);
      }

      // Update Rider Balance with remaining earnings
      if (finalCredit > 0) {
        await User.findByIdAndUpdate(
          order.rider,
          { $inc: { walletBalance: finalCredit } },
          { session }
        );
      }

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

      await session.commitTransaction();
      
      // Real-time Push
      const updatedRider = await User.findById(order.rider).select('walletBalance cashInHand');
      io.to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { 
        balance: updatedRider?.walletBalance || 0,
        cashInHand: updatedRider?.cashInHand || 0
      });

      console.log(`[WALLET] Processed ₹${earnings} for rider ${order.rider}. Credit: ₹${finalCredit}, Offset: ₹${offsetReduction}`);
    } catch (error) {
      await session.abortTransaction();
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
      const commission = Math.round((itemTotal * this.SELLER_COMMISSION_RATE) * 100) / 100;
      const earnings = Math.round((itemTotal - commission) * 100) / 100;

      // Update Seller Balance
      await User.findByIdAndUpdate(
        order.seller,
        { $inc: { walletBalance: earnings } },
        { session }
      );

      // Create Transaction Record
      await WalletTransaction.create([{
        user: order.seller,
        amount: earnings,
        type: 'credit',
        description: `Product Sale: Order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      const updatedSeller = await User.findById(order.seller).select('walletBalance');
      io.to(order.seller.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedSeller?.walletBalance || 0 });

      console.log(`[WALLET] Credited Seller ₹${earnings} (after ${this.SELLER_COMMISSION_RATE * 100}% comm) to ${order.seller}`);
    } catch (error) {
      await session.abortTransaction();
      console.error('[WALLET] Seller Credit failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Specifically handles the completion of a COD order.
   * Increments Rider liability and debits platform commission.
   */
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

      // 1. Increment Rider Liability (The physical cash they now hold)
      await User.findByIdAndUpdate(
        order.rider,
        { $inc: { cashInHand: order.totalPrice } },
        { session }
      );

      // 2. Debit platform commission from their wallet balance
      // Since they have the physical cash, the platform takes its cut from their virtual balance.
      const itemTotal = order.totalPrice - (order.deliveryCharge || 0);
      const commission = this.round(itemTotal * this.SELLER_COMMISSION_RATE); 
      
      if (commission > 0) {
        await User.findByIdAndUpdate(
          order.rider,
          { $inc: { walletBalance: -commission } },
          { session }
        );

        await WalletTransaction.create([{
          user: order.rider,
          amount: commission,
          type: 'debit',
          description: `Platform Commission for COD Order #${orderId.toString().slice(-6).toUpperCase()}`,
          orderId: order._id
        }], { session });
      }

      await session.commitTransaction();

      // Real-time Push
      const updatedRider = await User.findById(order.rider).select('walletBalance cashInHand');
      io.to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { 
        balance: updatedRider?.walletBalance || 0,
        cashInHand: updatedRider?.cashInHand || 0
      });

      console.log(`[WALLET] COD Fulfilled. Rider ${order.rider} Liability +₹${order.totalPrice}, Wallet -₹${commission}`);
    } catch (error) {
       await session.abortTransaction();
       console.error('[WALLET] COD Processing failed:', error);
       throw error;
    } finally {
       session.endSession();
    }
  }

  static async requestPayout(riderId: string, data: any) {
    const { amount, bankDetails } = data;

    const rider = await User.findById(riderId);
    if (!rider) throw new AppError('Rider not found', 404);

    if (amount < this.MIN_PAYOUT_AMOUNT) {
      throw new AppError(`Minimum payout amount is ₹${this.MIN_PAYOUT_AMOUNT}`, 400);
    }

    const currentBalance = rider.walletBalance || 0;
    if (currentBalance < amount) {
      throw new AppError('Insufficient wallet balance', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Deduct from balance immediately
      await User.findByIdAndUpdate(riderId, { $inc: { walletBalance: -amount } }, { session });

      // 2. Create Payout Request
      const request = await PayoutRequest.create([{
        rider: riderId,
        amount,
        bankDetails,
        status: PayoutRequestStatus.PENDING
      }], { session });

      // 3. Create Debit Transaction
      await WalletTransaction.create([{
        user: riderId,
        amount,
        type: 'debit',
        description: 'Payout request initiated',
        payoutId: request[0]._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      io.to(riderId.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: (rider.walletBalance || 0) - amount });

      return request[0];
    } catch (error) {
      await session.abortTransaction();
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

      // Only refund if the order was paid (Confirmed or after)
      if (order.status === 'pending' || order.status === 'cancelled') {
        await session.commitTransaction();
        return;
      }

      // Check if already refunded
      const existingRefund = await WalletTransaction.findOne({ orderId, user: order.buyer, type: 'credit', description: /Refund/ }).session(session);
      if (existingRefund) {
        await session.commitTransaction();
        return;
      }

      const refundAmount = order.totalPrice;

      // Credit the Buyer's balance
      await User.findByIdAndUpdate(
        order.buyer,
        { $inc: { walletBalance: refundAmount } },
        { session }
      );

      // Create Transaction Record
      await WalletTransaction.create([{
        user: order.buyer,
        amount: refundAmount,
        type: 'credit',
        description: `Refund: Cancelled Order #${orderId.toString().slice(-6).toUpperCase()}`,
        orderId: order._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      const updatedBuyer = await User.findById(order.buyer).select('walletBalance');
      io.to(order.buyer.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedBuyer?.walletBalance || 0 });

      console.log(`[WALLET] Refunded ₹${refundAmount} back to buyer ${order.buyer} for order ${orderId}`);
    } catch (error) {
      await session.abortTransaction();
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

      // Only revert if it's currently pending or processing (not already completed/reverted)
      if (request.status !== PayoutRequestStatus.PENDING && request.status !== PayoutRequestStatus.PROCESSING) {
        await session.commitTransaction();
        return;
      }

      // Restore the user's balance
      await User.findByIdAndUpdate(
        request.rider,
        { $inc: { walletBalance: request.amount } },
        { session }
      );

      // Create Credit Transaction (Reversion)
      await WalletTransaction.create([{
        user: request.rider,
        amount: request.amount,
        type: 'credit',
        description: 'Reversion: Payout request rejected/cancelled',
        payoutId: request._id
      }], { session });

      await session.commitTransaction();

      // Real-time Push
      const updatedRider = await User.findById(request.rider).select('walletBalance');
      io.to(request.rider.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedRider?.walletBalance || 0 });

      console.log(`[WALLET] Reverted Payout Request ₹${request.amount} for rider ${request.rider}`);
    } catch (error) {
      await session.abortTransaction();
      console.error('[WALLET] Reversion failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getWalletData(userId: string) {
    const user = await User.findById(userId).select('walletBalance cashInHand cashLimit');
    const transactions = await WalletTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50);

    return {
      balance: user?.walletBalance || 0,
      cashInHand: user?.cashInHand || 0,
      cashLimit: user?.cashLimit || 2000,
      transactions
    };
  }
}