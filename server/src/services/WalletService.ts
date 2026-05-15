import mongoose from 'mongoose';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { Shop } from '../models/Shop';
import { PayoutRequest } from '../models/PayoutRequest';
import { WalletTransaction } from '../models/WalletTransaction';
import { PlatformRevenue } from '../models/PlatformRevenue';
import { AppError } from '../utils/errors';
import { PayoutRequestStatus, TransactionCategory } from '@shared/types';
import { getIO } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';
import { round } from '../utils/math';
import { NotificationService } from './notificationService';
import { NotificationType } from '../models/Notification';
import { RazorpayService } from './RazorpayService';
import { OrderStatus } from '@shared/types';

export class WalletService {
  private static readonly SELLER_COMMISSION_RATE = parseFloat(process.env.VELTO_SELLER_COMMISSION_RATE || '0.07');
  private static readonly RIDER_CANCEL_COMPENSATION = 15; // ₹15 for effort
  private static readonly MIN_PAYOUT_AMOUNT = 500;

  // ─── RIDER EARNINGS ──────────────────────────────────────────────────────────

  /**
   * Credit rider earnings after order completion.
   * Velto earns RIDER_COMMISSION_RATE% of delivery charge.
   * If rider has a COD cash liability, it is offset against earnings automatically.
   */
  static async creditEarnings(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) throw new AppError('Order or rider not found', 404);

      // Idempotency: skip if already credited
      const existingTx = await WalletTransaction.findOne({
        orderId: order._id,
        user: order.rider,
        category: TransactionCategory.RIDER_EARNINGS,
      }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        return;
      }

      const deliveryCharge = order.deliveryCharge || 0;
      // Guaranteed flat net payout of ₹27 to the rider per delivery regardless of free-delivery promo
      const grossEarnings = 27;
      const commission = Math.max(0, deliveryCharge - grossEarnings);

      const rider = await User.findById(order.rider).session(session);
      if (!rider) throw new AppError('Rider not found', 404);

      // Auto-offset COD cash liability against earnings
      let netCredit = grossEarnings;
      let offsetAmount = 0;

      if ((rider.cashInHand || 0) > 0) {
        offsetAmount = Math.min(grossEarnings, rider.cashInHand!);
        netCredit = round(grossEarnings - offsetAmount);

        await User.findByIdAndUpdate(order.rider, { $inc: { cashInHand: -offsetAmount } }, { session });

        await WalletTransaction.create([{
          user: order.rider,
          amount: offsetAmount,
          type: 'debit',
          category: TransactionCategory.COD_LIABILITY_OFFSET,
          description: `COD offset: ₹${offsetAmount} settled against earnings for order #${orderId.slice(-6).toUpperCase()}`,
          orderId: order._id,
        }], { session });
      }

      const updatedRider = await User.findByIdAndUpdate(
        order.rider,
        { $inc: { walletBalance: netCredit } },
        { session, new: true, select: 'walletBalance cashInHand' }
      );

      await WalletTransaction.create([{
        user: order.rider,
        amount: grossEarnings,
        type: 'credit',
        category: TransactionCategory.RIDER_EARNINGS,
        description: offsetAmount > 0
          ? `Delivery earnings ₹${grossEarnings} (₹${offsetAmount} offset vs COD) — order #${orderId.slice(-6).toUpperCase()}`
          : `Delivery earnings — order #${orderId.slice(-6).toUpperCase()}`,
        orderId: order._id,
      }], { session });

      await PlatformRevenue.findOneAndUpdate(
        { orderId: order._id },
        { $inc: { riderCommission: commission, totalCommission: commission } },
        { session, upsert: true, new: true }
      );

      await session.commitTransaction();

      if (updatedRider) {
        getIO().to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, {
          balance: updatedRider.walletBalance || 0,
          cashInHand: updatedRider.cashInHand || 0,
        });
      }

      console.log(`[WALLET] Rider earnings: gross=₹${grossEarnings}, commission=₹${commission}, offset=₹${offsetAmount}, net=₹${netCredit}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] creditEarnings failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── SELLER EARNINGS ─────────────────────────────────────────────────────────

  /**
   * Credit seller earnings after order completion.
   * Velto earns SELLER_COMMISSION_RATE% of the item price (excluding delivery charge).
   */
  static async creditSellerEarnings(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Order not found', 404);

      const existingTx = await WalletTransaction.findOne({
        orderId: order._id,
        user: order.seller,
        category: TransactionCategory.SELLER_EARNINGS,
      }).session(session);
      if (existingTx) {
        await session.commitTransaction();
        return;
      }

      const itemTotal = order.totalPrice;

      // Dynamically resolve commission rate: shop override or platform default
      const shop = await Shop.findById(order.shop).session(session);
      const appliedRate = (shop?.commissionRate !== undefined && shop.commissionRate !== null)
        ? shop.commissionRate / 100
        : this.SELLER_COMMISSION_RATE;

      const commission = round(itemTotal * appliedRate);
      const earnings = round(itemTotal - commission);

      const updatedSeller = await User.findByIdAndUpdate(
        order.seller,
        { $inc: { walletBalance: earnings } },
        { session, new: true, select: 'walletBalance' }
      );

      await WalletTransaction.create([{
        user: order.seller,
        amount: earnings,
        type: 'credit',
        category: TransactionCategory.SELLER_EARNINGS,
        description: `Product sale (after ${round(appliedRate * 100, 1)}% platform fee) — order #${orderId.slice(-6).toUpperCase()}`,
        orderId: order._id,
      }], { session });

      // Track Velto's share
      await PlatformRevenue.findOneAndUpdate(
        { orderId: order._id },
        { $inc: { sellerCommission: commission, totalCommission: commission } },
        { session, upsert: true, new: true }
      );

      await session.commitTransaction();

      if (updatedSeller) {
        getIO().to(order.seller.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedSeller.walletBalance || 0 });
      }

      console.log(`[WALLET] Seller earnings: item=₹${itemTotal}, commission=₹${commission}, credited=₹${earnings}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] creditSellerEarnings failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── COD FULFILLMENT ─────────────────────────────────────────────────────────

  /**
   * Record that the rider has collected COD cash — creates a liability.
   * The rider must physically deposit this cash to the company.
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

      const existing = await WalletTransaction.findOne({
        orderId: order._id,
        user: order.rider,
        category: TransactionCategory.COD_COLLECTION,
      }).session(session);
      if (existing) {
        await session.commitTransaction();
        return;
      }

      // Rider collects full amount: product price + delivery charge
      const amountCollected = round(order.totalPrice + (order.deliveryCharge || 0));

      const updatedRider = await User.findByIdAndUpdate(
        order.rider,
        { $inc: { cashInHand: amountCollected } },
        { session, new: true, select: 'walletBalance cashInHand' }
      );

      await WalletTransaction.create([{
        user: order.rider,
        amount: amountCollected,
        type: 'debit',
        category: TransactionCategory.COD_COLLECTION,
        description: `COD cash collected — must deposit ₹${amountCollected} — order #${orderId.slice(-6).toUpperCase()}`,
        orderId: order._id,
      }], { session });

      await session.commitTransaction();

      if (updatedRider) {
        getIO().to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, {
          balance: updatedRider.walletBalance || 0,
          cashInHand: updatedRider.cashInHand || 0,
        });
      }
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] processCODFulfillment failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── CANCELLATION COMPENSATION ───────────────────────────────────────────────

  /**
   * Pay the rider a fixed effort fee when an assigned order is cancelled.
   * Velto absorbs this cost, recorded as a platform expense.
   */
  static async compensateRiderForCancellation(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order || !order.rider) {
        await session.commitTransaction();
        return;
      }

      const existing = await WalletTransaction.findOne({
        orderId: order._id,
        user: order.rider,
        category: TransactionCategory.CANCELLATION_COMPENSATION,
      }).session(session);
      if (existing) {
        await session.commitTransaction();
        return;
      }

      await User.findByIdAndUpdate(order.rider, { $inc: { walletBalance: this.RIDER_CANCEL_COMPENSATION } }, { session });

      await WalletTransaction.create([{
        user: order.rider,
        amount: this.RIDER_CANCEL_COMPENSATION,
        type: 'credit',
        category: TransactionCategory.CANCELLATION_COMPENSATION,
        description: `Cancellation effort fee ₹${this.RIDER_CANCEL_COMPENSATION} — order #${orderId.slice(-6).toUpperCase()}`,
        orderId: order._id,
      }], { session });

      // Platform absorbs cost
      await PlatformRevenue.findOneAndUpdate(
        { orderId: order._id },
        { $set: { expenseType: 'cancellation_compensation' }, $inc: { expenseAmount: this.RIDER_CANCEL_COMPENSATION } },
        { session, upsert: true }
      );

      await session.commitTransaction();
      getIO().to(order.rider.toString()).emit(SocketEvent.WALLET_UPDATED, {});
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] compensateRiderForCancellation failed:', error);
    } finally {
      session.endSession();
    }
  }

  // ─── REFUNDS ─────────────────────────────────────────────────────────────────

  /**
   * Process a full refund when an order is cancelled.
   *
   * Split logic:
   *   walletAmountPaid  → always back to Velto wallet
   *   Razorpay portion  → back to bank (via Razorpay API) or Velto wallet depending on refundDestination
   *   COD (no wallet)   → nothing to refund digitally
   */
  static async refundToWallet(orderId: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError('Order not found', 404);

      // COD with no digital payment — nothing to refund
      if (order.paymentMethod === 'Cash on Delivery' && (order.walletAmountPaid || 0) === 0) {
        await session.commitTransaction();
        return;
      }

      // Idempotency
      const existingRefund = await WalletTransaction.findOne({
        orderId: order._id,
        user: order.buyer,
        category: TransactionCategory.REFUND,
      }).session(session);
      if (existingRefund) {
        await session.commitTransaction();
        return;
      }

      const walletPaid = order.walletAmountPaid || 0;
      // Full amount buyer paid = product price + delivery charge
      const totalPaid = round(order.totalPrice + (order.deliveryCharge || 0));
      // The portion that was actually charged to Razorpay (anything wallet didn't cover)
      const razorpayPaid = order.paymentMethod === 'Razorpay'
        ? round(totalPaid - walletPaid)
        : 0;

      const dest = (order as any).refundDestination || 'wallet';

      // wallet: all back to Velto wallet (store credit)
      // bank / both: walletPaid→wallet, razorpayPaid→bank via Razorpay API
      const walletRefund = dest === 'wallet' ? round(walletPaid + razorpayPaid) : walletPaid;
      const bankRefund = (dest === 'bank' || dest === 'both') ? razorpayPaid : 0;

      // 1. Wallet credit
      if (walletRefund > 0) {
        await User.findByIdAndUpdate(order.buyer, { $inc: { walletBalance: walletRefund } }, { session });

        await WalletTransaction.create([{
          user: order.buyer,
          amount: walletRefund,
          type: 'credit',
          category: TransactionCategory.REFUND,
          description: `Refund ₹${walletRefund} to wallet — cancelled order #${orderId.slice(-6).toUpperCase()}${bankRefund > 0 ? ' (wallet portion)' : ''}`,
          orderId: order._id,
        }], { session });
      }

      await session.commitTransaction();

      // 2. Razorpay bank refund (outside transaction — external API call)
      let refundStatus: 'completed' | 'pending' = walletRefund > 0 ? 'completed' : 'pending';

      if (bankRefund > 0) {
        if (order.razorpayPaymentId) {
          try {
            await RazorpayService.initiateRefund(order.razorpayPaymentId, bankRefund, {
              orderId: orderId.slice(-6).toUpperCase(),
              reason: 'order_cancelled',
            });
            refundStatus = 'pending'; // pending until Razorpay webhook confirms
          } catch (refundErr: any) {
            console.error('[WALLET] Razorpay refund failed, crediting wallet as fallback:', refundErr.message);
            // Fallback: credit to wallet
            await User.findByIdAndUpdate(order.buyer, { $inc: { walletBalance: bankRefund } });
            await WalletTransaction.create({
              user: order.buyer,
              amount: bankRefund,
              type: 'credit',
              category: TransactionCategory.REFUND,
              description: `Refund fallback ₹${bankRefund} to wallet (Razorpay API failed) — order #${orderId.slice(-6).toUpperCase()}`,
              orderId: order._id,
            });
            refundStatus = 'completed';
          }
        } else {
          // No payment ID — credit to wallet as fallback
          await User.findByIdAndUpdate(order.buyer, { $inc: { walletBalance: bankRefund } });
          await WalletTransaction.create({
            user: order.buyer,
            amount: bankRefund,
            type: 'credit',
            category: TransactionCategory.REFUND,
            description: `Refund ₹${bankRefund} to wallet (no Razorpay payment on record) — order #${orderId.slice(-6).toUpperCase()}`,
            orderId: order._id,
          });
          refundStatus = 'completed';
        }
      }

      await Order.findByIdAndUpdate(orderId, { refundStatus });

      const latestBuyer = await User.findById(order.buyer).select('walletBalance').lean();
      if (latestBuyer) {
        getIO().to(order.buyer.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: latestBuyer.walletBalance || 0 });
      }

      console.log(`[WALLET] Refund: wallet=₹${walletRefund}, bank=₹${bankRefund}, dest=${dest}`);
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] refundToWallet failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── PAYOUT REQUEST ──────────────────────────────────────────────────────────

  static async requestPayout(userId: string, data: any) {
    let { amount, bankDetails } = data;
    amount = round(Number(amount));

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    if (!bankDetails?.accountNumber) {
      if (user.bankDetails?.accountNumber) {
        bankDetails = user.bankDetails;
      } else {
        throw new AppError('Bank details are required. Please add them to your profile first.', 400);
      }
    }

    if (amount < this.MIN_PAYOUT_AMOUNT) {
      throw new AppError(`Minimum payout amount is ₹${this.MIN_PAYOUT_AMOUNT}`, 400);
    }

    if ((user.walletBalance || 0) < amount) {
      throw new AppError(`Insufficient balance. Available: ₹${user.walletBalance || 0}`, 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { walletBalance: -amount } },
        { session, new: true, select: 'walletBalance' }
      );

      const [request] = await PayoutRequest.create([{
        user: userId,
        amount,
        bankDetails,
        status: PayoutRequestStatus.PENDING,
      }], { session });

      await WalletTransaction.create([{
        user: userId,
        amount,
        type: 'debit',
        category: TransactionCategory.PAYOUT,
        description: `Payout request ₹${amount} → ${bankDetails.bankName} ···${String(bankDetails.accountNumber).slice(-4)}`,
        payoutId: request._id,
      }], { session });

      await session.commitTransaction();

      if (updatedUser) {
        getIO().to(userId).emit(SocketEvent.WALLET_UPDATED, { balance: updatedUser.walletBalance || 0 });
      }

      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      for (const admin of admins) {
        await NotificationService.send({
          recipient: admin._id.toString(),
          type: NotificationType.PAYOUT,
          title: 'New Payout Request',
          message: `${user.name} requested ₹${amount} to ${bankDetails.bankName}`,
          relatedId: request._id.toString(),
        });
      }

      return request;
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
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

      if (![PayoutRequestStatus.PENDING, PayoutRequestStatus.PROCESSING].includes(request.status)) {
        await session.commitTransaction();
        return;
      }

      const updatedUser = await User.findByIdAndUpdate(
        request.user,
        { $inc: { walletBalance: request.amount } },
        { session, new: true, select: 'walletBalance' }
      );

      await WalletTransaction.create([{
        user: request.user,
        amount: request.amount,
        type: 'credit',
        category: TransactionCategory.PAYOUT_REVERSION,
        description: `Payout ₹${request.amount} reversed — request rejected`,
        payoutId: request._id,
      }], { session });

      await session.commitTransaction();

      if (updatedUser) {
        getIO().to(request.user.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: updatedUser.walletBalance || 0 });
      }
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      console.error('[WALLET] revertPayout failed:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // ─── WALLET DATA ─────────────────────────────────────────────────────────────

  static async getWalletData(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const user = await User.findById(userId).select('walletBalance cashInHand').lean();
    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({ user: userId }),
    ]);

    return {
      balance: user?.walletBalance || 0,
      cashInHand: user?.cashInHand || 0,
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ─── PLATFORM REVENUE (Admin only) ───────────────────────────────────────────

  static async getPlatformRevenueSummary(from?: Date, to?: Date) {
    const match: any = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = from;
      if (to) match.createdAt.$lte = to;
    }

    const [result] = await PlatformRevenue.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRiderCommission: { $sum: '$riderCommission' },
          totalSellerCommission: { $sum: '$sellerCommission' },
          totalCommission: { $sum: '$totalCommission' },
          totalExpenses: { $sum: '$expenseAmount' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $addFields: { netRevenue: { $subtract: ['$totalCommission', '$totalExpenses'] } },
      },
    ]);

    return result || {
      totalRiderCommission: 0,
      totalSellerCommission: 0,
      totalCommission: 0,
      totalExpenses: 0,
      netRevenue: 0,
      orderCount: 0,
    };
  }

  static async getRiderStats(riderId: string) {
    const [statsAgg, deliveriesCount] = await Promise.all([
      WalletTransaction.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(riderId), category: TransactionCategory.RIDER_EARNINGS } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Order.countDocuments({ 
        rider: riderId, 
        status: { $in: [OrderStatus.DELIVERED, OrderStatus.COMPLETED_PENDING_RELEASE, OrderStatus.COMPLETED] } 
      })
    ]);

    return {
      earnings: statsAgg.length > 0 ? statsAgg[0].total : 0,
      deliveries: deliveriesCount
    };
  }

  static async getMerchantStats(merchantId: string) {
    const statsAgg = await WalletTransaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(merchantId), category: TransactionCategory.SELLER_EARNINGS } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return {
      totalEarnings: statsAgg.length > 0 ? statsAgg[0].total : 0,
    };
  }
}
