import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Linking,
  Image,
  PermissionsAndroid,
  Clipboard,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import {locationService} from '../../services/locationService';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {useAuth} from '../../hooks/useAuth';
import { Skeleton } from '../../components/common/Skeleton';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, FadeInUp} from '../../mocks/reanimated';

import { IProduct } from '@shared/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { HomeStackParamList } from '../../navigation/types';

const DEFAULT_DELIVERY_FEE = 40;
const MAX_COD_AMOUNT = 5000; // Protection for high-value risk

interface CheckoutItem {
  product: IProduct;
  quantity: number;
  lockedPrice?: number;
}

type CheckoutScreenRouteProp = RouteProp<HomeStackParamList, 'Checkout'>;
type CheckoutScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Checkout'>;

interface CheckoutProps {
  route: CheckoutScreenRouteProp;
  navigation: CheckoutScreenNavigationProp;
}

export default function CheckoutScreen({route, navigation}: CheckoutProps) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const {user} = useAuth();
  const {products: initialProducts} = route.params as { products: CheckoutItem[] };
  const [products, setProducts] = useState<CheckoutItem[]>(initialProducts);
  const fulfillmentMethod = 'delivery';
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Cash' | 'UPI'>('Cash');
  const [loading, setLoading] = useState(false);
  
  // Address state
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: 'Karnataka',
    pincode: '',
    landmark: '',
  });
  const [utrValue, setUtrValue] = useState('');
  const [processedOrders, setProcessedOrders] = useState<any[]>([]);
  const [isUroPayModalVisible, setIsUroPayModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isServiceable, setIsServiceable] = useState<boolean | null>(null);
  const [activeZoneName, setActiveZoneName] = useState<string | null>(null);
  const [deliveryCharge, setDeliveryCharge] = useState(DEFAULT_DELIVERY_FEE);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  
  // Intelligent default: UPI for high-value, Cash otherwise
  React.useEffect(() => {
    if (totalAmount > MAX_COD_AMOUNT && selectedPaymentMethod === 'Cash') {
      setSelectedPaymentMethod('UPI');
    }
  }, [totalAmount]);


  const calculateSubtotal = () => {
    return products.reduce((total: number, item: CheckoutItem) => {
      const price = item.lockedPrice || item.product.price;
      return total + (price * item.quantity);
    }, 0);
  };

  const walletBalance = user?.walletBalance || 0;
  const subtotal = calculateSubtotal();
  const deliveryFee = deliveryCharge;
  const totalAmount = subtotal + deliveryFee;
  
  const walletDeduction = useWallet ? Math.min(totalAmount, walletBalance) : 0;
  const finalPayable = totalAmount - walletDeduction;

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
        return false;
      }
    }
    return true;
  };

  const useCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      showToast({message: 'Location permission required for delivery', type: 'error'});
      return;
    }

    setLocationLoading(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        setCoordinates({lat: latitude, lng: longitude});
        const result = await locationService.reverseGeocode(latitude, longitude);
        if (result) {
          // Intelligent address parsing
          const streetFallback = result.street || result.formatted.split(',')[0];
          setAddress({
            street: streetFallback || '',
            city: result.city || 'Bengaluru',
            state: result.state || 'Karnataka',
            pincode: result.postcode || '',
            landmark: '',
          });
        }
        setLocationLoading(false);
        if (latitude && longitude) {
          checkZoneServiceability(latitude, longitude);
        }
      },
      error => {
        showToast({message: 'Could not get GPS location', type: 'error'});

        setLocationLoading(false);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const fetchDeliveryQuote = async (lat: number, lng: number) => {
    try {
      setIsQuoteLoading(true);
      const res = await axiosInstance.post('/api/orders/batch/quote', {
        items: products.map(p => ({ productId: p.product._id })),
        lat,
        lng
      });
      if (res.data.success) {
        setDeliveryCharge(res.data.data.totalDeliveryFee);
      }
    } catch (error) {
      console.error('Quote Error:', error);
    } finally {
      setIsQuoteLoading(false);
    }
  };

  React.useEffect(() => {
    if (coordinates) {
      fetchDeliveryQuote(coordinates.lat, coordinates.lng);
    }
  }, [coordinates]);

  const updateQuantity = (index: number, delta: number) => {
    const newProducts = [...products];
    const newQty = Math.max(1, newProducts[index].quantity + delta);
    newProducts[index].quantity = newQty;
    setProducts(newProducts);
  };

  const checkZoneServiceability = async (lat: number, lng: number) => {
    try {
      const res = await axiosInstance.get(`/api/zones/check?lat=${lat}&lng=${lng}`);
      if (res.data.success) {
        setIsServiceable(res.data.isServiceable);
        setActiveZoneName(res.data.zoneName);
        if (!res.data.isServiceable) {
          showToast({
            message: 'Out of Zone: We currently serve only specific hubs in Bengaluru.', 
            type: 'error'
          });
        }
      }
    } catch (err) {
      console.error('Zone check error:', err);
    }
  };

  const validateCheckout = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast({message: 'Please enter a valid 10-digit phone number for fulfillment coordination.', type: 'info'});
      return false;
    }
    const {street, city, state, pincode} = address;
    if (!street || !city || !state || !pincode) {
      showToast({message: 'Please fill in all address fields for home delivery.', type: 'info'});
      return false;
    }
    if (!coordinates) {
      showToast({message: 'Please PIN your exact delivery location using GPS.', type: 'error'});
      return false;
    }
    if (pincode.length !== 6) {
      showToast({message: 'Pincode must be exactly 6 digits.', type: 'info'});
      return false;
    }
    if (fulfillmentMethod === 'delivery' && isServiceable === false) {
      showToast({
        message: 'Sorry, your location is outside our operational zones.', 
        type: 'error'
      });
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCheckout()) return;

    try {
      setLoading(true);
      
      const payload = {
        items: products.map((item: CheckoutItem) => {
          if (!item.product?._id) throw new Error('Invalid product in cart');
          return {
            productId: item.product._id,
            quantity: item.quantity,
            price: item.lockedPrice || item.product.price
          };
        }),
        paymentMethod: selectedPaymentMethod === 'Cash' 
             ? 'Cash on Delivery'
             : 'Direct UPI Transfer',
        paymentReference: selectedPaymentMethod === 'Cash' ? undefined : (utrValue || 'PENDING_AUTO'),
        fulfillmentMethod,
        deliveryAddress: address,
        deliveryCharge: deliveryFee, 
        buyerPhone: phoneNumber,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
        useWallet: useWallet,
      };


      if (selectedPaymentMethod === 'UPI') {
        if (!utrValue || utrValue.length < 10) {
          showToast({message: 'Please enter your 12-digit Transaction ID (UTR) for verification.', type: 'info'});
          setLoading(false);
          return;
        }
        
        const response = await axiosInstance.post('/api/orders/batch', payload);
        const orders = response.data.data.orders;
        
        navigation.replace('OrderSuccess', { 
          orderId: orders[0]._id,
          paymentMethod: 'Direct UPI Transfer',
          fulfillmentMethod,
          deliveryCode: orders[0].deliveryCode,
          pickupCode: orders[0].pickupCode
        });
        return;
      }

      // Cash method processing
      const response = await axiosInstance.post('/api/orders/batch', payload);
      const batchData = response.data.data;
      const orders = batchData?.orders || [];
      
      if (!orders || orders.length === 0) {
        throw new Error('Order creation failed on server');
      }
      
      navigation.replace('OrderSuccess', { 
        orderId: orders[0]._id,
        paymentMethod: payload.paymentMethod,
        fulfillmentMethod,
        deliveryCode: orders[0].deliveryCode,
        pickupCode: orders[0].pickupCode
      });

    } catch (error: any) {
      showToast({
        message: error.response?.data?.message || 'Failed to place order',
        type: 'error',
      });
    } finally {

      setLoading(false);
    }
  };



  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
           <Skeleton width={180} height={24} />
        </View>
        <View style={{ padding: 20, gap: 20 }}>
           <Skeleton width="100%" height={100} borderRadius={20} />
           <Skeleton width="100%" height={200} borderRadius={24} />
           <Skeleton width="100%" height={150} borderRadius={20} />
           <Skeleton width="100%" height={120} borderRadius={24} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
        
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Order</Text>
          <View style={{width: 44}} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Item List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Items</Text>
            {products.map((item: CheckoutItem, index: number) => (
              <Animated.View key={index} entering={FadeInDown.delay(index * 100)} style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.product.title}</Text>
                  <Text style={styles.itemPrice}>₹{item.product.price.toLocaleString()}</Text>
                </View>
                <View style={styles.quantityControl}>
                  <TouchableOpacity onPress={() => updateQuantity(index, -1)} style={styles.qtyBtn}>
                    <Icon name="remove" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => updateQuantity(index, 1)} style={styles.qtyBtn}>
                    <Icon name="add" size={16} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Text style={styles.sectionSub}>Required for order fulfillment and coordination</Text>
            <Input
              placeholder="10-digit Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={10}
              leftIcon={<Icon name="call-outline" size={20} color={theme.colors.muted} />}
            />
          </View>



            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Location (GPS Mandatory)</Text>
              <Text style={styles.sectionSub}>Pin your position to ensure accurate delivery</Text>
              
              <TouchableOpacity
                style={[styles.gpsButton, coordinates && {backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success + '20'}]}
                onPress={useCurrentLocation}
                disabled={locationLoading}>
                <Icon 
                  name={coordinates ? "location" : "navigate"} 
                  size={20} 
                  color={coordinates ? theme.colors.success : theme.colors.primary} 
                />
                <Text style={[styles.gpsButtonText, coordinates && {color: theme.colors.success}]}>
                  {locationLoading
                    ? 'PINNING GPS...'
                    : coordinates ? 'DELIVERY LOCATION PINNED' : 'PIN MY DELIVERY LOCATION'}
                </Text>
              </TouchableOpacity>

              <View style={{marginTop: 16}}>
                <Input
                  placeholder="House No / Flat Name / Street"
                  value={address.street}
                  onChangeText={(text) => setAddress({...address, street: text})}
                  style={styles.input}
                  disabled={!coordinates}
                />
                <View style={styles.row}>
                  <View style={{flex: 1}}>
                    <Input
                      placeholder="City"
                      value={address.city}
                      onChangeText={(text) => setAddress({...address, city: text})}
                      disabled={!coordinates}
                    />
                  </View>
                  <View style={{width: 12}} />
                  <View style={{flex: 1}}>
                    <Input
                      placeholder="State"
                      value={address.state}
                      onChangeText={(text) => setAddress({...address, state: text})}
                      disabled={!coordinates}
                    />
                  </View>
                </View>
                <Input
                  placeholder="Pincode"
                  value={address.pincode}
                  onChangeText={(text) => setAddress({...address, pincode: text})}
                  keyboardType="numeric"
                  style={styles.input}
                  disabled={!coordinates}
                />
                <Input
                  placeholder="Landmark (Optional)"
                  value={address.landmark}
                  onChangeText={(text) => setAddress({...address, landmark: text})}
                  style={styles.input}
                  disabled={!coordinates}
                />
              </View>
            </View>

          {/* Wallet Section */}
          {walletBalance > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Velto Wallet</Text>
              <TouchableOpacity 
                style={[styles.walletCard, useWallet && styles.walletCardActive]}
                onPress={() => setUseWallet(!useWallet)}
                activeOpacity={0.7}
              >
                <View style={styles.walletInfo}>
                  <View style={[styles.walletIconBox, {backgroundColor: useWallet ? theme.colors.success : '#F1F5F9'}]}>
                    <Icon name="wallet-outline" size={20} color={useWallet ? theme.colors.white : theme.colors.muted} />
                  </View>
                  <View>
                    <Text style={styles.walletTitle}>Use Wallet Balance</Text>
                    <Text style={styles.walletBalanceText}>Available: ₹{walletBalance.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={[styles.checkbox, useWallet && styles.checkboxActive]}>
                  {useWallet && <Icon name="checkmark" size={14} color={theme.colors.white} />}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Payment Method Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {totalAmount > MAX_COD_AMOUNT && (
                <View style={styles.safetyBadge}>
                  <Icon name="shield-checkmark" size={12} color={theme.colors.text} />
                  <Text style={styles.safetyBadgeText}>High-Value Protection Active</Text>
                </View>
              )}

            </View>

            <View style={styles.fulfillmentRow}>
              {totalAmount <= MAX_COD_AMOUNT ? (
                <TouchableOpacity 
                  style={[styles.methodCard, selectedPaymentMethod === 'Cash' && styles.activeMethod]}
                  onPress={() => setSelectedPaymentMethod('Cash')}>
                  <Icon name="cash-outline" size={24} color={selectedPaymentMethod === 'Cash' ? theme.colors.primary : theme.colors.muted} />
                  <Text style={[styles.methodLabel, selectedPaymentMethod === 'Cash' && styles.activeMethodLabel]}>Cash on Delivery</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.methodCard, styles.disabledMethod]}>
                  <Icon name="lock-closed-outline" size={24} color={theme.colors.muted} />
                  <Text style={styles.disabledMethodLabel}>COD Unavailable</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.methodCard, selectedPaymentMethod === 'UPI' && styles.activeMethod]}
                onPress={() => setSelectedPaymentMethod('UPI')}>
                <Icon name="phone-portrait-outline" size={24} color={selectedPaymentMethod === 'UPI' ? theme.colors.primary : theme.colors.muted} />
                <Text style={[styles.methodLabel, selectedPaymentMethod === 'UPI' && styles.activeMethodLabel]}>Direct UPI</Text>
              </TouchableOpacity>
              
            </View>

            {selectedPaymentMethod === 'UPI' && (
              <Animated.View entering={FadeInUp} style={styles.upiActionBox}>
                <Text style={styles.upiTitle}>Instant UPI Payment</Text>
                <Text style={styles.upiSub}>Select an app to pay ₹{finalPayable.toLocaleString()}</Text>
                
                    <View style={styles.manualUpiBox}>
                      <View>
                        <Text style={styles.manualUpiLabel}>Platform UPI ID</Text>
                        <Text style={styles.manualUpiId}>badal90603@okicici</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.copyBtn}
                        onPress={() => {
                          Clipboard.setString('badal90603@okicici');
                          showToast({message: 'UPI ID copied to clipboard', type: 'success'});
                        }}>
                        <Icon name="copy-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.upiAppsTitle}>Instant Pay via Apps</Text>
                    <View style={styles.upiAppsRow}>
                   <TouchableOpacity 
                     style={styles.upiAppBtn} 
                     onPress={() => {
                       const url = `upi://pay?pa=badal90603@okicici&pn=Velto%20Marketplace&am=${finalPayable}&cu=INR&tn=Velto%20Order`;
                       Linking.openURL(url).catch(() => showToast({message: 'Could not open UPI apps', type: 'error'}));
                     }}>
                     <View style={styles.upiIconContainer}>
                       <Image source={{uri: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-pay-icon.png'}} style={styles.upiIcon} />
                     </View>
                     <Text style={styles.upiAppName}>GPay</Text>
                   </TouchableOpacity>

                   <TouchableOpacity 
                     style={styles.upiAppBtn}
                     onPress={() => {
                       const url = `upi://pay?pa=badal90603@okicici&pn=Velto%20Marketplace&am=${finalPayable}&cu=INR&tn=Velto%20Order`;
                       Linking.openURL(url).catch(() => showToast({message: 'Could not open UPI apps', type: 'error'}));
                     }}>
                     <View style={styles.upiIconContainer}>
                       <Image source={{uri: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/phonepe-logo-icon.png'}} style={styles.upiIcon} />
                     </View>
                     <Text style={styles.upiAppName}>PhonePe</Text>
                   </TouchableOpacity>

                   <TouchableOpacity 
                     style={styles.upiAppBtn}
                     onPress={() => {
                       const url = `upi://pay?pa=badal90603@okicici&pn=Velto%20Marketplace&am=${finalPayable}&cu=INR&tn=Velto%20Order`;
                       Linking.openURL(url).catch(() => showToast({message: 'Could not open UPI apps', type: 'error'}));
                     }}>
                     <View style={styles.upiIconContainer}>
                       <Image source={{uri: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/paytm-icon.png'}} style={styles.upiIcon} />
                     </View>
                     <Text style={styles.upiAppName}>Paytm</Text>
                   </TouchableOpacity>
                </View>

                <View style={styles.utrContainer}>
                   <Input
                     label="Enter 12-digit Transaction ID (UTR)"
                     placeholder="e.g. 412345678901"
                     value={utrValue}
                     onChangeText={setUtrValue}
                     keyboardType="numeric"
                     maxLength={12}
                   />
                   <Text style={styles.utrHint}>Required for manual payment verification</Text>
                   <View style={styles.manualTip}>
                      <Icon name="information-circle-outline" size={14} color={theme.colors.muted} />
                      <Text style={styles.manualTipText}>If the apps show a security warning, please copy the UPI ID above and pay manually.</Text>
                   </View>
                </View>
              </Animated.View>
            )}

            {totalAmount > MAX_COD_AMOUNT && (
              <Animated.View entering={FadeInUp} style={styles.codWarningBox}>
                <Icon name="information-circle" size={18} color={theme.colors.text} />
                <Text style={styles.codWarningText}>
                  Cash on Delivery is unavailable for orders above ₹{MAX_COD_AMOUNT.toLocaleString()}. Please use Direct UPI for secure high-value checkout.
                </Text>
              </Animated.View>
            )}
            
            <View style={styles.openBoxDisclaimer}>
              <Icon name="cube-outline" size={20} color={theme.colors.info} />
              <Text style={styles.openBoxDisclaimerText}>
                <Text style={{fontWeight: '900', color: theme.colors.text}}>Open Box Delivery:</Text> Please inspect your products before sharing the Handshake Code. No returns are accepted after acceptance.
              </Text>
            </View>
          </View>

          {/* Bill Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill Details</Text>
            <View style={styles.billCard}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Subtotal</Text>
                <Text style={styles.billTotal}>₹{subtotal.toLocaleString()}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Charge</Text>
                {isQuoteLoading ? (
                  <Text style={[styles.billTotal, {color: theme.colors.muted}]}>Calculating...</Text>
                ) : (
                  <Text style={[styles.billTotal, {color: theme.colors.success}]}>
                    ₹{deliveryCharge}
                  </Text>
                )}
              </View>
              
              {useWallet && walletDeduction > 0 && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, {color: theme.colors.success}]}>Wallet Deduction</Text>
                  <Text style={[styles.billTotal, {color: theme.colors.success}]}>- ₹{walletDeduction.toLocaleString()}</Text>
                </View>
              )}

              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, {color: theme.colors.text, fontWeight: '900'}]}>Total Payable</Text>
                <Text style={[styles.billTotal, {color: theme.colors.text, fontSize: 18, fontWeight: '900'}]}>₹{finalPayable.toLocaleString()}</Text>
              </View>
            </View>
          </View>



          <View style={{height: 120}} />
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalAmount}>₹{finalPayable.toLocaleString()}</Text>
          </View>
          <Button
            title={finalPayable === 0 ? "Pay with Wallet" : "Confirm & Place Order"}
            type="primary"
            isLoading={loading}
            onPress={handlePlaceOrder}
            style={styles.confirmBtn}
          />
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  scrollContent: {padding: 20},
  section: {marginBottom: 32},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    ...theme.shadow.sm,
    alignItems: 'center',
  },
  itemInfo: {flex: 1},
  itemTitle: {fontSize: 15, fontWeight: '700', color: theme.colors.text},
  itemPrice: {fontSize: 14, color: theme.colors.primary, fontWeight: '800', marginTop: 4},
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  qtyBtn: {padding: 6},
  qtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    paddingHorizontal: 12,
  },
  fulfillmentRow: {flexDirection: 'row', gap: 12},
  methodCard: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Flatter unselected background
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 0.8,
    borderColor: '#E2E8F0', // Visible but subtle border for unselected
  },
  activeMethod: {
    borderColor: theme.colors.info + '60',
    backgroundColor: theme.colors.white, // Pop with white background
    ...theme.shadow.md, // Pop with shadow only when selected
  },
  methodLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  activeMethodLabel: {
    color: theme.colors.primary,
  },
  disabledMethod: {
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  disabledMethodLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.muted,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  safetyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  safetyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
    textTransform: 'uppercase',
  },

  codWarningBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  codWarningText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  input: {marginBottom: 12},
  row: {flexDirection: 'row', marginBottom: 12},
  billCard: {
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  billTotal: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '800',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  pickupInfoCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary + '10',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 16,
  },
  pickupInfoTextContainer: {flex: 1},
  pickupInfoTitle: {fontSize: 15, fontWeight: '800', color: theme.colors.primary},
  pickupInfoSub: {fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18},
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: theme.colors.white,
    padding: 20,
    paddingBottom: 34,
    ...theme.shadow.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  totalBlock: {flex: 1},
  totalLabel: {fontSize: 12, color: theme.colors.muted, fontWeight: '700'},
  totalAmount: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  confirmBtn: {flex: 1.5, borderRadius: 16},
  openBoxDisclaimer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.info + '08',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.info + '20',
  },
  openBoxDisclaimerText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  walletCardActive: {
    borderColor: theme.colors.success + '40',
    backgroundColor: theme.colors.success + '05',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  walletBalanceText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '85%',
    ...theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  uroPayBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  uroPayBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 20,
  },
  payBtn: {
    marginBottom: 40,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.white,
    borderWidth: 0.8,
    borderColor: theme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...theme.shadow.sm,
  },
  gpsButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  // UPI Styles
  upiActionBox: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadow.sm,
  },
  upiTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
  },
  upiSub: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    fontWeight: '500',
  },
  upiAppsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  upiAppBtn: {
    alignItems: 'center',
    gap: 8,
  },
  upiIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  upiIcon: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  upiAppName: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  manualUpiBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manualUpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  manualUpiId: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.text,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  upiAppsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  manualTip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    backgroundColor: theme.colors.white,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  manualTipText: {
    flex: 1,
    fontSize: 10,
    color: theme.colors.muted,
    lineHeight: 14,
    fontWeight: '500',
  },
  utrContainer: {
    marginTop: 8,
  },
  utrLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  utrHint: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: '500',
  },
});