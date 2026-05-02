import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
  ORDER = 'ORDER',
  SHOP = 'SHOP',
  PAYOUT = 'PAYOUT',
  INFO = 'INFO',
  SYSTEM = 'SYSTEM'
}

export interface INotification {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: string;
  data?: any;
  createdAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const notificationSchema = new Schema<INotificationDocument>({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: Object.values(NotificationType), default: NotificationType.SYSTEM },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  relatedId: { type: String },
  data: { type: Schema.Types.Mixed }
}, { timestamps: true });

// Index for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.model<INotificationDocument>('Notification', notificationSchema);
