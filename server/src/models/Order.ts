import mongoose, { Schema, Document } from 'mongoose';
import { IOrder, OrderStatus } from '@shared/types';

export interface IOrderSchema extends Omit<IOrder, '_id' | 'createdAt' | 'updatedAt'>, Document {
  productSnapshot?: {
    title: string;
    image: string;
    originalPrice: number;
    category?: string;
  };
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

const orderSchema = new Schema<IOrderSchema>(
  {
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: {
      title: { type: String, required: true },
      image: { type: String, required: true },
      originalPrice: { type: Number, required: true },
      category: { type: String }
    },
    quantity: { type: Number, required: true, default: 1 },
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash on Pickup', 'Cash on Delivery', 'Razorpay'] as const,
      required: true,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paymentReference: { type: String },
    rider: { type: Schema.Types.ObjectId, ref: 'User' },
    pickupCode: { type: String, required: true },
    deliveryCode: { type: String },
    cancellationReason: { type: String },
    fulfillmentMethod: { 
      type: String, 
      enum: ['delivery', 'pickup'], 
      required: true,
      default: 'pickup'
    },
    deliveryCharge: { type: Number, default: 0 },
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    buyerPhone: { type: String, required: true },
    isReviewed: { type: Boolean, default: false },
    pickupLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }
    },
    deliveryLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }
    },
    deliveredAt: { type: Date }
  },
  { timestamps: true }
);

orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ status: 1, rider: 1 });
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ shop: 1, createdAt: -1 });

export const Order = mongoose.model<IOrderSchema>('Order', orderSchema);

