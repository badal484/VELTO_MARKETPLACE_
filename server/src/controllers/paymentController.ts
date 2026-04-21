import { Request, Response } from 'express';
import { RazorpayService } from '../services/RazorpayService';
import { Order } from '../models/Order';
import { OrderStatus } from '@shared/types';
import { handleError, AppError } from '../utils/errors';
import { io } from '../socket/socket';
import { WorkflowService } from '../services/workflowService';
import { NotificationType } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const isValid = RazorpayService.verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      throw new AppError('Invalid payment signature. Potential fraud detected.', 400);
    }

    // Update all orders associated with this Razorpay Order ID
    const orders = await Order.find({ razorpayOrderId: razorpay_order_id });
    
    if (orders.length === 0) {
      throw new AppError('No orders found for this payment session.', 404);
    }

    // Atomic update status to CONFIRMED
    await Order.updateMany(
      { razorpayOrderId: razorpay_order_id },
      { 
        $set: { 
          status: OrderStatus.CONFIRMED,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        } 
      }
    );

    // Create Notification for Buyer
    const buyerId = (orders[0].buyer as any)?._id || orders[0].buyer;
    await NotificationService.send({
      recipient: buyerId.toString(),
      type: NotificationType.ORDER,
      title: 'Payment Verified',
      message: `Success: Your payment for the batch order has been verified. Sellers are now preparing your items.`,
      data: { razorpayOrderId: razorpay_order_id }
    });

    // Notify buyer, sellers and sync workflow
    for (const order of orders) {
      await WorkflowService.syncOrderState(
        order._id.toString(), 
        OrderStatus.CONFIRMED, 
        'Payment Verified: Automatically confirmed via Razorpay.'
      );
      
      // Notify Seller
      io.to(order.seller.toString()).emit('order_status_updated', {
        orderId: order._id,
        status: OrderStatus.CONFIRMED
      });

      // Notify Buyer
      io.to(order.buyer.toString()).emit('order_status_updated', {
        orderId: order._id,
        status: OrderStatus.CONFIRMED
      });
    }

    res.json({ success: true, message: 'Payment verified and orders confirmed.' });
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
      console.error('[RAZORPAY WEBHOOK] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body.event;
    console.log(`[RAZORPAY WEBHOOK] Event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const razorpayOrderId = req.body.payload.payment.entity.order_id;
      
      // Secondary check: Ensure we don't double-confirm
      const orders = await Order.find({ 
        razorpayOrderId, 
        status: { $in: [OrderStatus.PENDING, OrderStatus.PAYMENT_UNDER_REVIEW] } 
      });

      if (orders.length > 0) {
         await Order.updateMany(
           { razorpayOrderId },
           { $set: { status: OrderStatus.CONFIRMED } }
         );
         
         for (const order of orders) {
           await WorkflowService.syncOrderState(order._id.toString(), OrderStatus.CONFIRMED, 'Webhook: Payment received successfully.');
           
           // Notify Seller
           io.to(order.seller.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.CONFIRMED });
           
           // Notify Buyer
           io.to(order.buyer.toString()).emit('order_status_updated', { orderId: order._id, status: OrderStatus.CONFIRMED });
         }
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[RAZORPAY WEBHOOK] Error:', error);
    res.status(500).send('Webhook Processing Error');
  }
};
