"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riderRegisterSchema = exports.addressSchema = exports.updateProfileSchema = exports.createShopSchema = exports.createProductSchema = exports.updateOrderStatusSchema = exports.createOrderSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("./types");
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.string().optional(),
    phoneNumber: zod_1.z.string().optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.createOrderSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, 'Product ID is required'),
    quantity: zod_1.z.number().int().positive().default(1),
    paymentMethod: zod_1.z.enum(['Cash on Pickup', 'Cash on Delivery', 'Razorpay']),
    fulfillmentMethod: zod_1.z.enum(['delivery', 'pickup']).default('pickup'),
    deliveryCharge: zod_1.z.number().nonnegative().optional(),
    deliveryAddress: zod_1.z.object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        pincode: zod_1.z.string().optional(),
        landmark: zod_1.z.string().optional(),
    }).optional(),
    buyerPhone: zod_1.z.string().min(10, 'Valid phone number required'),
    lat: zod_1.z.number().optional(),
    lng: zod_1.z.number().optional(),
});
exports.updateOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(types_1.OrderStatus),
    cancellationReason: zod_1.z.string().optional(),
});
exports.createProductSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, 'Title must be at least 3 characters'),
    description: zod_1.z.string().min(10, 'Description must be at least 10 characters'),
    price: zod_1.z.number().positive('Price must be positive'),
    category: zod_1.z.nativeEnum(types_1.Category),
    stock: zod_1.z.number().int().nonnegative().default(1),
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
});
exports.createShopSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Shop name is required'),
    businessName: zod_1.z.string().min(2, 'Business name is required'),
    description: zod_1.z.string().min(10, 'Description is required'),
    aadharCard: zod_1.z.string().min(12, 'Valid Aadhar number required'),
    gstin: zod_1.z.string().optional(),
    address: zod_1.z.string().min(5, 'Address is required'),
    detailedAddress: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        pincode: zod_1.z.string(),
    }),
    location: zod_1.z.object({
        lat: zod_1.z.number(),
        lng: zod_1.z.number(),
    }),
    bankDetails: zod_1.z.object({
        holderName: zod_1.z.string(),
        bankName: zod_1.z.string(),
        accountNumber: zod_1.z.string(),
        ifscCode: zod_1.z.string(),
    }),
    contactInfo: zod_1.z.object({
        businessEmail: zod_1.z.string().email(),
        businessPhone: zod_1.z.string(),
    }),
    category: zod_1.z.nativeEnum(types_1.Category),
    isTermsAccepted: zod_1.z.boolean(),
});
exports.updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    phoneNumber: zod_1.z.string().optional(),
    avatar: zod_1.z.string().optional(),
});
exports.addressSchema = zod_1.z.object({
    label: zod_1.z.string().default('Home'),
    street: zod_1.z.string().min(3, 'Street is required'),
    city: zod_1.z.string().min(2, 'City is required'),
    state: zod_1.z.string().min(2, 'State is required'),
    pincode: zod_1.z.string().min(4, 'Pincode is required'),
    landmark: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean().optional(),
});
exports.riderRegisterSchema = zod_1.z.object({
    licenseNumber: zod_1.z.string().min(5, 'License number is required'),
    phoneNumber: zod_1.z.string().min(10, 'Valid phone number is required'),
    vehicleDetails: zod_1.z.object({
        type: zod_1.z.string(),
        model: zod_1.z.string(),
        number: zod_1.z.string(),
    }),
    bankDetails: zod_1.z.object({
        holderName: zod_1.z.string(),
        bankName: zod_1.z.string(),
        accountNumber: zod_1.z.string(),
        ifscCode: zod_1.z.string(),
    }),
});
