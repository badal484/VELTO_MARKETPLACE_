import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {useAuth} from '../hooks/useAuth';
import {Role} from '@shared/types';
import Icon from 'react-native-vector-icons/Ionicons';
import {AdminNavigator} from './AdminNavigator';
import {useNotifications} from '../context/NotificationContext';

import {theme} from '../theme';
import HomeScreen from '../screens/buyer/HomeScreen';
import BrowseScreen from '../screens/buyer/BrowseScreen';
import ProductDetailScreen from '../screens/buyer/ProductDetailScreen';
import ShopProfileScreen from '../screens/buyer/ShopProfileScreen';
import CartScreen from '../screens/buyer/CartScreen';
import WishlistScreen from '../screens/buyer/WishlistScreen';
import CheckoutScreen from '../screens/buyer/CheckoutScreen';

import DashboardScreen from '../screens/seller/DashboardScreen';
import AddEditListingScreen from '../screens/seller/AddEditListingScreen';
import ShopSetupScreen from '../screens/seller/ShopSetupScreen';
import InventoryScreen from '../screens/seller/InventoryScreen';

import OrderSuccessScreen from '../screens/buyer/OrderSuccessScreen';

import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';

import ProfileScreen from '../screens/profile/ProfileScreen';
import OrderHistoryScreen from '../screens/profile/OrderHistoryScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';
import PersonalDetailsScreen from '../screens/profile/PersonalDetailsScreen';
import AddEditAddressScreen from '../screens/profile/AddEditAddressScreen';
import RiderSetupScreen from '../screens/rider/RiderSetupScreen';
import WalletScreen from '../screens/rider/WalletScreen';
import {RiderNavigator} from './RiderNavigator';
import SellerOrdersScreen from '../screens/seller/SellerOrdersScreen';
import SupportScreen from '../screens/profile/SupportScreen';

// --- Navigator Instances ---
const RootStack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator(); // Local stacks for tab sections

const HomeStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Home" component={HomeScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
  </Stack.Navigator>
);

const BrowseStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Browse" component={BrowseScreen} />
  </Stack.Navigator>
);

const DashboardStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="Wallet" component={WalletScreen} />
    <Stack.Screen name="AddEditListing" component={AddEditListingScreen as React.FC} />
    <Stack.Screen name="ShopSetup" component={ShopSetupScreen} />
    <Stack.Screen name="ManageInventory" component={InventoryScreen} />
    <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
    <Stack.Screen name="ShopSetup" component={ShopSetupScreen} />
    <Stack.Screen name="Wishlist" component={WishlistScreen} />
    <Stack.Screen name="PersonalDetails" component={PersonalDetailsScreen} />
    <Stack.Screen name="AddEditAddress" component={AddEditAddressScreen} />
    <Stack.Screen name="RiderSetup" component={RiderSetupScreen} />
  </Stack.Navigator>
);

const CartStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="Cart" component={CartScreen} />
  </Stack.Navigator>
);

const ChatStack = () => (
  <Stack.Navigator screenOptions={{headerShown: false}}>
    <Stack.Screen name="ChatList" component={ConversationsScreen} />
  </Stack.Navigator>
);

const MainTabs = () => {
  const {user} = useAuth();
  const {unreadChatCount} = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarIcon: ({color, size}) => {
          let iconName: string = 'home-outline';
          if (route.name === 'HomeTab') {
            iconName = 'home-outline';
          } else if (route.name === 'BrowseTab') {
            iconName = 'search-outline';
          } else if (route.name === 'CartTab') {
            iconName = 'bag-handle-outline';
          } else if (route.name === 'DashboardTab') {
            iconName = 'grid-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = 'person-outline';
          } else if (route.name === 'AdminTab') {
            iconName = 'shield-checkmark-outline';
          } else if (route.name === 'RiderTab') {
            iconName = 'bicycle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: theme.colors.white,
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
        },
      })}>
      {/* Buyer & Admin Specific Tabs */}
      {(user?.role === Role.BUYER || user?.role === Role.ADMIN) && (
        <>
          <Tab.Screen
            name="HomeTab"
            component={HomeStack}
            options={{title: 'Home'}}
          />
          <Tab.Screen
            name="BrowseTab"
            component={BrowseStack}
            options={{title: 'Search'}}
            listeners={({navigation}) => ({
              tabPress: (e) => {
                e.preventDefault();
                navigation.navigate('BrowseTab', {screen: 'Browse'});
              },
            })}
          />
          <Tab.Screen
            name="CartTab"
            component={CartStack}
            options={{title: 'Cart'}}
          />
        </>
      )}

      {/* Seller Specific Tab */}
      {(user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) && (
        <Tab.Screen
          name="DashboardTab"
          component={DashboardStack}
          options={{title: 'Merchant'}}
        />
      )}



      {/* Rider Specific Tab */}
      {user?.role === Role.RIDER && (
        <Tab.Screen
          name="RiderTab"
          component={RiderNavigator}
          options={{title: 'Delivery'}}
        />
      )}

      {/* Admin Specific Tab */}
      {user?.role === Role.ADMIN && (
        <Tab.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{title: 'Admin'}}
        />
      )}


      {/* Profile Tab - Global */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

export const MainNavigator = () => {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      
      {/* Shared Screens available from any tab */}
      <RootStack.Screen name="ChatRoom" component={ChatScreen as React.FC} />
      <RootStack.Screen name="Conversations" component={ConversationsScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="ProductDetail" component={ProductDetailScreen as React.FC} />
      <RootStack.Screen name="ShopProfile" component={ShopProfileScreen} />
      <RootStack.Screen name="Checkout" component={CheckoutScreen as React.FC} />
      <RootStack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
      <RootStack.Screen name="Support" component={SupportScreen} />
    </RootStack.Navigator>
  );
};