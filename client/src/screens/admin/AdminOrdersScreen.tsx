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
  Image,
  Modal,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Alert} from 'react-native';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import {OrderStatus, IOrder, IProduct, IShop, IUser} from '@shared/types';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';
import {AdminOrderDetailModal} from '../../components/admin/AdminOrderDetailModal';

export default function AdminOrdersScreen({route, navigation}: any) {
  const deepSearchId = route.params?.searchId;
  const {showToast} = useToast();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [refundDestination, setRefundDestination] = useState<'wallet' | 'bank' | 'both'>('wallet');
  const [searchQuery, setSearchQuery] = useState(deepSearchId ? String(deepSearchId) : '');
  const [filteredOrders, setFilteredOrders] = useState<IOrder[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/orders/all');
      if (res.data.success) {
        setOrders(res.data.data);
      }
    } catch (error) {
      console.error('Fetch Admin Orders Error:', error);
      showToast({message: 'Failed to load system orders', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (orders.length > 0) {
      if (searchQuery && typeof searchQuery === 'string') {
        const q = searchQuery.toLowerCase();
        const filtered = orders.filter(o => 
          o._id.toString().toLowerCase().includes(q) ||
          (o.shop as any)?.name?.toLowerCase().includes(q) ||
          (o.buyer as any)?.name?.toLowerCase().includes(q)
        );
        setFilteredOrders(filtered);
      } else {
        setFilteredOrders(orders);
      }
    }
  }, [searchQuery, orders]);

  useEffect(() => {
    if (deepSearchId) {
      setSearchQuery(String(deepSearchId));
    }
  }, [deepSearchId]);

  const handleAdminCancel = (orderId: string) => {
    setCancellingOrderId(orderId);
    setCancelReason('');
    setRefundDestination('wallet');
    setCancelModalVisible(true);
  };

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      showToast({ message: 'Cancellation reason is required', type: 'info' });
      return;
    }
    
    try {
      setLoading(true);
      setCancelModalVisible(false);
      await axiosInstance.patch(`/api/admin/orders/${cancellingOrderId}/status`, { 
        status: OrderStatus.CANCELLED,
        reason: `Admin: ${cancelReason}`,
        refundDestination
      });
      showToast({ message: `Order cancelled. Refund to ${refundDestination} initiated.`, type: 'success' });
      fetchOrders();
    } catch (err: any) {
      showToast({ message: err.response?.data?.message || 'Cancellation failed', type: 'error' });
      setLoading(false);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const renderOrder = ({item, index}: {item: IOrder; index: number}) => {
    const product = item.product as unknown as IProduct;
    const shop = item.shop as unknown as IShop;
    const buyer = item.buyer as unknown as IUser;

    const isCompleted = item.status === OrderStatus.COMPLETED;
    const isCancelled = item.status === OrderStatus.CANCELLED;
    const isPending = item.status === OrderStatus.PENDING;

    return (
      <Animated.View entering={FadeInDown.delay(index * 50)}>
        <Card style={styles.orderCard} variant="elevated">
          <View style={styles.orderHeader}>
            <View style={styles.idGroup}>
              <View style={styles.iconBox}>
                <Icon name="receipt-outline" size={14} color={theme.colors.primary} />
              </View>
              <Text style={styles.orderId}>#NB-{String(item._id).slice(-6).toUpperCase()}</Text>
            </View>
            <View style={[
              styles.statusBadge,
              {backgroundColor: isCompleted ? '#DEF7EC' : isCancelled ? '#FDE8E8' : '#E1EFFE'}
            ]}>
              <Text style={[
                styles.statusText,
                {color: isCompleted ? '#03543F' : isCancelled ? '#9B1C1C' : '#1E429F'}
              ]}>
                {(item.status || 'UNKNOWN').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.mainContent}>
            <View style={styles.productInfo}>
              <Text style={styles.productTitle} numberOfLines={1}>{product?.title || 'Market Item'}</Text>
              <View style={styles.metaRow}>
                <View style={[styles.metaItem, {marginRight: 12}]}>
                  <Icon name="storefront-outline" size={12} color={theme.colors.muted} />
                  <Text style={styles.metaText}>{shop?.name || 'Shop'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Icon name="person-outline" size={12} color={theme.colors.muted} />
                  <Text style={styles.metaText}>{buyer?.name || 'Buyer'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.priceColumn}>
              <Text style={styles.amountText}>₹{item.totalPrice.toFixed(2)}</Text>
              <Text style={styles.qtyText}>{item.quantity} units</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Icon name="calendar-outline" size={12} color={theme.colors.muted} />
              <Text style={styles.dateText}>{new Date(item.createdAt ?? Date.now()).toLocaleDateString()}</Text>
            </View>
            <View style={styles.footerActions}>
              {!isCancelled && !isCompleted && (
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={() => handleAdminCancel(item._id)}>
                  <Icon name="close-circle-outline" size={14} color={theme.colors.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.detailsBtn}
                onPress={() => {
                  setSelectedOrder(item);
                  setModalVisible(true);
                }}>
                <Text style={styles.detailsBtnText}>Details</Text>
                <Icon name="chevron-forward" size={14} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
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
        <View>
          <Text style={styles.title}>System Orders</Text>
          <Text style={styles.subtitle}>Complete marketplace verification oversight</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={18} color={theme.colors.muted} />
          <TextInput
            placeholder="Search Order ID, Shop, or Buyer..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={item => String(item._id)}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="cart-outline" size={48} color={theme.colors.border} />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>All system transactions will appear here.</Text>
          </View>
        }
      />

      <AdminOrderDetailModal 
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        order={selectedOrder}
      />

      {/* Custom Cancellation Modal for Android/iOS Compatibility */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.warningIcon}>
                <Icon name="alert-circle" size={24} color={theme.colors.danger} />
              </View>
              <Text style={styles.modalTitle}>Cancel Order</Text>
            </View>
            
            <Text style={styles.modalSubtitle}>Please provide a reason for this administrative cancellation. This will be shown to the customer.</Text>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.reasonInput}
                placeholder="Reason for cancellation..."
                placeholderTextColor={theme.colors.muted}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity 
              style={styles.viewHistoryBtn}
              onPress={() => {
                setCancelModalVisible(false);
                navigation.navigate('Ledger', { orderId: cancellingOrderId });
              }}>
              <Icon name="receipt-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.viewHistoryBtnText}>Verify Transaction History for this Order</Text>
            </TouchableOpacity>
            
            <Text style={styles.label}>Refund Destination</Text>
            <View style={styles.refundSelector}>
              {(['wallet', 'bank', 'both'] as const).map((dest) => (
                <TouchableOpacity
                  key={dest}
                  style={[styles.destOption, refundDestination === dest && styles.destOptionActive]}
                  onPress={() => setRefundDestination(dest)}
                >
                  <Icon 
                    name={dest === 'wallet' ? 'wallet-outline' : dest === 'bank' ? 'business-outline' : 'git-compare-outline'} 
                    size={16} 
                    color={refundDestination === dest ? theme.colors.primary : theme.colors.muted} 
                  />
                  <Text style={[styles.destText, refundDestination === dest && styles.destTextActive]}>
                    {dest.charAt(0).toUpperCase() + dest.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setCancelModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmBtn} 
                onPress={confirmCancel}
              >
                <Text style={styles.modalConfirmBtnText}>Confirm Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  header: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 13, color: theme.colors.muted, marginTop: 4, fontWeight: '600'},
  searchContainer: {padding: 16, backgroundColor: theme.colors.white, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {flex: 1, marginLeft: 8, fontSize: 13, color: theme.colors.text, fontWeight: '500'},
  list: {padding: 16, paddingBottom: 40},
  orderCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.colors.white,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...theme.shadow.sm,
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
  orderId: {fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, letterSpacing: 0.5},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8},
  statusText: {fontSize: 9, fontWeight: '900', letterSpacing: 0.5},
  mainContent: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  productInfo: {flex: 1, marginRight: 16},
  productTitle: {fontSize: 17, fontWeight: '800', color: theme.colors.text},
  metaRow: {flexDirection: 'row', marginTop: 6},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12, color: theme.colors.muted, fontWeight: '600'},
  priceColumn: {alignItems: 'flex-end'},
  amountText: {fontSize: 18, fontWeight: '900', color: theme.colors.primary},
  qtyText: {fontSize: 11, color: theme.colors.muted, marginTop: 2, fontWeight: '700'},
  footer: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  footerInfo: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dateText: {fontSize: 11, color: theme.colors.muted, fontWeight: '600'},
  detailsBtn: {flexDirection: 'row', alignItems: 'center', gap: 4},
  detailsBtnText: {fontSize: 13, fontWeight: '800', color: theme.colors.primary},
  footerActions: {flexDirection: 'row', alignItems: 'center', gap: 12},
  cancelBtn: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 8, 
    backgroundColor: theme.colors.danger + '10'
  },
  cancelBtnText: {fontSize: 12, fontWeight: '800', color: theme.colors.danger},
  empty: {alignItems: 'center', marginTop: 100, paddingHorizontal: 40},
  emptyTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text, marginTop: 16},
  emptySubtitle: {fontSize: 14, color: theme.colors.muted, textAlign: 'center', marginTop: 8},
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
    ...theme.shadow.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.danger + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: 20,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 24,
  },
  reasonInput: {
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  modalConfirmBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.danger,
  },
  modalConfirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.white,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  refundSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  destOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  destOptionActive: {
    backgroundColor: theme.colors.primary + '10',
    borderColor: theme.colors.primary,
  },
  destText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  destTextActive: {
    color: theme.colors.primary,
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.colors.primary + '08',
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
    borderStyle: 'dashed',
  },
  viewHistoryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
});
