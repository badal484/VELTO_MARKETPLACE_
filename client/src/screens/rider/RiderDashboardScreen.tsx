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
import {Role} from '@shared/types';
import {useAuth} from '../../hooks/useAuth';
import {useSocket} from '../../hooks/useSocket';
import {useToast} from '../../hooks/useToast';
import {OrderStatus} from '@shared/types';
import Icon from 'react-native-vector-icons/Ionicons';
import Geolocation from 'react-native-geolocation-service';
import {Platform, PermissionsAndroid} from 'react-native';
import {useNotifications} from '../../context/NotificationContext';
import {openMap} from '../../utils/mapUtils';

export default function RiderDashboardScreen({navigation}: any) {
  const {user, refreshUser} = useAuth();
  const {showToast} = useToast();
  const {socket, isConnected} = useSocket();
  const {unreadCount} = useNotifications();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
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
        if (updatedOrder.rider === user?._id || (updatedOrder.rider?._id === user?._id)) {
          setActiveJobs(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
          showToast({ message: `Order status updated: ${updatedOrder.status}`, type: 'info' });
        }
        if (updatedOrder.status === 'rider_assigned' && (updatedOrder.rider !== user?._id && updatedOrder.rider?._id !== user?._id)) {
           setJobs(prev => prev.filter(o => o._id !== updatedOrder._id));
        }
      });

      socket.on('order_assigned', (data: { orderId: string; message: string; order: any }) => {
        showToast({ message: data.message, type: 'success' });
        // Add to active jobs and remove from available jobs if it was there
        setActiveJobs(prev => {
          const exists = prev.find(o => o._id === data.order._id);
          if (exists) return prev.map(o => o._id === data.order._id ? data.order : o);
          return [data.order, ...prev];
        });
        setJobs(prev => prev.filter(o => o._id !== data.order._id));
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

              // 2. Proactive Sync: Update the User's location in the global DB 
              // for nearby job discovery (even if not in transit)
              socket.emit('sync_rider_state', {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            },
            (error) => console.log('Tracking Error', error),
            { 
              enableHighAccuracy: true, 
              distanceFilter: 20, // Update every 20 meters to save battery
              interval: 10000, 
              fastestInterval: 5000 
            }
          );
        }
      };
      startTracking();
    }
    
    return () => {
      if (watchId !== null) Geolocation.clearWatch(watchId);
    };
  }, [activeJobs, activeTab, user?.isRiderVerified, socket, isConnected]);

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return false;
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      
      let lat = null;
      let lng = null;
      
      const hasPermission = await requestLocationPermission();
      if (hasPermission) {
        const position = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
          Geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } else {
        showToast({ message: 'Location permission needed to find nearby jobs', type: 'error' });
      }

      const jobsUrl = lat && lng ? `/api/orders/jobs/available?lat=${lat}&lng=${lng}` : '/api/orders/jobs/available';

      const [availableRes, activeRes] = await Promise.all([
        axiosInstance.get(jobsUrl),
        axiosInstance.get('/api/orders/rider')
      ]);
      
      if (availableRes.data.success) {
        setJobs(availableRes.data.data);
      }
      if (activeRes.data.success) {
        const allOrders = activeRes.data.data;
        const filteredActive = allOrders.filter((o: any) => 
          ['rider_assigned', 'picked_up', 'in_transit'].includes(o.status)
        );
        setActiveJobs(filteredActive);

        const completed = allOrders.filter((o: any) => o.status === 'completed' || o.status === 'delivered');
        const totalEarnings = completed.reduce((sum: number, o: any) => sum + (o.deliveryCharge || 0), 0);
        setStats({
          earnings: totalEarnings,
          deliveries: completed.length
        });
      }
    } catch (error: any) {
      console.error('Fetch jobs error:', error);
      if (error.response?.status === 400) {
        showToast({ message: 'GPS coordinates required. Please enable location permissions.', type: 'error' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Always refresh user so verification state is current, then load jobs
    refreshUser().then(() => fetchJobs());
  }, []);

  const handleClaim = async (orderId: string) => {
    if (!user?.isRiderVerified) {
      Alert.alert('Verification Pending', 'Your rider profile must be verified by admin before you can claim orders.');
      return;
    }

    try {
      const res = await axiosInstance.patch(`/api/orders/${orderId}/claim`);
      if (res.data.success) {
        Alert.alert('Success', 'Order claimed! Please proceed to the shop for pickup.', [
          {text: 'OK', onPress: () => {
             setActiveTab('active');
             fetchJobs();
          }}
        ]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to claim order');
    }
  };

  const handleChat = async (receiverId: string, order: any, role: string) => {
    try {
      const res = await axiosInstance.post('/api/chat', {
        receiverId,
        productId: order.product?._id || order.product,
        orderId: order._id
      });
      
      if (res.data.success) {
        const conversation = res.data.data;
        const otherUser = {
          _id: receiverId,
          name: role === 'buyer' ? order.buyer?.name || 'Buyer' : order.shop?.name || 'Seller',
          avatar: role === 'buyer' ? order.buyer?.avatar : order.shop?.logo,
          role: role as any
        };

        navigation.navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser,
          productTitle: order.product?.title,
          productId: order.product?._id || order.product,
          orderId: order._id
        });
      }
    } catch (err: any) {
       showToast({ message: err.response?.data?.message || 'Failed to start chat', type: 'error' });
    }
  };

  const handleSupport = async (order?: any) => {
    try {
      const res = await axiosInstance.post('/api/chat/support', {
        orderId: order?._id,
        productId: order ? order.product?._id || order.product : undefined
      });
      
      if (res.data.success) {
        const conversation = res.data.data;
        const adminUser = (conversation.participants as any[]).find(p => p.role === 'admin');
        const adminId = adminUser?._id || (conversation.participants as any[]).find(p => typeof p === 'string' && p !== user?._id) || conversation.participants[1];

        navigation.navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser: { 
            _id: adminId,
            name: adminUser?.name || 'Velto Support Team', 
            role: 'admin',
            avatar: adminUser?.avatar
          },
          productTitle: order ? order.product?.title : 'Support',
          orderId: order?._id
        });
      }
    } catch (err) {
      showToast({ message: 'Support team unavailable', type: 'error' });
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      const res = await axiosInstance.patch(`/api/orders/${orderId}/status`, { status });
      if (res.data.success) {
        showToast({ message: `Status updated successfully!`, type: 'success' });
        fetchJobs();
      }
    } catch (error: any) {
      require('react-native').Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleVerifyDelivery = (orderId: string) => {
    setActiveOrderId(orderId);
    setIsOtpModalVisible(true);
  };

  const submitOtp = async () => {
    if (otpValue.length !== 4) {
      showToast({ message: 'Please enter a valid 4-digit OTP', type: 'info' });
      return;
    }
    setVerifying(true);
    try {
      const res = await axiosInstance.post(`/api/orders/${activeOrderId}/verify-delivery`, { otp: otpValue });
      if (res.data.success) {
        Alert.alert('Success', 'Delivery verified and order completed!');
        setIsOtpModalVisible(false);
        setOtpValue('');
        fetchJobs();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await fetchJobs();
  };

  const openShopDetails = (shop: any) => {
    setSelectedShop(shop);
    setIsShopModalVisible(true);
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      showToast({ message: 'Phone number not available', type: 'error' });
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      showToast({ message: 'Could not open dialer', type: 'error' });
    });
  };

  const renderActiveCard = ({item}: {item: any}) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity 
          style={styles.shopInfo} 
          onPress={() => openShopDetails(item.shop)}>
          <Icon name="storefront" size={20} color={theme.colors.primary} />
          <Text style={styles.shopName}>{item.shop?.name}</Text>
          <Icon name="information-circle-outline" size={16} color={theme.colors.muted} />
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.addressSection}>
        {/* Pickup Block */}
        <View style={styles.locationBlock}>
          <View style={styles.addressLine}>
            <View style={styles.dot} />
            <Text style={styles.addressText}>Pickup: {item.shop?.address}</Text>
          </View>
          <View style={styles.inlineActionRow}>
            <TouchableOpacity 
              style={styles.miniCallRow} 
              onPress={() => handleCall(item.shop?.contactInfo?.businessPhone)}>
              <Icon name="call" size={16} color={theme.colors.primary} />
              <Text style={styles.miniCallText}>Call Shop</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.miniNavigateBtn}
              onPress={() => {
                const coords = item.shop?.location?.coordinates;
                openMap(coords?.[1], coords?.[0], item.shop?.name, item.shop?.address);
              }}>
              <Icon name="navigate-circle" size={18} color={theme.colors.white} />
              <Text style={styles.navigateBtnTextInline}>NAVIGATE</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.locationBlock}>
          <View style={styles.addressLine}>
            <View style={[styles.dot, {backgroundColor: theme.colors.accent}]} />
            <Text style={styles.addressText}>Drop: {item.deliveryAddress?.street}, {item.deliveryAddress?.city}</Text>
          </View>
          <View style={[styles.inlineActionRow, {backgroundColor: '#F0F9FF'}]}>
            <TouchableOpacity 
              style={[styles.miniCallRow, {opacity: item.status === 'in_transit' ? 1 : 0.5}]} 
              onPress={() => handleCall(item.buyerPhone || item.buyer?.phoneNumber)}
              disabled={item.status !== 'in_transit'}>
              <Icon name="call" size={16} color={theme.colors.accent} />
              <Text style={[styles.miniCallText, {color: theme.colors.accent}]}>Call Buyer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.miniNavigateBtn, {backgroundColor: theme.colors.accent}]}
              onPress={() => {
                const coords = item.deliveryLocation?.coordinates;
                if (coords) {
                  openMap(coords[1], coords[0], `Drop @ ${item.buyer?.name}`, `${item.deliveryAddress?.street}, ${item.deliveryAddress?.city}`);
                } else {
                  openMap(undefined, undefined, `Drop @ ${item.buyer?.name}`, `${item.deliveryAddress?.street}, ${item.deliveryAddress?.city}`);
                }
              }}>
              <Icon name="navigate-circle" size={18} color={theme.colors.white} />
              <Text style={styles.navigateBtnTextInline}>NAVIGATE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.chatRow}>

        {item.status === 'in_transit' && (
          <TouchableOpacity 
            style={[styles.chatBtnSmall, {borderColor: theme.colors.accent}]} 
            onPress={() => handleChat(item.buyer?._id || item.buyer, item, 'buyer')}>
            <Icon name="chatbubble-outline" size={14} color={theme.colors.accent} />
            <Text style={[styles.chatBtnTxt, {color: theme.colors.accent}]}>Chat with Buyer</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Premium Support Hub Card */}
      <TouchableOpacity 
        style={styles.supportHubCard} 
        onPress={() => handleSupport(item)}
        activeOpacity={0.9}>
        <View style={styles.supportHubContent}>
          <View style={styles.supportIconBg}>
            <Icon name="headset" size={24} color={theme.colors.white} />
          </View>
          <View style={styles.supportHubTextContainer}>
            <Text style={styles.supportHubTitle}>Official Support Hub</Text>
            <Text style={styles.supportHubSubtitle}>24/7 help for your active delivery</Text>
          </View>
          <View style={styles.supportHubAction}>
            <Text style={styles.supportHubActionText}>CHAT NOW</Text>
            <Icon name="chevron-forward" size={14} color={theme.colors.primary} />
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        {item.status === 'rider_assigned' && (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => handleUpdateStatus(item._id, 'picked_up')}>
            <Text style={styles.actionBtnText}>Confirm Pickup</Text>
          </TouchableOpacity>
        )}
        {item.status === 'picked_up' && (
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => handleUpdateStatus(item._id, 'in_transit')}>
            <Text style={styles.actionBtnText}>Start Delivery</Text>
          </TouchableOpacity>
        )}
        {item.status === 'in_transit' && (
          <TouchableOpacity 
            style={[styles.actionBtn, {backgroundColor: theme.colors.success}]} 
            onPress={() => handleVerifyDelivery(item._id)}>
            <Text style={styles.actionBtnText}>Verify OTP & Deliver</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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
        
        {/* Navigation Action for Store */}
        <TouchableOpacity 
          style={styles.inlineNavigateRow}
          onPress={() => {
            const coords = item.shop?.location?.coordinates;
            if (coords) {
              openMap(coords[1], coords[0], item.shop?.name, item.shop?.address);
            } else {
              openMap(undefined, undefined, item.shop?.name, item.shop?.address);
            }
          }}>
          <Icon name="navigate-circle" size={16} color={theme.colors.primary} />
          <Text style={styles.inlineNavigateText}>NAVIGATE TO STORE</Text>
        </TouchableOpacity>

        <View style={styles.line} />
        <View style={styles.addressLine}>
          <View style={[styles.dot, {backgroundColor: theme.colors.accent}]} />
          <Text style={styles.addressText} numberOfLines={1}>Drop: {item.deliveryAddress?.street}, {item.deliveryAddress?.city}</Text>
        </View>
        
        {/* Distance Indicator */}
        {item.distanceMetres !== undefined && (
          <View style={styles.distanceRow}>
            <Icon name="location" size={14} color={theme.colors.muted} />
            <Text style={styles.distanceText}>
              {(item.distanceMetres / 1000).toFixed(1)} km away
            </Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.itemBadge}>
          <Text style={styles.itemText}>{item.quantity} item(s)</Text>
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
                    <Icon name="business" size={40} color={theme.colors.muted} />
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => setIsShopModalVisible(false)}
                  style={styles.closeBtn}>
                  <Icon name="close" size={24} color={theme.colors.white} />
                </TouchableOpacity>
             </View>
             
             <View style={styles.shopModalBody}>
               <Text style={styles.modalShopName}>{selectedShop?.name}</Text>
               <View style={styles.categoryPill}>
                 <Text style={styles.categoryText}>{selectedShop?.category || 'Store'}</Text>
               </View>
               
               <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <Icon name="location-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.infoText}>{selectedShop?.address}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Icon name="call-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.infoText}>{selectedShop?.contactInfo?.businessPhone || 'No phone provided'}</Text>
                  </View>
               </View>

               <View style={{flexDirection: 'row', gap: 12, marginTop: 20}}>
                 <TouchableOpacity 
                   style={[styles.actionBtn, {flex: 1, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.primary}]}
                   onPress={() => handleCall(selectedShop?.contactInfo?.businessPhone)}>
                   <Text style={[styles.actionBtnText, {color: theme.colors.primary}]}>CALL STORE</Text>
                 </TouchableOpacity>
                 
                 <TouchableOpacity 
                   style={[styles.actionBtn, {flex: 1.5}]}
                   onPress={() => {
                     const coords = selectedShop?.location?.coordinates;
                     if (coords) {
                       openMap(coords[1], coords[0], selectedShop.name, selectedShop.address);
                     } else {
                       openMap(undefined, undefined, selectedShop.name, selectedShop.address);
                     }
                     setIsShopModalVisible(false);
                   }}>
                   <Text style={styles.actionBtnText}>NAVIGATE</Text>
                 </TouchableOpacity>
               </View>
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
          <Animated.View entering={FadeInUp} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Handshake</Text>
              <TouchableOpacity onPress={() => setIsOtpModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Ask the buyer for their 4-digit delivery pin to complete the drop-off.
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
              title={verifying ? "Processing..." : "Verify & Complete"}
              type="success"
              onPress={submitOtp}
              loading={verifying}
            />
          </Animated.View>
        </View>
      </Modal>

      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Velto Fleet</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveSearchText}>LIVE SEARCH ACTIVE</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Notifications')} 
            style={styles.notificationBtn}>
            <Icon name="notifications-outline" size={24} color={theme.colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Wallet')} style={{marginRight: 15, marginLeft: 10}}>
            <Icon name="wallet-outline" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
            <Icon name="refresh" size={24} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {!user?.isRiderVerified && (
        <View style={styles.warningBanner}>
          <Icon name="warning" size={18} color="#92400E" />
          <Text style={styles.warningText}>Your account is pending admin verification.</Text>
        </View>
      )}

      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Earnings</Text>
          <Text style={styles.statValue}>₹{stats.earnings.toLocaleString()}</Text>
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
           <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active Tasks ({activeJobs.length})</Text>
         </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <Loader fullScreen />
      ) : (
        <FlatList
          data={activeTab === 'available' ? jobs : activeJobs}
          renderItem={activeTab === 'available' ? renderJobCard : renderActiveCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name={activeTab === 'available' ? "bicycle" : "clipboard-outline"} size={64} color={theme.colors.muted} />
              <Text style={styles.emptyText}>
                {activeTab === 'available' ? "No available jobs in your area" : "No active tasks right now"}
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: theme.colors.white,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBtn: {
    position: 'relative',
    padding: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 8,
    fontWeight: '900',
  },
  headerTitle: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  warningText: {fontSize: 13, color: '#92400E', fontWeight: '600'},
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  activeTabText: {
    color: theme.colors.white,
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
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
