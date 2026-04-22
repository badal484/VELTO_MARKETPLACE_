import mongoose, { Document, Schema } from 'mongoose';
import { IConversation } from '@shared/types';

export interface IConversationDocument extends Omit<IConversation, '_id' | 'updatedAt'>, Document {
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversationDocument>({
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  lastMessage: { type: String },
}, { timestamps: true });

export const Conversation = mongoose.model<IConversationDocument>('Conversation', conversationSchema);