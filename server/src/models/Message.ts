import mongoose, { Document, Schema } from 'mongoose';
import { IMessage } from '@shared/types';

export interface IMessageDocument extends Omit<IMessage, '_id' | 'createdAt' | 'conversationId'>, Document {
  conversationId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessageDocument>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false }
}, { timestamps: true });

export const Message = mongoose.model<IMessageDocument>('Message', messageSchema);