import mongoose, { Document, Schema } from 'mongoose';
import { Category } from '@shared/types';

export interface IBanner {
  _id?: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: Category;
  isActive: boolean;
  createdAt?: Date;
}

export interface IBannerDocument extends Omit<IBanner, '_id' | 'createdAt'>, Document {
  createdAt: Date;
}

const bannerSchema = new Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  imageUrl: { type: String, required: true },
  category: { type: String, enum: Object.values(Category), required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Banner = mongoose.model<IBannerDocument>('Banner', bannerSchema);