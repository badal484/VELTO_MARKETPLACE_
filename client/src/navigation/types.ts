import { IProduct, IUser } from '@shared/types';

export type HomeStackParamList = {
  Home: undefined;
  ProductDetail: {id: string};
  ShopProfile: {id: string};
  Checkout: {products: {product: IProduct, quantity: number}[]};
  OrderSuccess: {orderId: string};
  Notifications: undefined;
};

export type BrowseStackParamList = {
  Browse: {category?: string; search?: string} | undefined;
  ProductDetail: {id: string};
  ShopProfile: {id: string};
  Checkout: {products: {product: IProduct, quantity: number}[]};
  OrderSuccess: {orderId: string};
};

export type ChatStackParamList = {
  Conversations: undefined;
  ChatRoom: {conversationId: string; otherUser: IUser; orderId?: string; productTitle?: string; productId?: string; shopName?: string; shopLogo?: string};
  ProductDetail: {id: string};
  ShopProfile: {id: string};
};

export type DashboardStackParamList = {
  Dashboard: undefined;
  Wallet: undefined;
  AddEditListing: {product?: IProduct};
  ShopSetup: undefined;
  ManageInventory: undefined;
  SellerOrders: undefined;
  ProductDetail: {id: string};
  ShopProfile: {id: string};
};

export type ProfileStackParamList = {
  Profile: undefined;
  OrderHistory: undefined;
  ShopSetup: undefined;
  Wishlist: undefined;
  PersonalDetails: undefined;
  AddEditAddress: { address?: any };
  RiderSetup: undefined;
  ProductDetail: {id: string};
  ShopProfile: {id: string};
};

export type CartStackParamList = {
  Cart: undefined;
  Checkout: {products: {product: IProduct, quantity: number}[]};
  ProductDetail: {id: string};
  ShopProfile: {id: string};
};

export type MainTabParamList = {
  HomeTab: undefined;
  BrowseTab: {screen?: string; params?: Record<string, unknown>} | undefined;
  CartTab: undefined;
  ChatTab: undefined;
  DashboardTab: undefined;
  ProfileTab: undefined;
  AdminTab: undefined;
};