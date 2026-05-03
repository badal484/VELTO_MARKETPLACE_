import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown} from 'react-native-reanimated';

interface INotification {
  _id: string;
  type: 'ORDER' | 'SHOP' | 'SYSTEM';
  title: string;
  message: string;
  isRead: boolean;
  data?: {
    orderId?: string;
    productId?: string;
    shopId?: string;
  };
  createdAt: string;
}

import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { HomeStackParamList } from '../../navigation/types';

import {useNotifications} from '../../context/NotificationContext';

import {Role} from '@shared/types';
import {useAuth} from '../../hooks/useAuth';
import {useSocket} from '../../hooks/useSocket';
import {SocketEvent} from '@shared/constants/socketEvents';

export default function NotificationsScreen() {
  const {user} = useAuth();
  const navigation = useNavigation<StackNavigationProp<HomeStackParamList>>();
  const {resetUnreadCount} = useNotifications();
  const {socket, isConnected} = useSocket();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
    resetUnreadCount();
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('new_notification', () => {
        fetchNotifications();
      });
    }
    return () => {
      if (socket) socket.off('new_notification');
    };
  }, [socket, isConnected]);

  const fetchNotifications = async () => {
    try {
      const res = await axiosInstance.get('/api/notifications');
      setNotifications(res.data.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await axiosInstance.patch(`/api/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n._id === id ? {...n, isRead: true} : n)),
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleNotificationPress = async (item: INotification) => {
    if (!item.isRead) {
      markAsRead(item._id);
    }

    // Deep linking logic based on role and type
    if (item.type === 'ORDER') {
      if (user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) {
        (navigation.navigate as any)('DashboardTab', { screen: 'SellerOrders' });
      } else {
        (navigation.navigate as any)('MainTabs', { screen: 'ProfileTab', params: { screen: 'OrderHistory' } });
      }
    } else if (item.type === 'SHOP') {
      (navigation.navigate as any)('DashboardTab');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.patch('/api/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const renderNotification = ({item, index}: {item: INotification; index: number}) => (
    <Animated.View entering={FadeInDown.delay(index * 50)}>
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        style={[
          styles.notifCard,
          !item.isRead && styles.unreadCard,
        ]}>
        <View style={styles.iconBox}>
          <Icon 
            name={item.type === 'ORDER' ? 'cart' : 'business'} 
            size={20} 
            color={theme.colors.text} 
          />
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleDateString()} at {new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  if (loading && !refreshing) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Notifications</Text>
        {notifications.some(n => !n.isRead) && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item._id}
        renderItem={renderNotification}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Icon name="notifications-off-outline" size={48} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>You don't have any notifications right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  navTitle: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  markAll: {fontSize: 14, fontWeight: '700', color: theme.colors.primary},
  list: {padding: 16, paddingBottom: 40},
  notifCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  unreadCard: {
    backgroundColor: '#F8FAFC',
    borderColor: theme.colors.primary + '15',
    borderWidth: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {flex: 1},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  title: {fontSize: 16, fontWeight: '800', color: theme.colors.text},
  unreadDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent},
  message: {fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, fontWeight: '500'},
  time: {fontSize: 11, color: theme.colors.muted, marginTop: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5},
  empty: {flex: 1, alignItems: 'center', marginTop: 120, paddingHorizontal: 40},
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadow.md,
  },
  emptyTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  emptyText: {marginTop: 12, fontSize: 14, color: theme.colors.muted, textAlign: 'center', lineHeight: 22},
});

