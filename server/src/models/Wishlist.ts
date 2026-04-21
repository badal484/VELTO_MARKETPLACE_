import mongoose, { Schema, Document } from 'mongoose';
import { IWishlist } from '@shared/types';

export interface IWishlistSchema extends Omit<IWishlist, '_id'>, Document {}

const wishlistSchema = new Schema<IWishlistSchema>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

export const Wishlist = mongoose.model<IWishlistSchema>('Wishlist', wishlistSchema);
