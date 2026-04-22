import { Types } from 'mongoose';

export enum Role {
  BUYER = 'buyer',
  SELLER = 'seller',
  SHOP_OWNER = 'shop_owner',
  RIDER = 'rider',
  ADMIN = 'admin',
}

export enum Category {
  ELECTRONICS = 'Electronics',
  CLOTHING = 'Clothing',
  FOOD = 'Food',
  BOOKS = 'Books',
  HOME = 'Home',
  BEAUTY = 'Beauty',
  SPORTS = 'Sports',
  TOYS = 'Toys',
  HEALTH = 'Health',
  OTHER = 'Other',
}

export enum OrderStatus {
  PENDING = 'Pending',
  PAYMENT_UNDER_REVIEW = 'Payment Under Review',
  CONFIRMED = 'Confirmed',
  READY_FOR_PICKUP = 'Ready for Pickup',
  SEARCHING_RIDER = 'Searching Rider',
  RIDER_ASSIGNED = 'Rider Assigned',
  AT_SHOP = 'At Shop',
  PICKED_UP = 'Picked Up',
  IN_TRANSIT = 'In Transit',
  DELIVERED = 'Delivered',
  COMPLETED_PENDING_RELEASE = 'Completed Pending Release',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  PRICE_LOCKED = 'Price Locked',
}

export enum PayoutRequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export type MongoId = string | Types.ObjectId;

export interface IAddress {
  _id?: MongoId;
  label?: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault?: boolean;
}

export interface IUser {
  _id: MongoId;
  name: string;
  email: string;
  role: Role;
  location?: {
    type: string;
    coordinates: [number, number];
  };
  avatar?: string;
  phoneNumber?: string;
  fcmTokens?: string[];
  addresses?: IAddress[];
  isRiderVerified?: boolean;
  isShopVerified?: boolean;
  riderStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  riderRejectionReason?: string;
  riderDocuments?: string[];
  licenseNumber?: string;
  vehicleDetails?: {
    type?: string;
    model?: string;
    number?: string;
  };
  walletBalance?: number;
  cashInHand?: number;
  cashLimit?: number;
  isBlocked?: boolean;
  createdAt?: string | Date;
}

export interface IShop {
  _id: MongoId;
  owner: MongoId;
  name: string;
  businessName: string;
  description: string;
  aadharCard: string;
  gstin?: string;
  address: string;
  detailedAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  location: {
    type: string;
    coordinates: [number, number];
  };
  bankDetails: {
    holderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  contactInfo: {
    businessEmail: string;
    businessPhone: string;
  };
  category: Category;
  logo?: string;
  isVerified?: boolean;
  isTermsAccepted?: boolean;
  rejectionReason?: string;
  verifiedAt?: Date;
  createdAt?: string | Date;
  stats?: {
    totalRevenue?: number;
    listingCount?: number;
    orderCount?: number;
    completedOrders?: number;
    avgRating?: number;
    productCount?: number;
    reliabilityScore?: number;
  };
  totalRevenue?: number;
  listingCount?: number;
}

export interface IProduct {
  _id: MongoId;
  seller: MongoId;
  shop?: MongoId | IShop;
  title: string;
  description: string;
  price: number;
  category: Category;
  images: string[];
  stock: number;
  views?: number;
  location: {
    type: string;
    coordinates: [number, number];
    address?: string;
  };
  rating?: number;
  numReviews?: number;
  isWishlisted?: boolean;
  isNearby?: boolean;
  distance?: number;
  createdAt?: string | Date;
}

export interface IOrder {
  _id: MongoId;
  buyer: MongoId;
  seller: MongoId;
  shop: MongoId;
  product: MongoId | IProduct;
  quantity: number;
  totalPrice: number;
  status: OrderStatus;
  paymentMethod: 'Cash on Pickup' | 'Cash on Delivery' | 'Razorpay';
  rider?: MongoId;
  pickupCode: string;
  deliveryCode?: string;
  cancellationReason?: string;
  fulfillmentMethod: 'delivery' | 'pickup';
  deliveryCharge?: number;
  deliveryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
  };
  buyerPhone: string;
  paymentReference?: string;
  isReviewed?: boolean;
  pickupLocation?: {
    type: string;
    coordinates: [number, number];
  };
  deliveryLocation?: {
    type: string;
    coordinates?: [number, number];
  };
  deliveredAt?: Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  razorpayOrderId?: string;
}

export interface IReview {
  _id: MongoId;
  user: MongoId;
  product: MongoId;
  order: MongoId;
  rating: number;
  comment: string;
  createdAt?: string | Date;
}

export interface IMessage {
  _id?: MongoId;
  conversationId: MongoId;
  sender: MongoId;
  receiver: MongoId;
  text: string;
  read?: boolean;
  isSystem?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface IConversation {
  _id: MongoId;
  participants: MongoId[];
  product?: MongoId;
  order?: MongoId;
  lastMessage?: string;
  updatedAt?: string | Date;
}

export interface ICartItem {
  product: MongoId | IProduct;
  quantity: number;
  priceSnapshotted?: number;
  lockedAt?: Date;
}

export interface ICart {
  _id: MongoId;
  user: MongoId;
  items: ICartItem[];
  updatedAt?: string | Date;
}

export interface IWishlist {
  _id: MongoId;
  user: MongoId;
  products: MongoId[];
}

export interface IWalletTransaction {
  _id: MongoId;
  user: MongoId;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  orderId?: MongoId;
  payoutId?: MongoId;
  createdAt?: string | Date;
}

export interface IPayoutRequest {
  _id: MongoId;
  rider: MongoId;
  amount: number;
  bankDetails: {
    holderName: string;
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  status: PayoutRequestStatus;
  adminNote?: string;
  transactionId?: string;
  processedAt?: Date;
  createdAt?: string | Date;
}
