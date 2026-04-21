import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import {theme} from '../theme';

import AdminOverviewScreen from '../screens/admin/AdminOverviewScreen';
import AdminPendingShopsScreen from '../screens/admin/AdminPendingShopsScreen';
import AdminAllShopsScreen from '../screens/admin/AdminAllShopsScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import AdminProductsScreen from '../screens/admin/AdminProductsScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import AdminPayoutsScreen from '../screens/admin/AdminPayoutsScreen';
import ConversationsScreen from '../screens/chat/ConversationsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import AdminBannerManagementScreen from '../screens/admin/AdminBannerManagementScreen';
import { createStackNavigator } from '@react-navigation/stack';

const SupportStack = createStackNavigator();

const AdminSupportStack = () => (
  <SupportStack.Navigator screenOptions={{ headerShown: false }}>
    <SupportStack.Screen name="SupportInbox" component={ConversationsScreen} />
    <SupportStack.Screen name="ChatRoom" component={ChatScreen} />
  </SupportStack.Navigator>
);

const Tab = createBottomTabNavigator();

export const AdminNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerTitleStyle: {
          fontWeight: '800',
          color: theme.colors.primary,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          paddingBottom: 5,
          height: 60,
        },
        tabBarIcon: ({color, size}) => {
          let iconName = 'analytics-outline';
          if (route.name === 'Overview') {
            iconName = 'analytics-outline';
          } else if (route.name === 'Pending') {
            iconName = 'time-outline';
          } else if (route.name === 'All Shops') {
            iconName = 'storefront-outline';
          } else if (route.name === 'Users') {
            iconName = 'people-outline';
          } else if (route.name === 'Products') {
            iconName = 'cube-outline';
          } else if (route.name === 'Orders') {
            iconName = 'cart-outline';
          } else if (route.name === 'Support') {
            iconName = 'chatbubbles-outline';
          } else if (route.name === 'Payouts') {
            iconName = 'cash-outline';
          } else if (route.name === 'Banners') {
            iconName = 'images-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen name="Overview" component={AdminOverviewScreen} />
      <Tab.Screen
        name="Pending"
        component={AdminPendingShopsScreen}
        options={{tabBarBadge: undefined, title: 'Pending'}} // In a real app we'd dynamically fetch the badge count
      />
      <Tab.Screen name="All Shops" component={AdminAllShopsScreen} />
      <Tab.Screen name="Users" component={AdminUsersScreen} />
      <Tab.Screen name="Products" component={AdminProductsScreen} />
      <Tab.Screen name="Orders" component={AdminOrdersScreen} />
      <Tab.Screen name="Payouts" component={AdminPayoutsScreen} />
      <Tab.Screen name="Banners" component={AdminBannerManagementScreen} />
      <Tab.Screen name="Support" component={AdminSupportStack} />
    </Tab.Navigator>
  );
};