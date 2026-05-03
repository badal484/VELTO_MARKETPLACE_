import React, {useEffect, useState, useCallback, useMemo, memo} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  Dimensions,
  Alert,
  FlatList,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {IShop, IProduct, OrderStatus, IOrder, IUser} from '@shared/types';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import Animated, { FadeInDown, FadeInUp, FadeInRight } from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';
import {useNotifications} from '../../context/NotificationContext';
import { StackNavigationProp } from '@react-navigation/stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {DashboardStackParamList} from '../../navigation/types';
import {MainTabParamList} from '../../navigation/types';
import {useSocket} from '../../hooks/useSocket';

type DashboardScreenNavigationProp = StackNavigationProp<DashboardStackParamList & MainTabParamList, 'Dashboard'>;

interface DashboardProps {
  navigation: DashboardScreenNavigationProp;
}

export default function DashboardScreen({navigation}: DashboardProps) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const [shop, setShop] = useState<IShop | null>(null);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Handshake OTP State
  const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Analytics State
  const [chartData, setChartData] = useState<{label: string, value: number, isToday: boolean}[]>([]);
  const [maxEarnings, setMaxEarnings] = useState(1000);

  const {socket, isConnected} = useSocket();
  const {unreadCount, resetUnreadCount} = useNotifications();

  // Socket listener for real-time dashboard updates
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('order_status_updated', (updatedOrder: IOrder) => {
        // Trigger a silent refresh to update earnings and pipeline
        fetchData();
        showToast({ message: `Order #${updatedOrder._id.slice(-6).toUpperCase()} is now ${updatedOrder.status.replace(/_/g, ' ')}`, type: 'info' });
      });
    }
    return () => {
      if (socket) socket.off('order_status_updated');
    };
  }, [socket, isConnected]);

  // Use focus effect to refresh data and reset unread badges when user returns to this tab
  useFocusEffect(
    useCallback(() => {
      fetchData();
      resetUnreadCount();
    }, [])
  );

  const fetchData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [shopRes, productsRes, ordersRes] = await Promise.all([
        axiosInstance.get('/api/shops/my').catch(() => ({ data: { success: false } })),
        axiosInstance.get('/api/products/my').catch(() => ({ data: { success: false, data: [] } })),
        axiosInstance.get('/api/orders/seller').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (shopRes.data?.success) {
        setShop(shopRes.data.data);
      }
      if (productsRes.data?.success) {
        setProducts(productsRes.data.data);
      }
      if (ordersRes.data?.success) {
        setOrders(ordersRes.data.data);
        // -- Aggregate Chart Data (Last 14 days) --
        const days = [];
        let maxVal = 500;
        for (let i = 13; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dayOrders = ordersRes.data.data.filter((o: IOrder) => 
            o.status === OrderStatus.COMPLETED && isSameDay(new Date(o.createdAt ?? Date.now()), date)
          );
          const total = dayOrders.reduce((acc: number, o: IOrder) => acc + (o.totalPrice || 0), 0);
          if (total > maxVal) maxVal = total;
          days.push({
            label: format(date, 'eee').charAt(0),
            value: total,
            isToday: i === 0
          });
        }
        setChartData(days);
        setMaxEarnings(Math.ceil(maxVal / 500) * 500);
      }
    } catch (error) {
      console.error('Dashboard Fetch Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/status`, { status: OrderStatus.CONFIRMED });
      fetchData();
      showToast({message: 'Order Accepted. Buyer notified.', type: 'success'});
    } catch (error) {
      showToast({message: 'Could not accept order.', type: 'error'});
    }
  };

  const handleVerifyHandshake = async () => {
    if (otpValue.length !== 4) {
      showToast({message: 'Please enter a valid 4-digit code', type: 'info'});
      return;
    }

    try {
      setVerifying(true);
      await axiosInstance.post(`/api/orders/${activeOrderId}/verify-otp`, { otp: otpValue });
      setIsOtpModalVisible(false);
      setOtpValue('');
      setActiveOrderId(null);
      fetchData();
      showToast({message: 'Handover verified. Order completed!', type: 'success'});
    } catch (error: any) {
      showToast({message: error.response?.data?.message || 'Invalid code.', type: 'error'});
    } finally {
      setVerifying(false);
    }
  };

  const handleSupportChat = async () => {
    try {
      const res = await axiosInstance.get('/api/user/admin-contact');
      if (res.data.success) {
        const admin = res.data.data;
        const chatRes = await axiosInstance.post('/api/chat', {
          receiverId: admin._id,
        });

        (navigation as any).navigate('ChatRoom', {
          conversationId: chatRes.data.data._id,
          otherUser: admin,
          shopName: 'Velto Support',
        });
      }
    } catch (error) {
      console.error('Support chat error:', error);
      Alert.alert('Error', 'Unable to connect to support team.');
    }
  };

// Memoized List Items to prevent unnecessary re-renders during dashboard updates
const OrderCard = memo(({ item, onAccept, onVerify }: { item: IOrder, onAccept: (id: string) => void, onVerify: (id: string) => void }) => {
  const product = item.product as unknown as IProduct;
  const buyer = item.buyer as unknown as IUser;
  const isPending = item.status === OrderStatus.PENDING;
  const isConfirmed = item.status === OrderStatus.CONFIRMED;
  const isCompleted = item.status === OrderStatus.COMPLETED;

  return (
    <Card style={styles.orderCard} variant="elevated">
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>#NB-{item._id?.slice(-6).toUpperCase() || 'ORDER'}</Text>
        <View style={[
          styles.statusBadge, 
          {backgroundColor: isCompleted ? theme.colors.success + '15' : isPending ? theme.colors.warning + '15' : theme.colors.primary + '15'}
        ]}>
          <Text style={[
            styles.statusText, 
            {color: isCompleted ? theme.colors.success : isPending ? theme.colors.warning : theme.colors.primary}
          ]}>
            {(item.status || 'UNKNOWN').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.orderAmount}>₹{item.totalPrice.toLocaleString()}</Text>
      <Text style={styles.orderQty} numberOfLines={1}>{item.quantity}x {product?.title || 'Product'}</Text>
      <Text style={styles.buyerName}>Buyer: {buyer?.name || 'Customer'}</Text>

      <View style={styles.orderActions}>
        {isPending && (
          <TouchableOpacity 
            style={styles.actionBtnAccept} 
            onPress={() => onAccept(item._id)}>
            <Text style={styles.actionBtnText}>Confirm Order</Text>
          </TouchableOpacity>
        )}
        {isConfirmed && item.fulfillmentMethod === 'pickup' && (
          <TouchableOpacity 
            style={styles.actionBtnVerify} 
            onPress={() => onVerify(item._id)}>
            <Icon name="hand-right-outline" size={14} color={theme.colors.white} />
            <Text style={styles.actionBtnText}>Verify Handover</Text>
          </TouchableOpacity>
        )}
        {isCompleted && (
          <View style={styles.completedBadge}>
            <Icon name="checkmark-done" size={14} color={theme.colors.success} />
            <Text style={styles.completedText}>Done</Text>
          </View>
        )}
      </View>
    </Card>
  );
});

const ProductCard = memo(({ item, onPress }: { item: IProduct, onPress: () => void }) => (
  <TouchableOpacity 
    style={styles.productCard} 
    onPress={onPress}>
    <Image 
      source={{uri: item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/150'}} 
      style={styles.productThumb} 
    />
    <View style={styles.productMeta}>
      <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.productPrice}>₹{item.price}</Text>
      <Text style={styles.productStock}>{item.stock} in stock</Text>
    </View>
  </TouchableOpacity>
));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading && !refreshing) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Handshake Verification Modal */}
      <Modal
        visible={isOtpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Handover Verification</Text>
              <TouchableOpacity onPress={() => setIsOtpModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Enter the 4-digit code shown on the buyer's handover ticket.
            </Text>

            <TextInput
              style={styles.otpInput}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={otpValue}
              onChangeText={setOtpValue}
              autoFocus
            />

            <Button
              title={verifying ? "Verifying..." : "Verify & Complete Order"}
              type="primary"
              onPress={handleVerifyHandshake}
              loading={verifying}
              style={{marginTop: 20}}
            />
          </Animated.View>
        </View>
      </Modal>

      <View style={[styles.topHeader, {paddingTop: Math.max(insets.top, 20)}]}>
        <View>
          <Text style={styles.brandTitle}>{getGreeting()}, {shop?.name || 'Partner'}</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveSearchText}>ACCEPTING ORDERS</Text>
          </View>
        </View>
        {shop?.isVerified && (
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.notificationBtn}
              onPress={() => (navigation as any).navigate('Notifications')}>
              <Icon name="notifications-outline" size={24} color={theme.colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.walletBtn}
              onPress={() => navigation.navigate('Wallet')}>
              <Icon name="wallet-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.addIconBtn}
              onPress={() => navigation.navigate('AddEditListing', {product: undefined})}>
              <Icon name="add" size={28} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }>
        
        {shop?.isVerified ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Icon name="cube-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.statNum}>{products.length}</Text>
                <Text style={styles.statLab}>Active Products</Text>
              </View>
              <TouchableOpacity 
                style={styles.statBox}
                onPress={() => navigation.navigate('Wallet')}>
                <Icon name="cash-outline" size={20} color={theme.colors.success} />
                <Text style={styles.statNum}>₹{orders.filter(o => o.status === OrderStatus.COMPLETED).reduce((acc, o) => acc + (o.totalPrice || 0), 0).toLocaleString()}</Text>
                <Text style={styles.statLab}>Total Earnings</Text>
              </TouchableOpacity>
            </View>

            {/* Performance Visualizer - UPGRADED DETAIL GRAPH */}
            <View style={styles.premiumCard}>
              <View style={styles.premiumHeader}>
                <View>
                  <Text style={styles.premiumTitle}>Store Analytics</Text>
                  <Text style={styles.premiumSubtitle}>Daily revenue trend (14-bit data)</Text>
                </View>
                <View style={styles.growthBadge}>
                  <Icon name="trending-up" size={14} color={theme.colors.success} />
                  <Text style={styles.growthText}>+12.8%</Text>
                </View>
              </View>
              
              <View style={styles.chartWrapper}>
                {/* Y-Axis Scale */}
                <View style={styles.yAxis}>
                  {[maxEarnings, maxEarnings / 2, 0].map((v, i) => (
                    <Text key={i} style={styles.yAxisText}>₹{v >= 1000 ? (v/1000).toFixed(1)+'k' : v}</Text>
                  ))}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScroll}>
                  <View style={styles.chartRow}>
                    {chartData.map((day, i) => {
                      const barHeight = (day.value / maxEarnings) * 100;
                      return (
                        <View key={i} style={styles.chartBarCol}>
                          <View style={styles.barGhost}>
                            <View style={{ opacity: day.value === 0 ? 0.3 : 1 }}>
                              <Animated.View 
                                entering={FadeInUp.delay(i * 50)}
                                style={[
                                  styles.chartBar, 
                                  {
                                    height: Math.max(barHeight, 4), 
                                    backgroundColor: day.isToday ? theme.colors.primary : '#E2E8F0',
                                  }
                                ]} 
                              >
                                {day.isToday && <View style={styles.todayIndicator} />}
                              </Animated.View>
                            </View>
                          </View>
                          <Text style={[styles.chartDay, day.isToday && {color: theme.colors.primary}]}>{day.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizPadding}>
              <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate('AddEditListing', {product: undefined})}>
                <View style={[styles.shortcutIcon, {backgroundColor: '#EEF2FF'}]}>
                  <Icon name="add-circle" size={20} color="#6366F1" />
                </View>
                <Text style={styles.shortcutText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate('ManageInventory')}>
                <View style={[styles.shortcutIcon, {backgroundColor: '#F0FDF4'}]}>
                  <Icon name="list" size={20} color="#22C55E" />
                </View>
                <Text style={styles.shortcutText}>Inventory</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigation.navigate('Wallet')}>
                <View style={[styles.shortcutIcon, {backgroundColor: '#FFFBEB'}]}>
                  <Icon name="wallet" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.shortcutText}>Withdraw</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Order Pipeline</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('SellerOrders')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={orders.filter(o => o.status !== OrderStatus.CANCELLED)}
              keyExtractor={item => item._id}
              renderItem={({item}) => (
                <OrderCard 
                  item={item} 
                  onAccept={handleAcceptOrder} 
                  onVerify={(id) => {
                    setActiveOrderId(id);
                    setIsOtpModalVisible(true);
                  }} 
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizPadding}
              ListEmptyComponent={<Text style={styles.emptyTxt}>No active orders</Text>}
            />

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Top Listings</Text>
              <TouchableOpacity onPress={() => (navigation as any).navigate('ManageInventory')}>
                <Text style={styles.seeAllText}>Manage All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.listingGrid}>
              {products.slice(0, 4).map(p => (
                <View key={p._id} style={styles.gridItem}>
                  <ProductCard 
                    item={p} 
                    onPress={() => navigation.navigate('AddEditListing', {product: p})} 
                  />
                </View>
              ))}
              {products.length === 0 && <Text style={styles.emptyTxtCenter}>No listings yet. Add your first product!</Text>}
            </View>

          </>
        ) : (
          <View style={[styles.setupContainer, !!shop?.rejectionReason && styles.setupContainerRejected]}>
            <View style={[styles.setupIconBg, !!shop?.rejectionReason && styles.setupIconBgRejected]}>
              <Icon
                name={shop?.rejectionReason ? "alert-circle-outline" : "storefront-outline"}
                size={80}
                color={shop?.rejectionReason ? theme.colors.danger : theme.colors.muted}
              />
            </View>
            <Text style={[styles.setupTitle, !!shop?.rejectionReason && {color: theme.colors.danger}]}>
              {shop?.rejectionReason ? 'Application Rejected' : shop ? 'Verification Pending' : 'Start Your Business'}
            </Text>
            <Text style={styles.setupDesc}>
              {shop?.rejectionReason
                ? `Reason: ${shop.rejectionReason}\n\nPlease click below to correct your information and resubmit.`
                : shop
                ? "We're currently reviewing your shop details. This usually takes 24 hours."
                : "Join Velto today to reach thousands of buyers in your local area."}
            </Text>
            <TouchableOpacity
              style={[styles.setupBtn, !!shop?.rejectionReason && {backgroundColor: theme.colors.danger}]}
              onPress={() => navigation.navigate('ShopSetup')}>
              <Text style={styles.setupBtnText}>
                {shop?.rejectionReason ? 'Fix & Resubmit' : shop ? 'Update Application' : 'Create Shop Now'}
              </Text>
            </TouchableOpacity>

          </View>
        )}
        
        <View style={{height: 80}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  brandTitle: {fontSize: 12, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase'},
  screenTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletBtn: {
    padding: 8,
  },
  notificationBtn: {
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginRight: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveSearchText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 1.5,
  },
  addIconBtn: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.md,
  },
  scrollContent: {paddingTop: 10},
  statsRow: {flexDirection: 'row', padding: 20, gap: 12},
  statBox: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statNum: {fontSize: 24, fontWeight: '900', color: theme.colors.primary},
  statLab: {fontSize: 11, fontWeight: '700', color: theme.colors.muted, marginTop: 4},
  sectionHead: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginTop: 20, 
    marginBottom: 12
  },
  sectionTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text},
  seeAllText: {fontSize: 14, color: theme.colors.primary, fontWeight: '700'},
  horizPadding: {paddingLeft: 20, paddingRight: 4},
  orderCard: {width: 200, marginRight: 12, padding: 20, borderRadius: 20, backgroundColor: theme.colors.white},
  orderHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  orderId: {fontSize: 10, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.5},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6},
  statusText: {fontSize: 9, fontWeight: '900', letterSpacing: 0.5},
  orderAmount: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  orderQty: {fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, fontWeight: '600'},
  buyerName: {fontSize: 11, color: theme.colors.muted, marginTop: 2, fontWeight: '500'},
  orderActions: {marginTop: 16, flexDirection: 'row', gap: 8},
  actionBtnAccept: {
    flex: 1,
    backgroundColor: theme.colors.warning,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnVerify: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {color: theme.colors.white, fontSize: 13, fontWeight: '800'},
  completedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.success + '10',
    paddingVertical: 8,
    borderRadius: 8,
  },
  completedText: {color: theme.colors.success, fontSize: 13, fontWeight: '800'},
  listingGrid: {flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12},
  gridItem: {width: '50%', padding: 8},
  productCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  productThumb: {width: '100%', height: 120, backgroundColor: '#F1F5F9'},
  productMeta: {padding: 10},
  productTitle: {fontSize: 13, fontWeight: '700', color: theme.colors.text},
  productPrice: {fontSize: 14, fontWeight: '800', color: theme.colors.primary, marginTop: 2},
  productStock: {fontSize: 10, color: theme.colors.muted, marginTop: 4},
  emptyTxt: {marginLeft: 20, color: theme.colors.muted, fontStyle: 'italic'},
  emptyTxtCenter: {width: '100%', textAlign: 'center', padding: 40, color: theme.colors.muted},
  setupContainer: {alignItems: 'center', padding: 40, marginTop: 40},
  setupContainerRejected: {
    backgroundColor: '#FEF2F2',
    borderRadius: 32,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  setupIconBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  setupIconBgRejected: {
    backgroundColor: '#FEE2E2',
  },
  setupTitle: {fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 0},
  setupDesc: {fontSize: 14, color: theme.colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 22},
  setupBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  setupBtnText: {color: theme.colors.white, fontWeight: '800', fontSize: 15},
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    padding: 10,
  },
  supportBtnText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    ...theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  modalSubtitle: {fontSize: 14, color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 20},
  otpInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  premiumCard: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
    marginBottom: 20,
  },
  premiumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  premiumSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  chartWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  yAxis: {
    justifyContent: 'space-between',
    height: 100,
    paddingBottom: 20,
  },
  yAxisText: {
    fontSize: 9,
    color: theme.colors.muted,
    fontWeight: '700',
  },
  chartScroll: {
    paddingRight: 20,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    gap: 12,
  },
  chartBarCol: {
    alignItems: 'center',
    gap: 8,
    width: 24,
  },
  barGhost: {
    height: 100,
    width: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
  },
  todayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.white,
    position: 'absolute',
    top: 4,
    alignSelf: 'center',
    opacity: 0.8,
  },
  chartDay: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.muted,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  growthText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.success,
  },
  shortcutBtn: {
    alignItems: 'center',
    marginRight: 24,
    gap: 8,
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  supportHubCard: {
    backgroundColor: theme.colors.primary,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 24,
    padding: 20,
    ...theme.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  supportHubContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  supportIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportHubTextContainer: {
    flex: 1,
  },
  supportHubTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.white,
    marginBottom: 2,
  },
  supportHubSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  supportHubAction: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  supportHubActionText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
  },
});
