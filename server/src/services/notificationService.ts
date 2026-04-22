import { Notification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { io } from '../socket/socket';

interface SendNotificationParams {
  recipient: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  relatedId?: string;
}

export class NotificationService {
  static async send(params: SendNotificationParams) {
    try {
      await Notification.create({
        recipient: params.recipient,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
        data: params.data,
      });

      io.to(params.recipient).emit('notification', {
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
      });

      // Push via FCM if tokens exist
      const user = await User.findById(params.recipient).select('fcmTokens');
      if (user?.fcmTokens?.length) {
        // FCM sending handled separately by fcmService
      }
    } catch (err) {
      console.error('[NotificationService] send error:', err);
    }
  }
}
