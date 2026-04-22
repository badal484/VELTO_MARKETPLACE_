import mongoose, { Document, Schema } from 'mongoose';
import { IProduct, Category } from '@shared/types';

export interface IProductDocument extends Omit<IProduct, '_id' | 'createdAt'>, Document {
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema({
  seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shop: { type: Schema.Types.ObjectId, ref: 'Shop' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, enum: Object.values(Category), required: true },
  images: {
    type: [String],
    validate: [
      (arr: string[]) => arr.length >= 3 && arr.length <= 5,
      'Product must have between 3 and 5 images'
    ],
    required: true
  },
  stock: { type: Number, required: true, default: 1 },
  views: { type: Number, default: 0 },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ location: '2dsphere' });
productSchema.index({ title: 'text', description: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ shop: 1, isActive: 1 });

export const Product = mongoose.model<IProductDocument>('Product', productSchema);