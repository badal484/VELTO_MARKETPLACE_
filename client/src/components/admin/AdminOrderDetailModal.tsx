import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { theme } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { IOrder, OrderStatus, IUser, IShop, IProduct, Role } from '@shared/types';
import { Badge } from '../common/Badge';
import { useNavigation } from '@react-navigation/native';
import { axiosInstance } from '../../api/axiosInstance';

interface AdminOrderDetailModalProps {
  visible: boolean;
  onClose: () => void;
  order: IOrder | null;
}

const {height} = Dimensions.get('window');

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({
  visible,
  onClose,
  order,
}) => {
  const navigation = useNavigation<any>();
  if (!order) return null;

  const handleOpenChat = async () => {
    try {
      // Find or start a support conversation for this order
      const res = await axiosInstance.post('/api/chat/support', {
        orderId: order._id,
        productId: (order.product as any)?._id || order.product
      });

      if (res.data.success) {
        onClose();
        navigation.navigate('Chat', {
          screen: 'ChatRoom',
          params: {
            conversationId: res.data.data._id,
            otherUser: buyer,
            productTitle: (product as any)?.title || 'Service',
            orderId: order._id
          }
        });
      }
    } catch (err) {
      console.log('Open Admin Chat Error:', err);
    }
  };

  const handleVerifyPayment = async () => {
    try {
      const res = await axiosInstance.patch(`/api/admin/verify-payment/${order._id}`);
      if (res.data.success) {
        onClose();
        // Assuming there's a way to refresh the parent list, 
        // usually through a context or a prop callback, 
        // but for now, we'll rely on the user refreshing or socket events.
      }
    } catch (err) {
      console.error('Verify Payment Error:', err);
    }
  };

  const product = order.product as unknown as IProduct;
  const shop = order.shop as unknown as IShop;
  const buyer = order.buyer as unknown as IUser;
  const rider = order.rider as unknown as IUser | undefined;

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.COMPLETED:
        return {color: theme.colors.success, icon: 'checkmark-circle'};
      case OrderStatus.CANCELLED:
        return {color: theme.colors.danger, icon: 'close-circle'};
      case OrderStatus.IN_TRANSIT:
        return {color: '#6366F1', icon: 'bicycle'};
      case OrderStatus.READY_FOR_PICKUP:
        return {color: '#8B5CF6', icon: 'cube'};
      case OrderStatus.PAYMENT_UNDER_REVIEW:
        return {color: theme.colors.warning, icon: 'shield-checkmark'};
      default:
        return {color: theme.colors.primary, icon: 'time'};
    }
  };

  const statusConfig = getStatusConfig(order.status);

  const renderSection = (title: string, icon: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color={theme.colors.textSecondary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const renderInfoRow = (label: string, value: string | number, icon?: string) => (
    <View style={styles.infoRow}>
      <View style={styles.labelGroup}>
        {icon && <Icon name={icon} size={14} color={theme.colors.muted} />}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.content}
        >
          <View style={styles.handle} />
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <View style={[styles.statusIcon, {backgroundColor: statusConfig.color + '15'}]}>
                <Icon name={statusConfig.icon} size={32} color={statusConfig.color} />
              </View>
              <Text style={styles.orderIdText}>Order #NB-{String(order._id).slice(-8).toUpperCase()}</Text>
              <View style={[styles.statusBadge, {backgroundColor: statusConfig.color}]}>
                <Text style={styles.statusBadgeText}>{order.status.replace(/_/g, ' ').toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.priceRow}>
                <Text style={styles.totalLabel}>Total Amount</Text>
                <Text style={styles.totalValue}>₹{order.totalPrice.toFixed(2)}</Text>
              </View>
              <View style={styles.methodRow}>
                <Badge label={order.paymentMethod} type="success" />
                <Badge label={order.fulfillmentMethod.toUpperCase()} type="primary" />
                {order.paymentReference && (
                  <View style={styles.utrBadge}>
                    <Text style={styles.utrBadgeText}>UTR: {order.paymentReference}</Text>
                  </View>
                )}
              </View>
            </View>

            {renderSection('Product Details', 'basket-outline', (
              <View>
                <Text style={styles.productTitle}>{product?.title || 'System Item'}</Text>
                <Text style={styles.productMeta}>₹{product?.price || 0} x {order.quantity} units</Text>
                {renderInfoRow('Sold by', shop?.name || 'Unknown Shop', 'storefront-outline')}
              </View>
            ))}

            {renderSection('Customer Info', 'person-outline', (
              <View>
                <Text style={styles.customerName}>{buyer?.name || 'Guest User'}</Text>
                {renderInfoRow('Phone', order.buyerPhone || 'N/A', 'call-outline')}
                {order.fulfillmentMethod === 'delivery' && order.deliveryAddress && (
                  <View style={styles.addressBox}>
                    <Icon name="location-outline" size={14} color={theme.colors.muted} />
                    <Text style={styles.addressText}>
                      {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.pincode}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {rider && renderSection('Rider Assignment', 'bicycle-outline', (
              <View>
                <Text style={styles.riderName}>{rider.name}</Text>
                {renderInfoRow('Vehicle', `${rider.vehicleDetails?.type} (${rider.vehicleDetails?.number})`, 'car-outline')}
                {renderInfoRow('Contact', rider.phoneNumber || 'N/A', 'call-outline')}
              </View>
            ))}

            <View style={styles.verificationCard}>
              <Text style={styles.verifyTitle}>Fulfillment Codes</Text>
              <View style={styles.codeRow}>
                <View style={styles.codeItem}>
                  <Text style={styles.codeLabel}>PICKUP OTP</Text>
                  <Text style={styles.codeValue}>{order.pickupCode}</Text>
                </View>
                {order.deliveryCode && (
                  <View style={styles.codeItem}>
                    <Text style={styles.codeLabel}>DELIVERY OTP</Text>
                    <Text style={styles.codeValue}>{order.deliveryCode}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.verifyNote}>Admin override visibility for manual closure verification.</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.actionBtn, {backgroundColor: theme.colors.primary}]}
                onPress={handleOpenChat}
              >
                <Icon name="chatbubbles-outline" size={20} color={theme.colors.white} />
                <Text style={styles.actionBtnText}>SUPPORT CHAT</Text>
              </TouchableOpacity>

              {order.status === OrderStatus.PAYMENT_UNDER_REVIEW && (
                <View style={[styles.actionBtn, {backgroundColor: theme.colors.muted + '20'}]}>
                  <Icon name="time-outline" size={20} color={theme.colors.muted} />
                  <Text style={[styles.actionBtnText, {color: theme.colors.muted}]}>WAITING FOR RAZORPAY</Text>
                </View>
              )}
              
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>DONE</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.85,
    padding: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderIdText: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 1,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  methodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  utrBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  utrBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 20,
    padding: 16,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  productMeta: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  addressBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },
  riderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 4,
  },
  verificationCard: {
    backgroundColor: '#F1F5F9',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
  },
  verifyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeItem: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  verifyNote: {
    fontSize: 10,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.white,
  },
  closeBtn: {
    width: 100,
    height: 56,
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
});