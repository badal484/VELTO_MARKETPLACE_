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

    // seller and shop are required for marketplace orders but start as null
    // for pharmacy broadcast orders until a shop accepts
    seller: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    shop:   { type: Schema.Types.ObjectId, ref: 'Shop', default: null },

    // product is only set for marketplace orders
    product: { type: Schema.Types.ObjectId, ref: 'Product', default: null },

    productSnapshot: {
      title:         { type: String },
      image:         { type: String },
      originalPrice: { type: Number },
      category:      { type: String },
    },

    // ─── Pharmacy-specific fields ───────────────────────────────────────────
    orderType: {
      type: String,
      enum: ['marketplace', 'pharmacy'],
      default: 'marketplace',
    },
    catalogItems: [
      {
        catalogItem: { type: Schema.Types.ObjectId, ref: 'PharmacyCatalog' },
        name:        { type: String },   // snapshot at order time
        mrp:         { type: Number },   // snapshot at order time
        quantity:    { type: Number, min: 1 },
      },
    ],
    // shops notified during broadcasting
    broadcastedTo: [{ type: Schema.Types.ObjectId, ref: 'Shop' }],
    // when the broadcast window expires (10 min from creation)
    broadcastExpiry: { type: Date },
    // original prescription stored privately by Velto — never sent to shop
    prescriptionImageUrl: { type: String, default: null },
    // redacted prescription (phone numbers blacked out) — shown to pharmacist
    prescriptionRedactedUrl: { type: String, default: null },
    prescriptionConsent: { type: Boolean, default: false },
    // ────────────────────────────────────────────────────────────────────────

    quantity:       { type: Number, default: 1 },
    totalPrice:     { type: Number, required: true },
    status: {
      type:    String,
      enum:    Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash on Pickup', 'Cash on Delivery', 'Razorpay', 'Direct UPI Transfer'] as const,
      required: true,
    },
    razorpayOrderId:   { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paymentReference:  { type: String },
    rider:             { type: Schema.Types.ObjectId, ref: 'User' },
    pickupCode:        { type: String },
    deliveryCode:      { type: String },
    cancellationReason: { type: String },
    fulfillmentMethod: {
      type:     String,
      enum:     ['delivery'],
      required: true,
      default:  'delivery',
    },
    deliveryCharge:  { type: Number, default: 0 },
    deliveryAddress: {
      street:   String,
      city:     String,
      state:    String,
      pincode:  String,
      landmark: String,
    },
    buyerPhone:    { type: String, required: true },
    isReviewed:    { type: Boolean, default: false },
    pickupLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    deliveryLocation: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    deliveredAt:       { type: Date },
    walletAmountPaid:  { type: Number, default: 0 },
    refundDestination: { type: String, enum: ['wallet', 'bank', 'both'], default: 'wallet' },
    refundStatus:      { type: String, enum: ['pending', 'completed', 'none'], default: 'none' },
  },
  { timestamps: true }
);

// Validate: marketplace orders must have seller + shop + product
orderSchema.pre('save', function (next) {
  const doc = this as any;
  if (doc.orderType === 'marketplace') {
    if (!doc.seller || !doc.shop || !doc.product) {
      return next(new Error('Marketplace orders require seller, shop, and product'));
    }
  }
  next();
});

orderSchema.index({ pickupLocation: '2dsphere' });
orderSchema.index({ status: 1, rider: 1 });
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ shop: 1, createdAt: -1 });
// Fast recovery of stale pharmacy broadcasts on server restart
orderSchema.index({ orderType: 1, status: 1, broadcastExpiry: 1 });

export const Order = mongoose.model<IOrderSchema>('Order', orderSchema);
