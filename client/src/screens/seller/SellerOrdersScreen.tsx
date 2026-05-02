import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {IOrder, IProduct, IUser, OrderStatus} from '@shared/types';
import {getStatusDisplay} from '@shared/constants/orderStatus';
import {SocketEvent} from '@shared/constants/socketEvents';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';
import {StackNavigationProp} from '@react-navigation/stack';
import {DashboardStackParamList} from '../../navigation/types';
import {useSocket} from '../../hooks/useSocket';

type SellerOrdersScreenNavigationProp = StackNavigationProp<
  DashboardStackParamList,
  'SellerOrders'
>;

interface SellerOrdersProps {
  navigation: SellerOrdersScreenNavigationProp;
}

export default function SellerOrdersScreen({navigation}: SellerOrdersProps) {
  const {showToast} = useToast();
  const {socket, isConnected} = useSocket();
  // State
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on(SocketEvent.ORDER_STATUS_UPDATED, (updatedOrder: IOrder) => {
        if (updatedOrder?._id) {
          setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
          showToast({ message: `Order #${updatedOrder._id.slice(-6).toUpperCase()} status updated`, type: 'info' });
        }
      });

      socket.on('new_order', (newOrder: IOrder) => {
        if (newOrder?._id) {
          showToast({ message: `New Order Received! #${newOrder._id.slice(-6).toUpperCase()}`, type: 'success' });
          fetchOrders();
        }
      });
    }
    return () => {
      if (socket) {
        socket.off(SocketEvent.ORDER_STATUS_UPDATED);
        socket.off('new_order');
      }
    };
  }, [socket, isConnected]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axiosInstance.get('/api/orders/seller');
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (error) {
      console.error('Fetch Orders Error:', error);
      showToast({message: 'Failed to load orders', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/status`, { status });
      fetchOrders();
      showToast({message: `Order marked as ${status.replace('_', ' ')}`, type: 'success'});
    } catch (error) {
      showToast({message: 'Update failed', type: 'error'});
    }
  };

  const handleChat = async (receiverId: string, order: IOrder, role: string) => {
    // Legacy P2P Chat disabled for Sellers. Routing to Support.
    handleSupport(order);
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
        const adminId = adminUser?._id || (conversation.participants as any[]).find(p => typeof p === 'string') || conversation.participants[1];

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



  const renderOrder = ({item, index}: {item: IOrder; index: number}) => {
    const product = item.product as unknown as IProduct;
    const buyer = item.buyer as unknown as IUser;
    const { label, color } = getStatusDisplay(item.status);
    const isPending = item.status === OrderStatus.PENDING;
    const isConfirmed = item.status === OrderStatus.CONFIRMED;
    const isCompleted = item.status === OrderStatus.COMPLETED;

    return (
      <Animated.View entering={FadeInDown.delay(index * 100)}>
        <Card style={styles.orderCard} variant="elevated">
          <View style={styles.orderHeader}>
            <View style={styles.idGroup}>
              <View style={styles.iconBox}>
                <Icon name="receipt-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.orderId}>#{item._id?.slice(-6).toUpperCase() || 'ORDER'}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color: color }]}>{label}</Text>
            </View>
          </View>
          
          <View style={styles.contentRow}>
            {product?.images && product.images.length > 0 && (
              <Image source={{uri: product.images[0]}} style={styles.productThumb} />
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>{product?.title || 'Product'}</Text>
              <Text style={styles.buyerText}>Customer: {buyer?.name || 'Local Buyer'}</Text>
              <View style={styles.contactRow}>
                <Icon name="call" size={12} color={theme.colors.textSecondary} />
                <Text style={styles.phoneText}>{item.buyerPhone || 'No Contact'}</Text>
              </View>
              <Text style={styles.dateText}>Placed on {new Date(item.createdAt ?? Date.now()).toLocaleDateString()}</Text>
            </View>
            <View style={styles.priceInfo}>
              <Text style={styles.amountText}>₹{item.totalPrice.toLocaleString()}</Text>
              <Text style={styles.qtyText}>{item.quantity} Qty</Text>
            </View>
          </View>

          {item.fulfillmentMethod === 'delivery' && item.deliveryAddress && (
            <View style={styles.addressBox}>
              <View style={styles.addressHeader}>
                <Icon name="location" size={14} color={theme.colors.primary} />
                <Text style={styles.addressLabel}>DELIVERY ADDRESS</Text>
              </View>
              <Text style={styles.addressText}>
                {item.deliveryAddress.street}, {item.deliveryAddress.city}, {item.deliveryAddress.pincode}
              </Text>
              {item.deliveryAddress.landmark && (
                <Text style={styles.landmarkText}>Landmark: {item.deliveryAddress.landmark}</Text>
              )}
            </View>
          )}

          {item.fulfillmentMethod === 'pickup' && (
            <View style={styles.methodBox}>
              <Icon name="storefront" size={14} color={theme.colors.muted} />
              <Text style={styles.methodText}>Self-Pickup Fulfillment</Text>
            </View>
          )}

          {item.rider && (
            <View style={[styles.addressBox, {backgroundColor: '#ECFDF5', borderColor: '#10B981'}]}>
              <View style={styles.addressHeader}>
                <Icon name="bicycle" size={14} color="#059669" />
                <Text style={[styles.addressLabel, {color: '#059669'}]}>RIDER ASSIGNED</Text>
              </View>
              <Text style={styles.addressText}>
                {(item.rider as any)?.name || 'Delivery Partner'} is on the way.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <View style={styles.p2pActions}>
               <TouchableOpacity 
                  style={styles.chatBtnSmall} 
                  onPress={() => handleSupport(item)}>
                  <Icon name="help-buoy-outline" size={14} color={theme.colors.primary} />
                  <Text style={styles.chatBtnTxt}>Contact Support</Text>
               </TouchableOpacity>
            </View>

            {isPending && (
              <Button 
                title="Accept Order" 
                type="warning" 
                onPress={() => handleUpdateStatus(item._id, OrderStatus.CONFIRMED)}
                style={styles.fullBtn}
              />
            )}
            
            {isConfirmed && item.fulfillmentMethod === 'delivery' && (
               <Button 
                title="Mark Ready for Pickup" 
                type="primary" 
                onPress={() => handleUpdateStatus(item._id, OrderStatus.SEARCHING_RIDER)}
                style={styles.fullBtn}
                icon={<Icon name="cube-outline" size={18} color="white" />}
              />
            )}

            {isConfirmed && item.fulfillmentMethod === 'pickup' && (
              <Button 
                title="Mark Ready for Buyer" 
                type="primary" 
                onPress={() => handleUpdateStatus(item._id, OrderStatus.READY_FOR_PICKUP)}
                style={styles.fullBtn}
                icon={<Icon name="storefront-outline" size={18} color="white" />}
              />
            )}

            {item.status === OrderStatus.READY_FOR_PICKUP && item.fulfillmentMethod === 'pickup' && (
              <Button 
                title="Complete Pickup" 
                type="success" 
                onPress={() => handleUpdateStatus(item._id, OrderStatus.COMPLETED)}
                icon={<Icon name="checkmark-circle-outline" size={18} color="white" />}
                style={styles.fullBtn}
              />
            )}

            {item.status === OrderStatus.SEARCHING_RIDER && (
               <View style={styles.searchingBox}>
                 <Icon name="search" size={16} color={theme.colors.primary} />
                 <Text style={styles.searchingTxt}>Searching for nearby delivery partners...</Text>
               </View>
            )}

            {item.status === OrderStatus.RIDER_ASSIGNED && (
               <View style={styles.searchingBox}>
                 <Icon name="bicycle" size={16} color="#059669" />
                 <Text style={[styles.searchingTxt, {color: '#059669'}]}>Rider is picking up the package...</Text>
               </View>
            )}

            {isCompleted && (
              <View style={styles.completedBadge}>
                <Icon name="checkmark-done-circle" size={18} color={theme.colors.success} />
                <Text style={styles.completedText}>Transaction Completed</Text>
              </View>
            )}
          </View>
        </Card>
      </Animated.View>
    );
  };

  if (loading && !refreshing) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      


      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>All Orders</Text>
          <Text style={styles.subtitle}>Active & Past Fulfillment</Text>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item._id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="cart-outline" size={60} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No Orders Yet</Text>
            <Text style={styles.emptyText}>When you receive orders, they will appear here for management.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 12, color: theme.colors.muted, fontWeight: '600', marginTop: 2},
  list: {padding: 16, paddingBottom: 40},
  orderCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orderHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  idGroup: {flexDirection: 'row', alignItems: 'center', gap: 8},
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderId: {fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary},
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {fontSize: 10, fontWeight: '900', letterSpacing: 0.5},
  contentRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  productThumb: {width: 60, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 12},
  productInfo: {flex: 1},
  productTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text},
  buyerText: {fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, fontWeight: '600'},
  dateText: {fontSize: 11, color: theme.colors.muted, marginTop: 4, fontWeight: '500'},
  priceInfo: {alignItems: 'flex-end', marginLeft: 16},
  amountText: {fontSize: 20, fontWeight: '900', color: theme.colors.primary},
  qtyText: {fontSize: 12, color: theme.colors.muted, marginTop: 4, fontWeight: '700'},
  actions: {marginTop: 4},
  fullBtn: {width: '100%'},
  contactRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4},
  phoneText: {fontSize: 13, color: theme.colors.primary, fontWeight: '700'},
  addressBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16
  },
  addressHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
  addressLabel: {fontSize: 10, fontWeight: '900', color: theme.colors.primary, letterSpacing: 0.5},
  addressText: {fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18},
  landmarkText: {fontSize: 11, color: theme.colors.muted, marginTop: 2, fontStyle: 'italic'},
  methodBox: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, opacity: 0.7},
  methodText: {fontSize: 11, fontWeight: '700', color: theme.colors.muted},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24},
  modalContent: {backgroundColor: theme.colors.white, borderRadius: 28, padding: 24, ...theme.shadow.lg},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  modalTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  modalSubtitle: {fontSize: 14, color: theme.colors.textSecondary, marginBottom: 24, lineHeight: 20},
  otpInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    padding: 16,
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyText: {fontSize: 14, color: theme.colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 20},
  p2pActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  chatBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    backgroundColor: theme.colors.white,
  },
  chatBtnTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  searchingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.colors.primary + '05',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '10',
    borderStyle: 'dashed',
  },
  searchingTxt: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  completedText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.success,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 16,
  },
});
