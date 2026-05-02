import mongoose, { Document, Schema } from 'mongoose';
import { IUser, Role } from '@shared/types';

export interface IUserDocument extends Omit<IUser, '_id' | 'createdAt'>, Document {
  password?: string;
  isBlocked?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: Object.values(Role), default: Role.BUYER },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }
  },
  avatar: { type: String },
  phoneNumber: { type: String },
  fcmTokens: { type: [String], default: [] },
  addresses: [{
    label: { type: String, default: 'Home' },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: { type: String },
    isDefault: { type: Boolean, default: false }
  }],
  // Rider Specific Fields
  isRiderVerified: { type: Boolean, default: false },
  riderStatus: { 
    type: String, 
    enum: ['none', 'pending', 'verified', 'rejected'], 
    default: 'none' 
  },
  riderRejectionReason: { type: String },
  riderDocuments: [{ type: String }],
  licenseNumber: { type: String },
  vehicleDetails: {
    type: { type: String }, // Bike, Scooter, Cycle
    model: { type: String },
    number: { type: String }
  },
  walletBalance: { type: Number, default: 0 },
  cashInHand: { type: Number, default: 0 },  // Cash collected from COD
  bankDetails: {
    bankName: { type: String },
    holderName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String }
  },
  isOnline: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

export const User = mongoose.model<IUserDocument>('User', userSchema);
