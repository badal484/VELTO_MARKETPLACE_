import mongoose, { Document, Schema } from 'mongoose';
import { IShop, Category } from '@shared/types';

export interface IShopDocument extends Omit<IShop, '_id' | 'createdAt'>, Document {
  createdAt: Date;
  updatedAt: Date;
}

const shopSchema = new Schema<IShopDocument>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  businessName: { type: String, required: true },
  description: { type: String, required: true },
  aadharCard: { type: String, required: true },
  gstin: { type: String },
  address: { type: String, required: true },
  detailedAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true }
  },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  bankDetails: {
    holderName: { type: String, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    ifscCode: { type: String, required: true }
  },
  contactInfo: {
    businessEmail: { type: String, required: true },
    businessPhone: { type: String, required: true }
  },
  category: { type: String, enum: Object.values(Category), required: true },
  logo: { type: String },
  coverImage: { type: String },
  isVerified: { type: Boolean, default: false },
  isTermsAccepted: { type: Boolean, required: true, default: false },
  rejectionReason: { type: String },
  verifiedAt: { type: Date }
}, { timestamps: true });

shopSchema.index({ location: '2dsphere' });
shopSchema.index({ isVerified: 1 });

export const Shop = mongoose.model<IShopDocument>('Shop', shopSchema);