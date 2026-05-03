import { Order } from '../models/Order';
import { Notification, NotificationType } from '../models/Notification';
import { OrderStatus } from '@shared/types';
import { io } from '../socket/socket';

export class WorkflowService {
  static async syncOrderState(
    orderId: string,
    status: OrderStatus,
    message?: string,
    options?: { silent?: boolean }
  ) {
    try {
      const order = await Order.findById(orderId).populate('buyer seller', '_id name');
      if (!order) return;

      const notifMessage = message || `Order status updated to: ${status}`;

      if (!options?.silent) {
        const buyerId = (order.buyer as any)?._id?.toString() || order.buyer?.toString();
        const sellerId = (order.seller as any)?._id?.toString() || order.seller?.toString();

        // Populate full order details for real-time UI synchronization
        const fullOrder = await Order.findById(orderId)
          .populate('product')
          .populate('shop')
          .populate('buyer', 'name avatar phoneNumber')
          .populate('seller', 'name avatar')
          .populate('rider', 'name avatar phoneNumber');

        if (buyerId) {
          await Notification.create({
            recipient: buyerId,
            type: NotificationType.ORDER,
            title: 'Order Update',
            message: notifMessage,
            relatedId: orderId,
          });
          io.to(buyerId).emit('order_status_updated', fullOrder);
        }

        if (sellerId) {
          io.to(sellerId).emit('order_status_updated', fullOrder);
        }

        if (order.rider) {
          const riderId = (order.rider as any)?._id?.toString() || order.rider?.toString();
          if (riderId) io.to(riderId).emit('order_status_updated', fullOrder);
        }

        // Global broadcast for job availability list synchronization
        // Triggered when an order becomes available for riders OR is taken by a rider
        if ([OrderStatus.SEARCHING_RIDER, OrderStatus.READY_FOR_PICKUP, OrderStatus.RIDER_ASSIGNED].includes(status)) {
          io.emit('available_jobs_updated');
        }
      }
    } catch (err) {
      console.error('[WorkflowService] syncOrderState error:', err);
    }
  }
}
