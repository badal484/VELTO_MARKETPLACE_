// Rider Dashboard Screen - Real-time fleet management
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
  Alert,
  Modal,
  TextInput,
  Linking,
  Image,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Button} from '../../components/common/Button';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {Loader} from '../../components/common/Loader';
import {Role, OrderStatus} from '../../../../shared/types';
import {useAuth} from '../../hooks/useAuth';
import {useSocket} from '../../hooks/useSocket';
import {useToast} from '../../hooks/useToast';
import Icon from 'react-native-vector-icons/Ionicons';
import Geolocation from 'react-native-geolocation-service';
import {Platform, PermissionsAndroid} from 'react-native';
import {useNotifications} from '../../context/NotificationContext';
import {openMap} from '../../utils/mapUtils';

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
  },
  pickupCodeBox: {
    backgroundColor: '#F0FDF4',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow.sm,
  },
  pickupCodeContent: {
    flex: 1,
  },
  pickupCodeLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pickupCodeValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 4,
  },
  pickupCodeHint: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '500',
    marginTop: 4,
  },
  pickupCodeIcon: {
    marginLeft: 16,
    opacity: 0.8,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 6,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    gap: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  list: {padding: 16},
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  shopInfo: {flexDirection: 'row', alignItems: 'center', gap: 8},
  shopName: {fontSize: 16, fontWeight: '700', color: theme.colors.text},
  price: {fontSize: 18, fontWeight: '900', color: theme.colors.primary},
  addressSection: {marginBottom: 20},
  addressLine: {
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12, 
    marginBottom: 8
  },
  dot: {width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary, marginTop: 6},
  addressText: {fontSize: 14, color: theme.colors.textSecondary, flex: 1, lineHeight: 20},
  locationBlock: {
    marginBottom: 16,
    padding: 2,
  },
  miniCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniCallText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  footer: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  itemBadge: {backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8},
  itemText: {fontSize: 12, fontWeight: '600', color: theme.colors.muted},
  claimBtn: {backgroundColor: theme.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12},
  claimText: {color: theme.colors.white, fontWeight: '800'},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100},
  emptyText: {fontSize: 16, color: theme.colors.muted, marginTop: 16, fontWeight: '600'},
  retryBtn: {marginTop: 20, padding: 12},
  retryText: {color: theme.colors.primary, fontWeight: '700'},
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storeIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderId: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 20,
    marginTop: 4,
  },
  callText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  actionRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  actionBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: theme.colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  chatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  chatBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    backgroundColor: theme.colors.white,
  },
  chatBtnTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.white,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
  },
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
  miniNavigate: {
    padding: 4,
  },
  shopModalHeader: {
    height: 120,
    backgroundColor: theme.colors.primary,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shopLogoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.colors.white,
    position: 'absolute',
    bottom: -40,
    ...theme.shadow.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shopLogo: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  shopModalBody: {
    padding: 30,
    paddingTop: 50,
    alignItems: 'center',
  },
  modalShopName: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 24,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  infoSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  inlineActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
  },
  miniNavigateBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 'auto',
  },
  navigateBtnTextInline: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  supportHubCard: {
    backgroundColor: theme.colors.primary,
    marginVertical: 12,
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
  inlineNavigateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  inlineNavigateText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  line: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  liveSearchText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.success,
    letterSpacing: 1,
  },
});

export default function RiderDashboardScreen({navigation}: any) {
  const {user, refreshUser} = useAuth();
  const {showToast} = useToast();
  const {socket, isConnected} = useSocket();
  const {unreadCount} = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({earnings: 0, deliveries: 0});

  const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [isShopModalVisible, setIsShopModalVisible] = useState(false);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('new_job_available', (data: any) => {
        showToast({ message: `New job available at ${data.shopName}!`, type: 'info' });
        fetchJobs();
      });

      socket.on('order_status_updated', (updatedOrder: any) => {
        showToast({ message: `Order status updated: ${updatedOrder.status}`, type: 'info' });
        fetchJobs(true); // Silent refresh
      });

      socket.on('order_assigned', (data: { orderId: string; message: string; order: any }) => {
        showToast({ message: data.message, type: 'success' });
        fetchJobs(true); // Silent refresh
      });
    }
    return () => {
      if (socket) {
        socket.off('new_job_available');
        socket.off('order_status_updated');
        socket.off('order_assigned');
      }
    };
  }, [socket, isConnected, user?._id]);

  useEffect(() => {
    let watchId: number | null = null;
    
    // Track location if there are active transit jobs OR if the rider is online and looking for jobs
    const shouldTrack = activeJobs.some(job => job.status === 'in_transit') || 
                       (activeTab === 'available' && user?.isRiderVerified);

    if (shouldTrack && socket && isConnected) {
      const startTracking = async () => {
        const hasPermission = await requestLocationPermission();
        if (hasPermission) {
          watchId = Geolocation.watchPosition(
            (position) => {
              const inTransitJobs = activeJobs.filter(job => job.status === 'in_transit');
              
              // 1. Broadcast to buyers for active orders
              inTransitJobs.forEach(job => {
                socket.emit('update_rider_location', {
                  orderId: job._id,
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  buyerId: job.buyer?._id || job.buyer
                });
              });

              // 2. Broadcast to nearby available jobs system
              if (activeTab === 'available') {
                socket.emit('rider_active_location', {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                });
              }
            },
            (error) => console.log('Location track error:', error),
            {enableHighAccuracy: true, distanceFilter: 10, interval: 5000}
          );
        }
      };
      startTracking();
    }

    return () => {
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [activeJobs, socket, isConnected, activeTab, user?.isRiderVerified]);

  useEffect(() => {
    fetchJobs();
  }, [activeTab]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      return false;
    }
  };

  const fetchJobs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      let lat = null;
      let lng = null;

      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        const position: any = await new Promise((resolve, reject) => {
          Geolocation.getCurrentPosition(resolve, reject, {enableHighAccuracy: true, timeout: 15000});
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      }

      const endpoint = activeTab === 'available' 
        ? `/api/orders/jobs/available?lat=${lat}&lng=${lng}` 
        : '/api/orders/rider';

      const response = await axiosInstance.get(endpoint);
      const fetchedData = response.data.data || [];
      
      if (activeTab === 'available') {
        setJobs(fetchedData);
        // Also fetch active/history in background for badges
        const riderRes = await axiosInstance.get('/api/orders/rider');
        const riderData = riderRes.data.data || [];
        const activeStatuses = [
          OrderStatus.RIDER_ASSIGNED, 
          OrderStatus.AT_SHOP, 
          OrderStatus.PICKED_UP, 
          OrderStatus.IN_TRANSIT,
          'rider_assigned', 'at_shop', 'picked_up', 'in_transit' // Support legacy lowercase
        ];
        setActiveJobs(riderData.filter((o: any) => activeStatuses.includes(o.status)));
        setHistoryJobs(riderData.filter((o: any) => ![...activeStatuses, OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SEARCHING_RIDER].includes(o.status)));
        if (riderRes.data.stats) {
          setStats(riderRes.data.stats);
        }
      } else {
        const activeStatuses = [
          OrderStatus.RIDER_ASSIGNED, 
          OrderStatus.AT_SHOP, 
          OrderStatus.PICKED_UP, 
          OrderStatus.IN_TRANSIT,
          'rider_assigned', 'at_shop', 'picked_up', 'in_transit' // Support legacy lowercase
        ];
        const active = fetchedData.filter((o: any) => activeStatuses.includes(o.status));
        const history = fetchedData.filter((o: any) => 
          o.status === OrderStatus.DELIVERED || 
          o.status === OrderStatus.COMPLETED_PENDING_RELEASE || 
          o.status === OrderStatus.COMPLETED || 
          o.status === OrderStatus.CANCELLED ||
          o.status === 'delivered' || o.status === 'completed' // Support legacy
        );
        
        setActiveJobs(active);
        setHistoryJobs(history);
      }

      // Sync stats
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      if (error.response?.status !== 404) {
        showToast({ message: 'GPS coordinates required. Please enable location permissions.', type: 'error' });
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  const handleClaim = async (orderId: string) => {
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/claim`);
      showToast({ message: 'Job claimed successfully!', type: 'success' });
      setActiveTab('active');
      fetchJobs();
    } catch (error: any) {
      showToast({ message: error.response?.data?.message || 'Failed to claim job', type: 'error' });
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    try {
      await axiosInstance.patch(`/api/orders/${orderId}/status`, {status});
      showToast({ message: `Status updated to ${status}`, type: 'success' });
      fetchJobs();
    } catch (error: any) {
      showToast({ message: error.response?.data?.message || 'Update failed', type: 'error' });
    }
  };

  const openShopDetails = (shop: any) => {
    setSelectedShop(shop);
    setIsShopModalVisible(true);
  };

  const handleVerifyDelivery = async (orderId: string) => {
    setActiveOrderId(orderId);
    setIsOtpModalVisible(true);
  };

  const submitOtp = async () => {
    if (!otpValue || otpValue.length < 4) {
      showToast({ message: 'Please enter valid OTP', type: 'error' });
      return;
    }

    try {
      setVerifying(true);
      await axiosInstance.post(`/api/orders/${activeOrderId}/verify-delivery`, {otp: otpValue});
      showToast({ message: 'Delivery verified successfully!', type: 'success' });
      setIsOtpModalVisible(false);
      setOtpValue('');
      setActiveTab('history');
      fetchJobs();
    } catch (error: any) {
      showToast({ message: error.response?.data?.message || 'Verification failed', type: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const renderActiveCard = ({item}: {item: any}) => {
    try {
      const isTransit = item.status === OrderStatus.IN_TRANSIT;
      const isDelivered = [OrderStatus.DELIVERED, OrderStatus.COMPLETED_PENDING_RELEASE, OrderStatus.COMPLETED].includes(item.status);
      
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
             <View style={styles.shopInfo}>
                <View style={styles.storeIconBg}>
                   <Icon name="cube" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.shopName}>Order #{item._id.toString().slice(-6).toUpperCase()}</Text>
                  <Text style={styles.orderId}>{item.paymentMethod}</Text>
                </View>
             </View>
             <View style={[
               styles.statusBadge, 
               {backgroundColor: isDelivered ? '#DCFCE7' : isTransit ? '#F3E8FF' : '#FEF9C3'}
             ]}>
               <Text style={[
                 styles.statusText, 
                 {color: isDelivered ? '#166534' : isTransit ? '#6B21A8' : '#854D0E'}
               ]}>
                 {isDelivered ? 'DELIVERED' : item.status === OrderStatus.IN_TRANSIT ? 'OUT FOR DELIVERY' : item.status.toUpperCase()}
               </Text>
             </View>
          </View>

          <View style={styles.addressSection}>
            <View style={styles.addressLine}>
              <View style={[styles.dot, {backgroundColor: '#94A3B8'}]} />
              <View style={{flex: 1}}>
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
              <View style={{flex: 1}}>
                <Text style={styles.addressText}>Deliver: {item.deliveryAddress?.street}, {item.deliveryAddress?.city}</Text>
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

          <View style={styles.chatRow}>
             <TouchableOpacity style={styles.chatBtnSmall} onPress={() => navigation.navigate('Chat', {orderId: item._id, recipientId: item.seller?._id || item.seller})}>
                <Icon name="storefront-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.chatBtnTxt}>Chat Shop</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.chatBtnSmall} onPress={() => navigation.navigate('Chat', {orderId: item._id, recipientId: item.buyer?._id || item.buyer})}>
                <Icon name="person-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.chatBtnTxt}>Chat Customer</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.chatBtnSmall} onPress={() => navigation.navigate('Support')}>
                <Icon name="help-buoy-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.chatBtnTxt}>Support</Text>
             </TouchableOpacity>
          </View>

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
                style={[styles.actionBtn, {backgroundColor: theme.colors.success}]}
                onPress={() => handleVerifyDelivery(item._id)}>
                <Text style={styles.actionBtnText}>Verify OTP & Deliver</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    } catch (error) {
      console.error('Error rendering active card:', error);
      return null;
    }
  };

  const renderJobCard = ({item}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity 
          style={styles.shopInfo} 
          onPress={() => openShopDetails(item.shop)}>
          <Icon name="storefront" size={20} color={theme.colors.primary} />
          <Text style={styles.shopName}>{item.shop?.name}</Text>
          <Icon name="information-circle-outline" size={16} color={theme.colors.muted} />
        </TouchableOpacity>
        <Text style={styles.price}>₹{item.totalPrice}</Text>
      </View>

      <View style={styles.addressSection}>
        <View style={styles.addressLine}>
          <View style={styles.dot} />
          <Text style={styles.addressText} numberOfLines={1}>Pickup: {item.shop?.address}</Text>
        </View>
        <View style={styles.addressLine}>
          <View style={[styles.dot, {backgroundColor: '#64748B'}]} />
          <Text style={styles.addressText} numberOfLines={1}>Drop: {item.deliveryAddress?.addressLine}</Text>
        </View>
        {item.distance && (
          <View style={styles.distanceRow}>
            <Icon name="location" size={12} color={theme.colors.muted} />
            <Text style={styles.distanceText}>{item.distance.toFixed(1)} km away</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.itemBadge}>
          <Text style={styles.itemText}>{item.items?.length || 0} items</Text>
        </View>
        <TouchableOpacity 
          style={styles.claimBtn}
          onPress={() => handleClaim(item._id)}>
          <Text style={styles.claimText}>Claim Job</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

    return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Modals */}
      <Modal
        visible={isShopModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsShopModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {padding: 0, overflow: 'hidden'}]}>
             <View style={styles.shopModalHeader}>
                <View style={styles.shopLogoBox}>
                  {selectedShop?.logo ? (
                    <Image source={{uri: selectedShop.logo}} style={styles.shopLogo} />
                  ) : (
                    <Icon name="storefront" size={40} color={theme.colors.primary} />
                  )}
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsShopModalVisible(false)}>
                   <Icon name="close" size={24} color={theme.colors.white} />
                </TouchableOpacity>
             </View>
             
             <View style={styles.shopModalBody}>
                <Text style={styles.modalShopName}>{selectedShop?.name}</Text>
                <View style={styles.categoryPill}>
                   <Text style={styles.categoryText}>{selectedShop?.category || 'General Store'}</Text>
                </View>

                <View style={styles.infoSection}>
                   <View style={styles.infoRow}>
                      <Icon name="location-outline" size={20} color={theme.colors.muted} />
                      <Text style={styles.infoText}>{selectedShop?.address}</Text>
                   </View>
                   <View style={styles.infoRow}>
                      <Icon name="call-outline" size={20} color={theme.colors.muted} />
                      <Text style={styles.infoText}>{selectedShop?.phoneNumber || 'No contact info'}</Text>
                   </View>
                </View>

                <Button 
                   title="Navigate to Shop" 
                   onPress={() => {
                     openMap(selectedShop?.location?.coordinates[1], selectedShop?.location?.coordinates[0], selectedShop?.name, selectedShop?.address);
                     setIsShopModalVisible(false);
                   }}
                   style={{marginTop: 24, width: '100%'}}
                />
             </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOtpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Delivery</Text>
              <TouchableOpacity onPress={() => setIsOtpModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Please enter the 4-digit PIN provided by the customer to complete delivery.</Text>
            
            <TextInput
              style={styles.otpInput}
              placeholder="0 0 0 0"
              keyboardType="number-pad"
              maxLength={4}
              value={otpValue}
              onChangeText={setOtpValue}
              autoFocus
            />

            <Button 
              title="Confirm & Complete" 
              loading={verifying}
              onPress={submitOtp}
              disabled={otpValue.length < 4}
            />
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Fleet Management</Text>
          <Text style={styles.headerTitle}>Rider Console</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveSearchText}>LIVE SEARCH ACTIVE</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
            <Icon name="notifications-outline" size={24} color={theme.colors.text} />
            {unreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Wallet')}>
            <Icon name="wallet-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {!user?.isRiderVerified && (
        <View style={{backgroundColor: '#FFFBEB', padding: 12, marginHorizontal: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
          <Icon name="warning" size={18} color="#92400E" />
          <Text style={{color: '#92400E', fontSize: 12, fontWeight: '600'}}>Your account is pending admin verification.</Text>
        </View>
      )}

      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Earnings</Text>
          <Text style={styles.statValue}>₹{stats.earnings}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Deliveries</Text>
          <Text style={styles.statValue}>{stats.deliveries}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'available' && styles.activeTab]} 
           onPress={() => setActiveTab('available')}>
           <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>Available</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'active' && styles.activeTab]} 
           onPress={() => setActiveTab('active')}>
           <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active ({activeJobs.length})</Text>
         </TouchableOpacity>
         <TouchableOpacity 
           style={[styles.tab, activeTab === 'history' && styles.activeTab]} 
           onPress={() => setActiveTab('history')}>
           <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
         </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <Loader fullScreen />
      ) : (
        <FlatList
          data={activeTab === 'available' ? jobs : activeTab === 'active' ? activeJobs : historyJobs}
          renderItem={activeTab === 'available' ? renderJobCard : renderActiveCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name={activeTab === 'available' ? "bicycle" : activeTab === 'active' ? "clipboard-outline" : "checkmark-circle-outline"} size={64} color={theme.colors.muted} />
              <Text style={styles.emptyText}>
                {activeTab === 'available' ? "No available jobs" : activeTab === 'active' ? "No active tasks" : "No history yet"}
              </Text>
              <TouchableOpacity onPress={fetchJobs} style={styles.retryBtn}>
                <Text style={styles.retryText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
