import mongoose, { Schema, Document } from 'mongoose';
import { IReview } from '@shared/types';

export interface IReviewDocument extends Omit<IReview, '_id' | 'createdAt'>, Document {
  createdAt: Date;
}

const reviewSchema = new Schema<IReviewDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

// Index for fast lookups by product
reviewSchema.index({ product: 1, createdAt: -1 });
// Ensure one review per order
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

export const Review = mongoose.model<IReviewDocument>('Review', reviewSchema);
