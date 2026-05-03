import { z } from 'zod';
import { OrderStatus, Category } from './types';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createOrderSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive().default(1),
  paymentMethod: z.enum(['Cash on Pickup', 'Cash on Delivery', 'Razorpay']),
  fulfillmentMethod: z.enum(['delivery', 'pickup']).default('pickup'),
  deliveryCharge: z.number().nonnegative().optional(),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    landmark: z.string().optional(),
  }).optional(),
  buyerPhone: z.string().min(10, 'Valid phone number required'),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancellationReason: z.string().optional(),
});

export const createProductSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().positive('Price must be positive'),
  category: z.nativeEnum(Category),
  stock: z.number().int().nonnegative().default(1),
  lat: z.number(),
  lng: z.number(),
});

export const createShopSchema = z.object({
  name: z.string().min(2, 'Shop name is required'),
  businessName: z.string().min(2, 'Business name is required'),
  description: z.string().min(10, 'Description is required'),
  aadharCard: z.string().min(12, 'Valid Aadhar number required'),
  gstin: z.string().optional(),
  address: z.string().min(5, 'Address is required'),
  detailedAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    pincode: z.string(),
  }),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  bankDetails: z.object({
    holderName: z.string(),
    bankName: z.string(),
    accountNumber: z.string(),
    ifscCode: z.string(),
  }),
  contactInfo: z.object({
    businessEmail: z.string().email(),
    businessPhone: z.string(),
  }),
  category: z.nativeEnum(Category),
  isTermsAccepted: z.boolean(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: z.string().optional(),
  avatar: z.string().optional(),
});

export const addressSchema = z.object({
  label: z.string().default('Home'),
  street: z.string().min(3, 'Street is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().min(4, 'Pincode is required'),
  landmark: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const riderRegisterSchema = z.object({
  licenseNumber: z.string().min(5, 'License number is required'),
  phoneNumber: z.string().min(10, 'Valid phone number is required'),
  vehicleDetails: z.object({
    type: z.string(),
    model: z.string(),
    number: z.string(),
  }),
  bankDetails: z.object({
    holderName: z.string(),
    bankName: z.string(),
    accountNumber: z.string(),
    ifscCode: z.string(),
  }),
});
