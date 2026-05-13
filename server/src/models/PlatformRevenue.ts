import mongoose, { Schema, Document } from 'mongoose';

export interface IPlatformRevenueDocument extends Document {
  orderId: mongoose.Types.ObjectId;
  riderCommission: number;
  sellerCommission: number;
  totalCommission: number;
  expenseType?: 'cancellation_compensation' | 'refund_expense';
  expenseAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const platformRevenueSchema = new Schema<IPlatformRevenueDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    riderCommission: { type: Number, default: 0 },
    sellerCommission: { type: Number, default: 0 },
    totalCommission: { type: Number, default: 0 },
    expenseType: { type: String, enum: ['cancellation_compensation', 'refund_expense'] },
    expenseAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

platformRevenueSchema.index({ createdAt: -1 });
platformRevenueSchema.index({ orderId: 1 }, { unique: true });

export const PlatformRevenue = mongoose.model<IPlatformRevenueDocument>('PlatformRevenue', platformRevenueSchema);
