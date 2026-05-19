import { Notification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { getIO } from '../socket/socket';

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

      getIO().to(params.recipient).emit('notification', {
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data,
      });

      // Push via FCM if tokens exist.
      // Always include `type` so the client notification navigator can route the tap.
      const user = await User.findById(params.recipient).select('fcmTokens');
      if (user?.fcmTokens?.length) {
        const { FCMService } = require('./fcmService');
        const fcmData: Record<string, string> = {
          type: String(params.type),
          ...(params.relatedId ? { relatedId: params.relatedId } : {}),
          ...Object.fromEntries(
            Object.entries(params.data || {}).map(([k, v]) => [k, String(v)])
          ),
        };
        await FCMService.sendToUser(
          params.recipient,
          params.title,
          params.message,
          fcmData
        );
      }
    } catch (err) {
      console.error('[NotificationService] send error:', err);
    }
  }
}
