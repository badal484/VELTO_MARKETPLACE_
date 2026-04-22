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
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {locationService} from '../../services/locationService';
import RazorpayCheckout from 'react-native-razorpay';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {useAuth} from '../../hooks/useAuth';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';

import { IProduct } from '@shared/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { HomeStackParamList } from '../../navigation/types';

const DELIVERY_FEE = 40;
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
  const {showToast} = useToast();
  const {user} = useAuth();
  const {products: initialProducts} = route.params as { products: CheckoutItem[] };
  const [products, setProducts] = useState<CheckoutItem[]>(initialProducts);
  const [fulfillmentMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Cash' | 'Razorpay'>('Cash');
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
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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
      },
      error => {
        showToast({message: 'Could not get GPS location', type: 'error'});
        setLocationLoading(false);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const updateQuantity = (index: number, delta: number) => {
    const newProducts = [...products];
    const newQty = Math.max(1, newProducts[index].quantity + delta);
    newProducts[index].quantity = newQty;
    setProducts(newProducts);
  };

  const calculateSubtotal = () => {
    return products.reduce((total: number, item: CheckoutItem) => {
      const price = item.lockedPrice || item.product.price;
      return total + (price * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const fee = fulfillmentMethod === 'delivery' ? DELIVERY_FEE : 0;
    return subtotal + fee;
  };

  const validateCheckout = () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      showToast({message: 'Please enter a valid 10-digit phone number for fulfillment coordination.', type: 'info'});
      return false;
    }
    if (fulfillmentMethod === 'pickup') return true;
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
             ? (fulfillmentMethod === 'pickup' ? 'Cash on Pickup' : 'Cash on Delivery') 
             : 'Razorpay',
        paymentReference: selectedPaymentMethod === 'Razorpay' ? (utrValue || 'PENDING_AUTO') : undefined,
        fulfillmentMethod,
        deliveryAddress: fulfillmentMethod === 'delivery' ? address : undefined,
        deliveryCharge: fulfillmentMethod === 'delivery' ? DELIVERY_FEE : 0, 
        buyerPhone: phoneNumber,
        lat: coordinates?.lat,
        lng: coordinates?.lng,
      };

      if (selectedPaymentMethod === 'Razorpay') {
        const res = await axiosInstance.post('/api/orders/batch', payload);
        const { razorpayOrder, orders } = res.data.data;

        const options = {
          description: 'Payment for Velto Order',
          image: 'https://ik.imagekit.io/oellcbqek/velto_logo.png',
          currency: 'INR',
          key: 'rzp_test_SdCBOGIizlvuxK',
          amount: razorpayOrder.amount,
          name: 'Velto Marketplace',
          order_id: razorpayOrder.id,
          prefill: {
            email: user?.email || 'customer@example.com',
            contact: phoneNumber,
            name: user?.name || 'Velto Customer'
          },
          theme: {color: theme.colors.primary}
        };

        if (!RazorpayCheckout || typeof RazorpayCheckout.open !== 'function') {
           throw new Error('Payment module not linked. Please restart the app.');
        }

        try {
          RazorpayCheckout.open(options).then(async (data: any) => {
            await axiosInstance.post('/api/payments/verify', {
              razorpay_order_id: data.razorpay_order_id,
              razorpay_payment_id: data.razorpay_payment_id,
              razorpay_signature: data.razorpay_signature
            });
            
            navigation.replace('OrderSuccess', { 
              orderId: orders[0]._id,
              paymentMethod: 'Razorpay',
              fulfillmentMethod,
              deliveryCode: orders[0].deliveryCode,
              pickupCode: orders[0].pickupCode
            });
          }).catch((err: any) => {
            showToast({message: `Payment Failed: ${err.description || 'Cancelled'}`, type: 'error'});
          });

        } catch (innerErr: any) {
          showToast({message: innerErr.message, type: 'error'});
        }
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



  if (loading) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        


        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{flex: 1}}>
        
        <View style={styles.header}>
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

          {/* Payment Method Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {calculateTotal() > MAX_COD_AMOUNT && (
                <View style={styles.safetyBadge}>
                  <Icon name="shield-checkmark" size={12} color={theme.colors.text} />
                  <Text style={styles.safetyBadgeText}>High-Value Protection Active</Text>
                </View>
              )}

            </View>

            <View style={styles.fulfillmentRow}>
              {calculateTotal() <= MAX_COD_AMOUNT ? (
                <TouchableOpacity 
                  style={[styles.methodCard, selectedPaymentMethod === 'Cash' && styles.activeMethod]}
                  onPress={() => setSelectedPaymentMethod('Cash')}>
                  <Icon name="cash-outline" size={24} color={selectedPaymentMethod === 'Cash' ? theme.colors.primary : theme.colors.muted} />
                  <Text style={[styles.methodLabel, selectedPaymentMethod === 'Cash' && styles.activeMethodLabel]}>Cash on {fulfillmentMethod === 'delivery' ? 'Delivery' : 'Pickup'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.methodCard, styles.disabledMethod]}>
                  <Icon name="lock-closed-outline" size={24} color={theme.colors.muted} />
                  <Text style={styles.disabledMethodLabel}>COD Unavailable</Text>
                </View>
              )}
              
              <TouchableOpacity 
                style={[styles.methodCard, selectedPaymentMethod === 'Razorpay' && styles.activeMethod]}
                onPress={() => {
                  setSelectedPaymentMethod('Razorpay');
                }}>
                <Icon name="card-outline" size={24} color={selectedPaymentMethod === 'Razorpay' ? theme.colors.primary : theme.colors.muted} />
                <Text style={[styles.methodLabel, selectedPaymentMethod === 'Razorpay' && styles.activeMethodLabel]}>Razorpay Secure</Text>
              </TouchableOpacity>
            </View>

            {calculateTotal() > MAX_COD_AMOUNT && (
              <Animated.View entering={FadeInUp} style={styles.codWarningBox}>
                <Icon name="information-circle" size={18} color={theme.colors.text} />
                <Text style={styles.codWarningText}>
                  Cash on Delivery is unavailable for orders above ₹{MAX_COD_AMOUNT.toLocaleString()}. Please use Razorpay for secure high-value checkout.
                </Text>
              </Animated.View>
            )}

          </View>

          {/* Bill Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill Details</Text>
            <View style={styles.billCard}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Subtotal</Text>
                <Text style={styles.billTotal}>₹{calculateSubtotal().toLocaleString()}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Charge</Text>
                <Text style={[styles.billTotal, fulfillmentMethod === 'delivery' ? {color: theme.colors.success} : {color: theme.colors.muted}]}>
                  {fulfillmentMethod === 'delivery' ? `₹${DELIVERY_FEE}` : 'FREE'}
                </Text>
              </View>
              <View style={styles.billDivider} />
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, {color: theme.colors.text, fontWeight: '900'}]}>Grand Total</Text>
                <Text style={[styles.billTotal, {color: theme.colors.text, fontSize: 18, fontWeight: '900'}]}>₹{calculateTotal().toLocaleString()}</Text>
              </View>
            </View>
          </View>



          <View style={{height: 120}} />
        </ScrollView>

        {/* Footer actions */}
        <View style={styles.footer}>
          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalAmount}>₹{calculateTotal().toLocaleString()}</Text>
          </View>
          <Button
            title="Confirm & Place Order"
            type="primary"
            isLoading={loading}
            onPress={handlePlaceOrder}
            style={styles.confirmBtn}
          />
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
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
  qrCard: {
    alignItems: 'center',
    marginVertical: 24,
    padding: 24,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPlaceholder: {
    padding: 20,
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    marginBottom: 16,
    position: 'relative',
    ...theme.shadow.sm,
  },
  qrInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 16,
  },
  upiId: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  upiName: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  payableAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 16,
  },
  uniqueTotal: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 4,
  },
  deepLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 20,
    gap: 8,
  },
  deepLinkText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  utrSection: {
    marginBottom: 24,
  },
  utrLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  utrInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  utrHint: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 8,
    lineHeight: 16,
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
});