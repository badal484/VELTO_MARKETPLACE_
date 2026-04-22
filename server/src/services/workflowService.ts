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

        if (buyerId) {
          await Notification.create({
            recipient: buyerId,
            type: NotificationType.ORDER,
            title: 'Order Update',
            message: notifMessage,
            relatedId: orderId,
          });
          io.to(buyerId).emit('order_status_updated', { orderId, status });
        }

        if (sellerId) {
          io.to(sellerId).emit('order_status_updated', { orderId, status });
        }

        if (order.rider) {
          const riderId = (order.rider as any)?.toString();
          if (riderId) io.to(riderId).emit('order_status_updated', { orderId, status });
        }
      }
    } catch (err) {
      console.error('[WorkflowService] syncOrderState error:', err);
    }
  }
}
