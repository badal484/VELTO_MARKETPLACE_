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
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import {OrderStatus, IOrder, IProduct, IShop, IUser} from '@shared/types';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';
import {AdminOrderDetailModal} from '../../components/admin/AdminOrderDetailModal';

export default function AdminOrdersScreen() {
  const {showToast} = useToast();
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  const renderOrder = ({item, index}: {item: IOrder; index: number}) => {
    const product = item.product as IProduct;
    const shop = item.shop as IShop;
    const buyer = item.buyer as IUser;

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
                {item.status.toUpperCase()}
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
            <TouchableOpacity 
              style={styles.detailsBtn}
              onPress={() => {
                setSelectedOrder(item);
                setModalVisible(true);
              }}>
              <Text style={styles.detailsBtnText}>View Details</Text>
              <Icon name="chevron-forward" size={14} color={theme.colors.primary} />
            </TouchableOpacity>
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

      <FlatList
        data={orders}
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
  empty: {alignItems: 'center', marginTop: 100, paddingHorizontal: 40},
  emptyTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text, marginTop: 16},
  emptySubtitle: {fontSize: 14, color: theme.colors.muted, textAlign: 'center', marginTop: 8},
});
