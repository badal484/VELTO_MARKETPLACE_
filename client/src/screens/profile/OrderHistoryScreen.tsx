import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import { IOrder, IProduct, IShop, OrderStatus, Role } from '@shared/types';
import { getStatusDisplay } from '@shared/constants/orderStatus';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {CompositeNavigationProp} from '@react-navigation/native';
import {
  ProfileStackParamList,
  MainTabParamList,
} from '../../navigation/types';
import {ReviewModal} from '../../components/common/ReviewModal';
import {useToast} from '../../hooks/useToast';
import {useSocket} from '../../hooks/useSocket';
import {useAuth} from '../../hooks/useAuth';

type OrderHistoryScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'OrderHistory'>,
  BottomTabNavigationProp<MainTabParamList>
>;

interface OrderHistoryScreenProps {
  navigation: OrderHistoryScreenNavigationProp;
}

export default function OrderHistoryScreen({
  navigation,
}: OrderHistoryScreenProps) {
  const {t} = useTranslation();
  const {user} = useAuth();
  const {showToast} = useToast();
  const {socket, isConnected} = useSocket();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [riderUpdates, setRiderUpdates] = useState<Record<string, string>>({});

  // Review state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{
    productId: string;
    orderId: string;
    productTitle: string;
  } | null>(null);

  // Toggle state for Sellers/Riders
  const [historyMode, setHistoryMode] = useState<'workspace' | 'purchases'>(
    (user?.role === Role.RIDER || user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) ? 'workspace' : 'purchases'
  );

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [historyMode])
  );

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('order_status_updated', (updatedOrder: IOrder) => {
        if (!updatedOrder?._id) return;
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
        const shortId = updatedOrder._id.slice(-6).toUpperCase();
        const statusLabel = (updatedOrder.status ?? '').replace(/_/g, ' ');
        showToast({ message: `Order #${shortId} status updated to ${statusLabel}`, type: 'info' });
      });

      socket.on('rider_location_updated', (data: {orderId: string, lat: number, lng: number, timestamp: string}) => {
        setRiderUpdates(prev => ({
           ...prev,
           [data.orderId]: 'Live tracking active: Rider is on the move'
        }));
      });
    }
    return () => {
      if (socket) {
        socket.off('order_status_updated');
        socket.off('rider_location_updated');
      }
    };
  }, [socket, isConnected]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let endpoint = '/api/orders/my'; // Default to personal purchases

      if (historyMode === 'workspace') {
        if (user?.role === Role.RIDER) {
          endpoint = '/api/orders/rider';
        } else if (user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) {
          endpoint = '/api/orders/seller';
        }
      }

      const res = await axiosInstance.get(endpoint);
      setOrders(res.data.data);
    } catch (e: unknown) {
      console.log('Error fetching orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleChat = async (receiverId: string, order: IOrder, role: string) => {
    try {
      const res = await axiosInstance.post('/api/chat', {
        receiverId,
        productId: (order.product as any)?._id || order.product,
        orderId: order._id
      });
      
      if (res.data.success) {
        const conversation = res.data.data;
        const otherUser = {
          _id: receiverId,
          name: role === 'rider' ? 'Rider' : (order.shop as any)?.name || 'Seller',
          avatar: role === 'rider' ? undefined : (order.shop as any)?.logo,
          role: role as any
        };

        (navigation as any).navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser,
          productTitle: (order.product as any)?.title,
          productId: (order.product as any)?._id || order.product,
          orderId: order._id
        });
      }
    } catch (err: any) {
       showToast({ message: err.response?.data?.message || 'Failed to start chat', type: 'error' });
    }
  };

  const handleSupport = async (order?: IOrder) => {
    try {
      const res = await axiosInstance.post('/api/chat/support', {
        orderId: order?._id,
        productId: order ? (order.product as any)?._id || order.product : undefined
      });
      
      if (res.data.success) {
        const conversation = res.data.data;
        const adminUser = (conversation.participants as any[]).find(p => p.role === 'admin');
        const adminId = adminUser?._id || (conversation.participants as any[]).find(p => typeof p === 'string' && p !== user?._id) || conversation.participants[1];

        (navigation as any).navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser: { 
            _id: adminId,
            name: adminUser?.name || 'Velto Support', 
            role: 'admin',
            avatar: adminUser?.avatar
          },
          productTitle: order ? (order.product as any)?.title : 'Support',
          orderId: order?._id
        });
      }
    } catch (err) {
      showToast({ message: 'Support team unavailable', type: 'error' });
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      setRefreshing(true);
      await axiosInstance.patch(`/api/orders/${orderId}/status`, { status: OrderStatus.COMPLETED });
      fetchOrders();
      showToast({ message: 'Delivery accepted. Funds released to merchant.', type: 'success' });
    } catch (err: any) {
      showToast({ message: err.response?.data?.message || 'Action failed', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const res = await axiosInstance.get(`/api/orders/${orderId}/invoice`);
      const downloadUrl = res.data.data.url;
      await Linking.openURL(downloadUrl);
    } catch (error) {
      showToast({message: 'Could not open invoice.', type: 'error'});
    }
  };

  const renderOrder = ({item, index}: {item: IOrder; index: number}) => {
    const { label, color } = getStatusDisplay(item.status as OrderStatus);
    const orderDate = new Date(item.createdAt ?? Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const product = item.product as unknown as IProduct;
    const shop = item.shop as unknown as IShop;

    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(600)}>
        <Card style={styles.orderCard} variant="elevated">
          <View style={styles.orderHeader}>
            <View style={styles.orderIdGroup}>
              <View style={styles.receiptIconBox}>
                <Icon
                  name="receipt-outline"
                  size={14}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.orderId}>
                #NB-{item._id.slice(-6).toUpperCase()}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {(String(item.status).toLowerCase() === 'completed' || 
                String(item.status).toLowerCase() === 'delivered' || 
                String(item.status).toLowerCase() === 'shipped') && (
                <TouchableOpacity 
                  style={styles.downloadIconBtn}
                  onPress={() => handleDownloadInvoice(item._id)}>
                  <Icon name="document-text-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              )}

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: color + '10',
                    borderColor: color + '20',
                  },
                ]}>
                <Text style={[styles.statusText, {color: color}]}>
                  {label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.productRow}>
            <View style={styles.productDetails}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {product?.title || 'Market Item'}
              </Text>
              <View style={styles.shopRow}>
                <Icon
                  name="storefront-outline"
                  size={12}
                  color={theme.colors.muted}
                />
                <Text style={styles.shopName}>
                  {shop?.name || 'Local Seller'}
                </Text>
              </View>
            </View>
            <View style={styles.priceColumn}>
              <Text style={styles.price}>₹{item.totalPrice}</Text>
              {(item.deliveryCharge ?? 0) > 0 && (
                <Text style={styles.deliveryFeeText}>Includes ₹{item.deliveryCharge} Delivery</Text>
              )}
              <Text style={styles.qtyText}>Qty: {item.quantity}</Text>
            </View>
          </View>



          {item.fulfillmentMethod === 'delivery' && item.deliveryAddress && (
            <View style={styles.addressSummaryCard}>
              <Text style={styles.addressSummaryText}>
                {item.deliveryAddress.street}, {item.deliveryAddress.city}, {item.deliveryAddress.state} - {item.deliveryAddress.pincode}
              </Text>
            </View>
          )}




          {item.status === OrderStatus.COMPLETED && item.isReviewed === false && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => {
                setSelectedOrder({
                  productId: (product as any)?._id || '',
                  orderId: item._id,
                  productTitle: product?.title || 'Product',
                });
                setReviewModalVisible(true);
              }}>
              <Icon name="star-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.reviewBtnText}>Review Product</Text>
            </TouchableOpacity>
          )}

          {item.isReviewed === true && (
            <View style={styles.reviewedBadge}>
              <Icon name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.reviewedText}>Reviewed</Text>
            </View>
          )}



          <View style={styles.divider} />

          <View style={styles.footer}>
            <View style={styles.footerItem}>
              <Icon name="card-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.footerValue}>{item.paymentMethod}</Text>
            </View>
          </View>

          {/* Real-time Tracking & Chat Actions */}
          <View style={styles.actionRow}>
            {item.status === OrderStatus.COMPLETED_PENDING_RELEASE && (
              <TouchableOpacity 
                style={[styles.chatActionBtn, {backgroundColor: '#ECFDF5', borderColor: '#10B981', flex: 2}]} 
                onPress={() => handleAcceptOrder(item._id)}>
                <Icon name="checkmark-circle" size={16} color="#059669" />
                <Text style={[styles.chatActionTxt, {color: '#059669'}]}>Accept Delivery</Text>
              </TouchableOpacity>
            )}

            {item.status !== OrderStatus.COMPLETED && item.status !== OrderStatus.CANCELLED && (
              <TouchableOpacity 
                style={styles.chatActionBtn} 
                onPress={() => handleSupport(item)}>
                <Icon name="help-buoy-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.chatActionTxt}>Contact Support</Text>
              </TouchableOpacity>
            )}

            {item.rider && item.status === OrderStatus.IN_TRANSIT && (
              <TouchableOpacity 
                style={[styles.chatActionBtn, {backgroundColor: '#EEF2FF', borderColor: '#818CF8'}]} 
                onPress={() => handleChat(typeof item.rider === 'string' ? item.rider : (item.rider as any)._id, item, 'rider')}>
                <Icon name="bicycle-outline" size={16} color="#4F46E5" />
                <Text style={[styles.chatActionTxt, {color: '#4F46E5'}]}>Chat with Rider</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* OTP Section for current state */}
          {item.status === OrderStatus.READY_FOR_PICKUP && item.fulfillmentMethod === 'pickup' && (
             <View style={styles.otpCard}>
                <Text style={styles.otpLabel}>STORE PICKUP PIN</Text>
               <Text style={styles.otpValue}>{item.pickupCode}</Text>
               <Text style={styles.otpTip}>Share this with the seller at the shop</Text>
             </View>
          )}

          {item.status === OrderStatus.IN_TRANSIT && item.deliveryCode && (
             <View style={[styles.otpCard, {backgroundColor: '#EEF2FF', borderColor: '#818CF8'}]}>
                <Text style={[styles.otpLabel, {color: '#4F46E5'}]}>HOME DELIVERY PIN</Text>
               <Text style={[styles.otpValue, {color: '#1E1B4B'}]}>{item.deliveryCode}</Text>
               <Text style={styles.otpTip}>Share this with the rider only after receiving items</Text>
               {riderUpdates[item._id] && (
                 <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6}}>
                   <Animated.View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981'}} />
                   <Text style={{fontSize: 10, color: '#10B981', fontWeight: '800', textTransform: 'uppercase'}}>{riderUpdates[item._id]}</Text>
                 </View>
               )}
             </View>
          )}

        </Card>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.backButton}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>
            {user?.role === Role.RIDER ? 'Delivery History' 
              : (user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) ? 'Sales History' 
              : 'Order History'}
          </Text>
          <Text style={styles.subtitle}>
            {user?.role === Role.RIDER ? 'Track your delivery performance' 
              : (user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) ? 'Monitor your shop sales and orders'
              : 'Your personal purchase history'}
          </Text>
        </View>
      </View>

      {/* Role Switcher Toggle - ONLY for Admins or debugging. Regular Pro profiles are locked to workspace history */}
      {user?.role === Role.ADMIN && (
        <View style={styles.tabWrapper}>
          <TouchableOpacity 
            style={[styles.tabBtn, historyMode === 'workspace' && styles.activeTabBtn]} 
            onPress={() => setHistoryMode('workspace')}>
            <Icon name="shield-checkmark" size={16} color={historyMode === 'workspace' ? theme.colors.white : theme.colors.muted} />
            <Text style={[styles.tabBtnText, historyMode === 'workspace' && styles.activeTabBtnText]}>System</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, historyMode === 'purchases' && styles.activeTabBtn]} 
            onPress={() => setHistoryMode('purchases')}>
            <Icon name="bag-handle" size={16} color={historyMode === 'purchases' ? theme.colors.white : theme.colors.muted} />
            <Text style={[styles.tabBtnText, historyMode === 'purchases' && styles.activeTabBtnText]}>Personal</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={orders}
        keyExtractor={item => item._id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <Animated.View
            entering={FadeInUp.duration(800)}
            style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Icon
                name={user?.role === Role.RIDER ? "bicycle-outline" : user?.role === Role.SELLER ? "stats-chart-outline" : "bag-handle-outline"}
                size={48}
                color={theme.colors.muted}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {user?.role === Role.RIDER ? t('order.no_deliveries') : user?.role === Role.SELLER ? t('order.no_sales') : t('order.no_orders')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {user?.role === Role.RIDER 
                ? 'Your completed delivery jobs will appear here once you finish your first trip.'
                : user?.role === Role.SELLER
                ? 'Your business transactions will appear here as customers place orders.'
                : "Start exploring Karnataka's best local marketplace to place your first order."}
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => (navigation.navigate as any)('HomeTab')}>
              <Text style={styles.exploreButtonText}>{t('cart.start_shopping')}</Text>
              <Icon name="arrow-forward" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </Animated.View>
        }
      />

      {selectedOrder && (
        <ReviewModal
          isVisible={reviewModalVisible}
          onClose={() => {
            setReviewModalVisible(false);
            setSelectedOrder(null);
          }}
          productId={selectedOrder.productId}
          orderId={selectedOrder.orderId}
          productTitle={selectedOrder.productTitle}
          onSuccess={fetchOrders}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {flex: 1},
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  list: {padding: 16, paddingBottom: 40},
  orderCard: {
    marginBottom: 20,
    padding: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderIdGroup: {flexDirection: 'row', alignItems: 'center', gap: 10},
  receiptIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadIconBtn: {
    padding: 6,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    ...theme.shadow.sm,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  productDetails: {flex: 1},
  productTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text},
  shopRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6},
  shopName: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  priceColumn: {alignItems: 'flex-end', marginLeft: 16},
  price: {fontSize: 20, fontWeight: '900', color: theme.colors.primary},
  deliveryFeeText: {
    fontSize: 10,
    color: theme.colors.success,
    fontWeight: '700',
    marginTop: 2,
  },
  qtyText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '700',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  footerValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.md,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
    lineHeight: 22,
  },
  exploreButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 32,
    gap: 10,
    ...theme.shadow.sm,
  },
  exploreButtonText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  otpContainer: {
    backgroundColor: theme.colors.primary + '08',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  otpTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 1.5,
  },
  otpDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  codeRow: {
    backgroundColor: theme.colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: 'center',
    ...theme.shadow.sm,
    marginBottom: 12,
  },
  otpCode: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 8,
  },
  otpInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  otpInfo: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  fulfillmentRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  fulfillmentLabelSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
  },
  reviewBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  reviewedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.success + '10',
    borderRadius: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.success + '20',
  },
  reviewedText: {
    color: theme.colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  addressSummaryCard: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  addressSummaryText: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  chatActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    backgroundColor: theme.colors.primary + '08',
  },
  chatActionTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  otpCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '08',
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  otpValue: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 4,
  },
  otpTip: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  tabWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    margin: 16,
    borderRadius: 16,
    padding: 6,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  activeTabBtn: {
    backgroundColor: theme.colors.primary,
    ...theme.shadow.sm,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.muted,
  },
  activeTabBtnText: {
    color: theme.colors.white,
  },
});