import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import RiderDashboardScreen from '../screens/rider/RiderDashboardScreen';
import WalletScreen from '../screens/rider/WalletScreen';
import ProductDetailScreen from '../screens/buyer/ProductDetailScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import {IProduct, IUser} from '@shared/types';

export type RiderStackParamList = {
  RiderDashboard: undefined;
  Wallet: undefined;
  OrderDetail: {orderId: string};
  ProductDetail: {id: string};
  ChatRoom: {
    conversationId: string;
    otherUser: Partial<IUser>;
    productTitle?: string;
    productId?: string;
    orderId?: string;
  };
};

const Stack = createStackNavigator<RiderStackParamList>();

export const RiderNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="RiderDashboard" component={RiderDashboardScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="ChatRoom" component={ChatScreen} />
    </Stack.Navigator>
  );
};
