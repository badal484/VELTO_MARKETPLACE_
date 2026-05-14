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
          status: OrderStatus.AWAITING_SELLER_CONFIRMATION,
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
        ? 'Payment confirmed! Your order is now awaiting seller acceptance.'
        : `Payment confirmed! Your ${orders.length}-item order is awaiting seller acceptance.`,
      data: { razorpayOrderId: razorpay_order_id },
    });

    // Group orders by seller to send one notification per seller
    const sellerOrderMap = new Map<string, typeof orders[0][]>();
    for (const order of orders) {
      const sellerId = order.seller.toString();
      if (!sellerOrderMap.has(sellerId)) sellerOrderMap.set(sellerId, []);
      sellerOrderMap.get(sellerId)!.push(order);
    }

    for (const order of orders) {
      await WorkflowService.syncOrderState(
        order._id.toString(),
        OrderStatus.AWAITING_SELLER_CONFIRMATION,
        'Payment received via Razorpay. Awaiting seller confirmation.',
        { silent: true }
      );
      io.to(order.seller.toString()).emit(SocketEvent.NEW_ORDER_FOR_SELLER, order);
      io.to(order.seller.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.AWAITING_SELLER_CONFIRMATION });
      io.to(order.buyer.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.AWAITING_SELLER_CONFIRMATION });
    }

    // Notify each seller — push goes through even if they're offline
    for (const [sellerId, sellerOrders] of sellerOrderMap) {
      await NotificationService.send({
        recipient: sellerId,
        type: NotificationType.ORDER,
        title: 'New Order — Action Required',
        message: sellerOrders.length === 1
          ? `A new order for ${(sellerOrders[0] as any).productSnapshot?.title || 'your product'} requires your confirmation.`
          : `${sellerOrders.length} new orders require your confirmation.`,
        data: { orderId: sellerOrders[0]._id.toString() },
      });
    }

    res.json({ success: true, message: 'Payment verified. Awaiting seller confirmation.' });
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
        // Only act on orders still awaiting payment — don't overwrite seller-confirmed orders
        const orders = await Order.find({
          razorpayOrderId,
          status: OrderStatus.PAYMENT_UNDER_REVIEW,
        });

        if (orders.length > 0) {
          const paymentId = req.body.payload?.payment?.entity?.id;
          await Order.updateMany(
            { razorpayOrderId, status: OrderStatus.PAYMENT_UNDER_REVIEW },
            { $set: { status: OrderStatus.AWAITING_SELLER_CONFIRMATION, ...(paymentId && { razorpayPaymentId: paymentId }) } }
          );

          const webhookSellerOrderMap = new Map<string, typeof orders[0][]>();
          for (const order of orders) {
            await WorkflowService.syncOrderState(
              order._id.toString(),
              OrderStatus.AWAITING_SELLER_CONFIRMATION,
              'Payment confirmed via Razorpay webhook. Awaiting seller confirmation.',
              { silent: true }
            );
            io.to(order.seller.toString()).emit(SocketEvent.NEW_ORDER_FOR_SELLER, order);
            io.to(order.seller.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.AWAITING_SELLER_CONFIRMATION });
            io.to(order.buyer.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.AWAITING_SELLER_CONFIRMATION });

            const sellerId = order.seller.toString();
            if (!webhookSellerOrderMap.has(sellerId)) webhookSellerOrderMap.set(sellerId, []);
            webhookSellerOrderMap.get(sellerId)!.push(order);
          }

          for (const [sellerId, sellerOrders] of webhookSellerOrderMap) {
            await NotificationService.send({
              recipient: sellerId,
              type: NotificationType.ORDER,
              title: 'New Order — Action Required',
              message: sellerOrders.length === 1
                ? `A new order for ${(sellerOrders[0] as any).productSnapshot?.title || 'your product'} requires your confirmation.`
                : `${sellerOrders.length} new orders require your confirmation.`,
              data: { orderId: sellerOrders[0]._id.toString() },
            });
          }

          const buyerId = (orders[0].buyer as any)?._id?.toString() || orders[0].buyer.toString();
          await NotificationService.send({
            recipient: buyerId,
            type: NotificationType.ORDER,
            title: 'Payment Successful',
            message: orders.length === 1
              ? 'Payment confirmed! Your order is now awaiting seller acceptance.'
              : `Payment confirmed! Your ${orders.length}-item order is awaiting seller acceptance.`,
            data: { razorpayOrderId },
          });
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
