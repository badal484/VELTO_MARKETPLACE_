export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: {email?: string} | undefined;
  ResetPassword: {email: string};
  VerifyOTP: {email: string; type: 'register' | 'forgot_password'};
};

export type ChatStackParamList = {
  Conversations: undefined;
  ChatRoom: {
    conversationId: string;
    otherUser: {
      _id: string;
      name: string;
      role: string;
      avatar?: string;
    };
    productTitle?: string;
    productId?: string;
    shopName?: string;
    shopLogo?: string;
    orderId?: string;
  };
};

export type DashboardStackParamList = {
  Dashboard: undefined;
  Wallet: undefined;
  AddEditListing: {product?: any};
  ShopSetup: undefined;
  ManageInventory: undefined;
  SellerOrders: undefined;
  Notifications: undefined;
  PharmacyBroadcasts: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  BrowseTab: {screen?: string};
  CartTab: undefined;
  DashboardTab: {screen?: string};
  ProfileTab: {screen?: string};
  AdminTab: undefined;
  RiderTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  ProductDetail: {id: string};
  ShopProfile: {id: string};
  Checkout: {products: Array<{product: any; quantity: number}>};
  OrderSuccess: {
    orderId?: string;
    paymentMethod?: string;
    fulfillmentMethod?: 'delivery' | 'pickup';
    deliveryCode?: string | null;
    pickupCode?: string | null;
    isPharmacy?: boolean;
  };
  Support: undefined;
  Conversations: undefined;
  ChatRoom: ChatStackParamList['ChatRoom'];
  PharmacyHome: {coords?: {lat: number; lng: number}} | undefined;
  PharmacyCheckout: {
    cart: any[];
    coords?: {lat: number; lng: number};
    openPrescription?: boolean;
  };
};

export type BrowseStackParamList = {
  Browse: undefined;
  ProductDetail: {id: string};
};

export type CartStackParamList = {
  Cart: undefined;
  Checkout: {products: Array<{product: any; quantity: number}>};
};

export type ProfileStackParamList = {
  Profile: undefined;
  OrderHistory: undefined;
  ShopSetup: undefined;
  Wishlist: undefined;
  PersonalDetails: undefined;
  AddEditAddress: Record<string, unknown> | undefined;
  RiderSetup: undefined;
  ProductDetail: {id: string};
  Support: undefined;
};