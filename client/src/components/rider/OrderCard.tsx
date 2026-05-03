import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../../theme';
import { OrderStatus } from '../../../../shared/types';
import { openMap } from '../../utils/mapUtils';

interface OrderCardProps {
  item: any;
  activeTab: string;
  handleStatusUpdate: (id: string, status: OrderStatus) => void;
  navigation: any;
}

const OrderCard: React.FC<OrderCardProps> = ({ item, activeTab, handleStatusUpdate, navigation }) => {
  const isDelivered = item.status === OrderStatus.DELIVERED || item.status === OrderStatus.COMPLETED;
  const isTransit = item.status === OrderStatus.IN_TRANSIT || item.status === OrderStatus.PICKED_UP;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.shopInfo}>
          <View style={styles.storeIconBg}>
            <Icon name="cube" size={18} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.shopName}>Order #{item._id.toString().slice(-6).toUpperCase()}</Text>
            <Text style={styles.orderId}>{item.quantity}x {item.product?.title || 'Product'}</Text>
            <Text style={[styles.orderId, {marginTop: 0, fontSize: 10}]}>{item.paymentMethod}</Text>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: isDelivered ? '#DCFCE7' : isTransit ? '#F3E8FF' : '#FEF9C3' }
        ]}>
          <Text style={[
            styles.statusText,
            { color: isDelivered ? '#166534' : isTransit ? '#6B21A8' : '#854D0E' }
          ]}>
            {isDelivered ? 'DELIVERED' : item.status === OrderStatus.IN_TRANSIT ? 'OUT FOR DELIVERY' : item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.addressSection}>
        <View style={styles.addressLine}>
          <View style={[styles.dot, { backgroundColor: '#94A3B8' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText}>Pickup: {item.shop?.name}</Text>
            <TouchableOpacity style={styles.inlineNavigateRow} onPress={() => openMap(item.shop?.location?.coordinates[1], item.shop?.location?.coordinates[0], item.shop?.name, item.shop?.address)}>
              <Icon name="navigate-circle" size={14} color={theme.colors.primary} />
              <Text style={styles.inlineNavigateText}>NAVIGATE TO SHOP</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.line} />

        <View style={styles.addressLine}>
          <View style={styles.dot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressText}>
              Deliver: {item.deliveryAddress?.street}, {item.deliveryAddress?.city} - {item.deliveryAddress?.pincode}
            </Text>
            <TouchableOpacity style={styles.inlineNavigateRow} onPress={() => openMap(item.deliveryLocation?.coordinates[1], item.deliveryLocation?.coordinates[0], 'Customer Location', item.deliveryAddress?.street)}>
              <Icon name="navigate-circle" size={14} color={theme.colors.primary} />
              <Text style={styles.inlineNavigateText}>NAVIGATE TO CUSTOMER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {(item.status === OrderStatus.RIDER_ASSIGNED || item.status === OrderStatus.AT_SHOP) && item.pickupCode && (
        <View style={styles.pickupCodeBox}>
          <View style={styles.pickupCodeContent}>
            <Text style={styles.pickupCodeLabel}>PICKUP VERIFICATION CODE</Text>
            <Text style={styles.pickupCodeValue}>{item.pickupCode}</Text>
            <Text style={styles.pickupCodeHint}>Show this to the merchant to confirm handover</Text>
          </View>
          <View style={styles.pickupCodeIcon}>
            <Icon name="shield-checkmark" size={32} color="#059669" />
          </View>
        </View>
      )}

      {!isDelivered && (
        <View style={styles.chatRow}>
          <TouchableOpacity 
            style={styles.chatBtnSmall} 
            onPress={() => {
              const phone = item.shop?.contactInfo?.businessPhone || item.shop?.phoneNumber;
              if (phone) Linking.openURL(`tel:${phone}`);
            }}>
            <Icon name="call-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.chatBtnTxt}>Call Shop</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.chatBtnSmall} 
            onPress={() => {
              const phone = item.buyerPhone || item.buyer?.phoneNumber;
              if (phone) Linking.openURL(`tel:${phone}`);
            }}>
            <Icon name="call-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.chatBtnTxt}>Call Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatBtnSmall} onPress={() => navigation.navigate('Support')}>
            <Icon name="help-buoy-outline" size={16} color="#64748B" />
            <Text style={styles.chatBtnTxt}>Support</Text>
          </TouchableOpacity>
        </View>
      )}

      {isDelivered && (
        <View style={styles.chatRow}>
          <TouchableOpacity 
            style={[styles.chatBtnSmall, {flex: 0, paddingHorizontal: 20}]} 
            onPress={() => navigation.navigate('Support')}>
            <Icon name="help-buoy-outline" size={16} color="#64748B" />
            <Text style={styles.chatBtnTxt}>Need Support?</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actionRow}>
        {item.status === OrderStatus.RIDER_ASSIGNED && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleStatusUpdate(item._id, OrderStatus.AT_SHOP)}>
            <Text style={styles.actionBtnText}>Arrived at Shop</Text>
          </TouchableOpacity>
        )}
        {item.status === OrderStatus.AT_SHOP && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleStatusUpdate(item._id, OrderStatus.PICKED_UP)}>
            <Text style={styles.actionBtnText}>Picked Up & Start Delivery</Text>
          </TouchableOpacity>
        )}
        {item.status === OrderStatus.PICKED_UP && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleStatusUpdate(item._id, OrderStatus.IN_TRANSIT)}>
            <Text style={styles.actionBtnText}>Out for Delivery</Text>
          </TouchableOpacity>
        )}
        {item.status === OrderStatus.IN_TRANSIT && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => handleStatusUpdate(item._id, OrderStatus.DELIVERED)}>
            <Text style={styles.actionBtnText}>Mark as Delivered</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  orderId: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  addressSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginTop: 5,
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
    lineHeight: 18,
  },
  inlineNavigateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  inlineNavigateText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  line: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: 20,
  },
  pickupCodeBox: {
    backgroundColor: '#F0FDF4',
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickupCodeContent: {
    flex: 1,
  },
  pickupCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 4,
  },
  pickupCodeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#064E3B',
    letterSpacing: 2,
  },
  pickupCodeHint: {
    fontSize: 11,
    color: '#059669',
    marginTop: 4,
    opacity: 0.8,
  },
  pickupCodeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  chatBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 12,
  },
  chatBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.text,
  },
  actionRow: {
    marginTop: 16,
  },
  actionBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  actionBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default memo(OrderCard);
