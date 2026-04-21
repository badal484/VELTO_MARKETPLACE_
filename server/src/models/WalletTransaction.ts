import mongoose, { Schema, Document } from 'mongoose';
import { IWalletTransaction } from '@shared/types';

export interface IWalletTransactionSchema extends Omit<IWalletTransaction, '_id' | 'createdAt'>, Document {}

const walletTransactionSchema = new Schema<IWalletTransactionSchema>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    description: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    payoutId: { type: Schema.Types.ObjectId, ref: 'PayoutRequest' },
  },
  { timestamps: true }
);

export const WalletTransaction = mongoose.model<IWalletTransactionSchema>('WalletTransaction', walletTransactionSchema);