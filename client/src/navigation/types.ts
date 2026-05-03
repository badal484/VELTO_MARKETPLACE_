export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: {email?: string};
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