import { Request, Response } from 'express';
import { RazorpayService } from '../services/RazorpayService';
import { Order } from '../models/Order';
import { OrderStatus } from '@shared/types';
import { handleError, AppError } from '../utils/errors';
import { io } from '../socket/socket';
import { WorkflowService } from '../services/workflowService';
import { NotificationType } from '../models/Notification';
import { NotificationService } from '../services/notificationService';
import { SocketEvent } from '@shared/constants/socketEvents';
import { User } from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';
import { TransactionCategory } from '@shared/types';

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = RazorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) throw new AppError('Invalid payment signature. Potential fraud detected.', 400);

    const orders = await Order.find({ razorpayOrderId: razorpay_order_id });
    if (orders.length === 0) throw new AppError('No orders found for this payment session.', 404);

    await Order.updateMany(
      { razorpayOrderId: razorpay_order_id },
      {
        $set: {
          status: OrderStatus.PENDING,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
      }
    );

    const buyerId = (orders[0].buyer as any)?._id || orders[0].buyer;
    await NotificationService.send({
      recipient: buyerId.toString(),
      type: NotificationType.ORDER,
      title: 'Payment Successful',
      message: orders.length === 1
        ? 'Your order has been placed and sent to the seller for confirmation.'
        : `Your batch order for ${orders.length} items has been placed successfully.`,
      data: { razorpayOrderId: razorpay_order_id },
    });

    for (const order of orders) {
      await WorkflowService.syncOrderState(
        order._id.toString(),
        OrderStatus.PENDING,
        'Payment received via Razorpay. Awaiting seller confirmation.',
        { silent: true }
      );
      io.to(order.seller.toString()).emit(SocketEvent.NEW_ORDER_FOR_SELLER, order);
      io.to(order.seller.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.PENDING });
      io.to(order.buyer.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.PENDING });
    }

    res.json({ success: true, message: 'Payment verified. Orders are pending seller approval.' });
  } catch (error) {
    handleError(error, res);
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);

    const isValid = RazorpayService.verifyWebhook(body, signature);
    if (!isValid) {
      console.error('[RAZORPAY WEBHOOK] Invalid signature — rejected');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body.event;
    console.log(`[RAZORPAY WEBHOOK] Event: ${event}`);

    // ── Payment captured / Order paid ────────────────────────────────────────
    if (event === 'payment.captured' || event === 'order.paid') {
      const razorpayOrderId = req.body.payload?.payment?.entity?.order_id
        || req.body.payload?.order?.entity?.id;

      if (razorpayOrderId) {
        const orders = await Order.find({
          razorpayOrderId,
          status: { $in: [OrderStatus.PENDING, OrderStatus.PAYMENT_UNDER_REVIEW] },
        });

        if (orders.length > 0) {
          const paymentId = req.body.payload?.payment?.entity?.id;
          await Order.updateMany(
            { razorpayOrderId },
            { $set: { status: OrderStatus.PENDING, ...(paymentId && { razorpayPaymentId: paymentId }) } }
          );

          for (const order of orders) {
            await WorkflowService.syncOrderState(
              order._id.toString(),
              OrderStatus.PENDING,
              'Payment confirmed via Razorpay.'
            );
            io.to(order.seller.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.PENDING });
            io.to(order.buyer.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.PENDING });
          }
        }
      }
    }

    // ── Payment failed ────────────────────────────────────────────────────────
    if (event === 'payment.failed') {
      const razorpayOrderId = req.body.payload?.payment?.entity?.order_id;
      if (razorpayOrderId) {
        const orders = await Order.find({
          razorpayOrderId,
          status: OrderStatus.PAYMENT_UNDER_REVIEW,
        });

        if (orders.length > 0) {
          // Mark as cancelled — refundToWallet handles wallet portion refund
          await Order.updateMany({ razorpayOrderId }, { $set: { status: OrderStatus.CANCELLED } });

          for (const order of orders) {
            // Restore stock
            await Order.findById(order._id).then(async (o) => {
              if (o) {
                const { Product } = require('../models/Product');
                await Product.findByIdAndUpdate(o.product, { $inc: { stock: o.quantity } });
              }
            });

            // Refund wallet portion if any
            const { WalletService } = require('../services/WalletService');
            await WalletService.refundToWallet(order._id.toString()).catch((e: any) =>
              console.error('[WEBHOOK] refund failed for failed payment:', e)
            );

            io.to(order.buyer.toString()).emit('order_status_updated', {
              orderId: order._id,
              status: OrderStatus.CANCELLED,
            });
          }

          console.log(`[RAZORPAY WEBHOOK] Cancelled ${orders.length} order(s) due to payment failure`);
        }
      }
    }

    // ── Refund updated (bank refund completed by Razorpay) ───────────────────
    if (event === 'refund.created' || event === 'refund.processed') {
      const refundEntity = req.body.payload?.refund?.entity;
      if (refundEntity?.payment_id) {
        const order = await Order.findOne({ razorpayPaymentId: refundEntity.payment_id });
        if (order && (order as any).refundStatus === 'pending') {
          await Order.findByIdAndUpdate(order._id, { refundStatus: 'completed' });
          console.log(`[RAZORPAY WEBHOOK] Refund completed for order ${order._id}`);

          // Record the bank refund as a transaction for audit
          await WalletTransaction.create({
            user: order.buyer,
            amount: refundEntity.amount / 100, // convert paise to rupees
            type: 'credit',
            category: TransactionCategory.REFUND,
            description: `Bank refund completed via Razorpay (Ref: ${refundEntity.id}) — order #${order._id.toString().slice(-6).toUpperCase()}`,
            orderId: order._id,
          });

          const buyer = await User.findById(order.buyer).select('walletBalance').lean();
          if (buyer) {
            io.to(order.buyer.toString()).emit(SocketEvent.WALLET_UPDATED, { balance: buyer.walletBalance || 0 });
          }
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[RAZORPAY WEBHOOK] Error:', error);
    res.status(500).send('Webhook processing error');
  }
};
