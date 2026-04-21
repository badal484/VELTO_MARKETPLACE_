import mongoose, { Schema, Document } from 'mongoose';
import { ICart } from '@shared/types';

export interface ICartSchema extends Omit<ICart, '_id' | 'updatedAt'>, Document {}

const cartSchema = new Schema<ICartSchema>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        priceSnapshotted: { type: Number },
        lockedAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

export const Cart = mongoose.model<ICartSchema>('Cart', cartSchema);
