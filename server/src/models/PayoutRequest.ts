import mongoose, { Schema, Document } from 'mongoose';
import { IPayoutRequest, PayoutRequestStatus } from '@shared/types';

export interface IPayoutRequestSchema extends Omit<IPayoutRequest, '_id' | 'createdAt'>, Document {}

const payoutRequestSchema = new Schema<IPayoutRequestSchema>(
  {
    rider: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    bankDetails: {
      holderName: { type: String, required: true },
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      ifscCode: { type: String, required: true },
    },
    status: {
      type: String,
      enum: Object.values(PayoutRequestStatus),
      default: PayoutRequestStatus.PENDING,
    },
    adminNote: { type: String },
    transactionId: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

export const PayoutRequest = mongoose.model<IPayoutRequestSchema>('PayoutRequest', payoutRequestSchema);
