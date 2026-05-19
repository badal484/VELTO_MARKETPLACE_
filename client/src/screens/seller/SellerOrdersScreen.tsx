import React, {useEffect, useState} from 'react';
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
  ActivityIndicator,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Skeleton} from '../../components/common/Skeleton';
import {Card} from '../../components/common/Card';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {IOrder, IProduct, IUser, OrderStatus} from '@shared/types';
import {getStatusDisplay} from '@shared/constants/orderStatus';
import {SocketEvent} from '@shared/constants/socketEvents';
import Animated, {FadeInDown, FadeInUp} from '../../mocks/reanimated';
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

  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{visible: boolean; orderId: string | null}>({visible: false, orderId: null});
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (socket && isConnected) {
      socket.on(SocketEvent.ORDER_STATUS_UPDATED, (updatedOrder: IOrder) => {
        if (updatedOrder?._id) {
          setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
          showToast({ message: `Order #${updatedOrder._id.slice(-6).toUpperCase()} status updated`, type: 'info' });
        }
      });

      socket.on(SocketEvent.NEW_ORDER_FOR_SELLER, (newOrder: IOrder) => {
        if (newOrder?._id) {
          showToast({ message: `New Order Received! #${newOrder._id.slice(-6).toUpperCase()}`, type: 'success' });
          fetchOrders();
        }
      });
    }
    return () => {
      if (socket) {
        socket.off(SocketEvent.ORDER_STATUS_UPDATED);
        socket.off(SocketEvent.NEW_ORDER_FOR_SELLER);
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

  const handleConfirm = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/status`, {status: OrderStatus.CONFIRMED});
      showToast({message: 'Order accepted and confirmed!', type: 'success'});
      fetchOrders();
    } catch (err: any) {
      showToast({message: err.response?.data?.message || 'Failed to confirm order', type: 'error'});
    } finally {
      setActionLoading(null);
    }
  };

  const openCancelModal = (orderId: string) => {
    setCancelReason('');
    setCancelModal({visible: true, orderId});
  };

  const submitCancel = async () => {
    if (!cancelModal.orderId) return;
    if (!cancelReason.trim()) {
      showToast({message: 'Please enter a reason for cancellation', type: 'error'});
      return;
    }
    setActionLoading(cancelModal.orderId);
    try {
      await axiosInstance.patch(`/api/orders/${cancelModal.orderId}/status`, {
        status: OrderStatus.CANCELLED,
        cancellationReason: cancelReason.trim(),
      });
      setCancelModal({visible: false, orderId: null});
      showToast({message: 'Order cancelled', type: 'success'});
      fetchOrders();
    } catch (err: any) {
      showToast({message: err.response?.data?.message || 'Failed to cancel order', type: 'error'});
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    setActionLoading(orderId);
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/status`, {status});
      showToast({message: `Order updated`, type: 'success'});
      fetchOrders();
    } catch (error) {
      showToast({message: 'Update failed', type: 'error'});
    } finally {
      setActionLoading(null);
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
    const { label, color } = getStatusDisplay(item.status) || { label: 'Unknown', color: '#94A3B8' };
    const isPending = item.status === OrderStatus.PENDING;
    const isAwaitingConfirmation = item.status === OrderStatus.AWAITING_SELLER_CONFIRMATION;
    const isConfirmed = item.status === OrderStatus.CONFIRMED;
    const isCompleted = item.status === OrderStatus.COMPLETED;
    const isPharmacy = item.orderType === 'pharmacy';

    return (
      <Animated.View entering={FadeInDown.delay(index * 100)}>
        <Card style={styles.orderCard} variant="elevated">
          <View style={styles.orderHeader}>
            <View style={styles.idGroup}>
              <View style={[styles.iconBox, isPharmacy && {backgroundColor: '#F5F3FF'}]}>
                <Icon name={isPharmacy ? 'medkit-outline' : 'receipt-outline'} size={16} color={isPharmacy ? '#6D28D9' : theme.colors.primary} />
              </View>
              <Text style={styles.orderId}>#{item._id?.slice(-6).toUpperCase() || 'ORDER'}</Text>
              {isPharmacy && (
                <View style={styles.pharmacyBadge}>
                  <Text style={styles.pharmacyBadgeText}>PHARMACY</Text>
                </View>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: color + '15' }]}>
              <View style={[styles.statusDot, { backgroundColor: color }]} />
              <Text style={[styles.statusText, { color: color }]}>{label}</Text>
            </View>
          </View>

          {isPharmacy ? (
            <View style={styles.contentRow}>
              <View style={[styles.iconBox, {width: 60, height: 60, borderRadius: 12, backgroundColor: '#F5F3FF', marginRight: 12}]}>
                <Icon name="medkit" size={28} color="#6D28D9" />
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={1}>Pharmacy Order</Text>
                {item.catalogItems && item.catalogItems.length > 0 && (
                  <Text style={styles.buyerText} numberOfLines={2}>
                    {item.catalogItems.map(ci => `${ci.name} ×${ci.quantity}`).join(', ')}
                  </Text>
                )}
                <View style={styles.privacyNotice}>
                  <Icon name="shield-checkmark-outline" size={11} color="#6D28D9" />
                  <Text style={styles.privacyText}>Customer contact is private</Text>
                </View>
                <Text style={styles.dateText}>Placed on {new Date(item.createdAt ?? Date.now()).toLocaleDateString()}</Text>
              </View>
              <View style={styles.priceInfo}>
                <Text style={styles.amountText}>₹{item.totalPrice.toLocaleString()}</Text>
                <Text style={styles.qtyText}>{item.catalogItems?.length || 0} items</Text>
              </View>
            </View>
          ) : (
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
              <TouchableOpacity style={styles.chatBtnSmall} onPress={() => handleSupport(item)}>
                <Icon name="help-buoy-outline" size={14} color={theme.colors.primary} />
                <Text style={styles.chatBtnTxt}>Contact Support</Text>
              </TouchableOpacity>
            </View>

            {(isPending || isAwaitingConfirmation) && (
              <View style={styles.decisionRow}>
                <TouchableOpacity
                  style={[styles.decisionBtn, styles.declineBtnStyle]}
                  onPress={() => openCancelModal(item._id)}
                  disabled={actionLoading === item._id}>
                  <Icon name="close-circle-outline" size={18} color="#EF4444" />
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.decisionBtn, styles.acceptBtnStyle]}
                  onPress={() => handleConfirm(item._id)}
                  disabled={actionLoading === item._id}>
                  {actionLoading === item._id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.acceptBtnText}>Confirm Order</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isConfirmed && (
              <View style={{gap: 8}}>
                <Button
                  title="Mark Ready for Pickup"
                  type="primary"
                  onPress={() => handleUpdateStatus(item._id, OrderStatus.READY_FOR_PICKUP)}
                  style={styles.fullBtn}
                  icon={<Icon name="cube-outline" size={18} color="white" />}
                />
                <TouchableOpacity 
                  style={styles.secondaryCancelBtn}
                  onPress={() => openCancelModal(item._id)}>
                  <Text style={styles.secondaryCancelBtnTxt}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === OrderStatus.READY_FOR_PICKUP && (
              <View style={{gap: 8}}>
                <View style={styles.readyBadge}>
                  <Icon name="checkbox" size={16} color={theme.colors.success} />
                  <Text style={styles.readyText}>Order is Ready for Pickup</Text>
                </View>
                <TouchableOpacity 
                  style={styles.secondaryCancelBtn}
                  onPress={() => openCancelModal(item._id)}>
                  <Text style={styles.secondaryCancelBtnTxt}>Cancel Order</Text>
                </TouchableOpacity>
              </View>
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

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
           <Skeleton width={150} height={28} />
        </View>
        <View style={{ padding: 16, gap: 16 }}>
           {[1, 2, 3].map(i => (
             <Skeleton key={i} width="100%" height={180} borderRadius={20} />
           ))}
        </View>
      </SafeAreaView>
    );
  }

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

      {/* Cancel with Reason Modal */}
      <Modal
        visible={cancelModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModal({visible: false, orderId: null})}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCancelModal({visible: false, orderId: null})}>
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalIconRow}>
              <View style={styles.modalIconBox}>
                <Icon name="close-circle" size={28} color="#EF4444" />
              </View>
            </View>
            <Text style={styles.modalTitle}>Decline Order</Text>
            <Text style={styles.modalSubtitle}>
              Please tell the customer why you're declining this order. This helps them find alternatives quickly.
            </Text>

            <Text style={styles.reasonLabel}>Reason for Decline</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Item is out of stock, unable to fulfil at this time..."
              placeholderTextColor={theme.colors.muted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{cancelReason.length}/200</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCancelModal({visible: false, orderId: null})}>
                <Text style={styles.modalCancelBtnText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !cancelReason.trim() && {opacity: 0.4}]}
                onPress={submitCancel}
                disabled={!cancelReason.trim() || actionLoading === cancelModal.orderId}>
                {actionLoading === cancelModal.orderId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>Confirm Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  // Decision buttons (Accept / Decline)
  decisionRow: {flexDirection: 'row', gap: 10, marginTop: 4},
  decisionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  declineBtnStyle: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  declineBtnText: {fontSize: 13, fontWeight: '800', color: '#EF4444'},
  acceptBtnStyle: {backgroundColor: '#16A34A'},
  acceptBtnText: {fontSize: 13, fontWeight: '800', color: '#fff'},
  secondaryCancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  secondaryCancelBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    textDecorationLine: 'underline',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.colors.success + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.success + '20',
  },
  readyText: {
    fontSize: 13,
    color: theme.colors.success,
    fontWeight: '800',
  },
  // Cancel modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    ...theme.shadow.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text, marginBottom: 8},
  modalSubtitle: {fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20, lineHeight: 20},
  modalIconRow: {alignItems: 'center', marginBottom: 16},
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 80,
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.muted,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  modalActions: {flexDirection: 'row', gap: 12},
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  modalCancelBtnText: {fontSize: 14, fontWeight: '700', color: theme.colors.text},
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  modalConfirmBtnText: {fontSize: 14, fontWeight: '800', color: '#fff'},
  pharmacyBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pharmacyBadgeText: {fontSize: 9, fontWeight: '900', color: '#6D28D9', letterSpacing: 0.5},
  privacyNotice: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  privacyText: {fontSize: 10, color: '#6D28D9', fontWeight: '700'},
});
