import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {launchImageLibrary} from 'react-native-image-picker';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {useAuth} from '../../hooks/useAuth';
import {Button} from '../../components/common/Button';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {HomeStackParamList} from '../../navigation/types';
import {PharmacyCartItem} from './PharmacyScreen';
import RazorpayCheckout from 'react-native-razorpay';
import Geolocation from 'react-native-geolocation-service';
import {locationService} from '../../services/locationService';

type Nav = StackNavigationProp<HomeStackParamList, 'PharmacyCheckout'>;
type Route = RouteProp<HomeStackParamList, 'PharmacyCheckout'>;

interface Props {
  navigation: Nav;
  route: Route;
}

type PaymentMethod = 'Cash on Delivery' | 'Razorpay' | 'Direct UPI Transfer';

export default function PharmacyCheckoutScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const {user} = useAuth();

  const {cart: cartItems, coords, openPrescription} = route.params as {
    cart: PharmacyCartItem[];
    coords?: {lat: number; lng: number};
    openPrescription?: boolean;
  };

  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: 'Karnataka',
    pincode: '',
    landmark: '',
  });
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    'Cash on Delivery',
  );
  const [useWallet, setUseWallet] = useState(false);
  const [prescription, setPrescription] = useState<any>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const walletBalance = user?.walletBalance ?? 0;
  const itemsTotal = cartItems.reduce(
    (sum, c) => sum + c.item.mrp * c.quantity,
    0,
  );
  const deliveryCharge = 0; // free delivery for pharmacy pilot
  const walletDeduction = useWallet ? Math.min(walletBalance, itemsTotal) : 0;
  const amountDue = itemsTotal + deliveryCharge - walletDeduction;

  const needsPrescription =
    openPrescription || cartItems.some(c => c.item.requiresPrescription);
  const isPrescriptionReady = !needsPrescription || prescription != null;
  const isConsentReady = !needsPrescription || consentGiven;

  // Auto-open image picker if navigated from "Upload Prescription" CTA
  useEffect(() => {
    if (openPrescription) pickPrescription();
  }, []);

  const pickPrescription = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.9,
      maxWidth: 2048,
      maxHeight: 2048,
    });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPrescription({
      uri: asset.uri,
      type: asset.type ?? 'image/jpeg',
      name: asset.fileName ?? `rx_${Date.now()}.jpg`,
    });
    showToast({message: 'Prescription added', type: 'success'});
  };

  const validate = (): string | null => {
    if (!phone.trim() || phone.trim().length < 10)
      return 'Enter a valid 10-digit phone number';
    if (!address.street.trim()) return 'Enter street address';
    if (!address.city.trim()) return 'Enter city';
    if (!address.pincode.trim() || address.pincode.length < 6)
      return 'Enter valid 6-digit pincode';
    if (cartItems.length === 0 && !openPrescription)
      return 'Your cart is empty';
    if (needsPrescription && !prescription)
      return 'Please upload a prescription for Rx items';
    if (needsPrescription && !consentGiven)
      return 'You must consent to prescription sharing';
    return null;
  };

  const fetchCurrentLocation = () => {
    setLocationLoading(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        const result = await locationService.reverseGeocode(latitude, longitude);
        if (result) {
          const streetFallback = result.street || result.formatted.split(',')[0];
          setAddress(prev => ({
            ...prev,
            street: streetFallback || '',
            city: result.city || 'Bengaluru',
            state: result.state || 'Karnataka',
            pincode: result.postcode || '',
          }));
          showToast({message: 'Address filled from GPS', type: 'success'});
        } else {
          showToast({message: 'Could not fetch address details', type: 'error'});
        }
        setLocationLoading(false);
      },
      error => {
        setLocationLoading(false);
        showToast({message: 'Could not get GPS location', type: 'error'});
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const placeOrder = async () => {
    const err = validate();
    if (err) {
      showToast({message: err, type: 'error'});
      return;
    }

    if (paymentMethod === 'Razorpay') {
      await placeWithRazorpay();
    } else {
      await placeDirectly();
    }
  };

  const buildFormData = (extraFields: Record<string, string> = {}): FormData => {
    const formData = new FormData();

    // Cart items
    formData.append(
      'items',
      JSON.stringify(
        cartItems.map(c => ({
          catalogItemId: c.item._id,
          quantity: c.quantity,
        })),
      ),
    );

    formData.append('paymentMethod', paymentMethod);
    formData.append('buyerPhone', phone.trim());
    formData.append(
      'deliveryAddress',
      JSON.stringify({
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
        landmark: address.landmark.trim(),
      }),
    );
    formData.append('deliveryCharge', String(deliveryCharge));
    formData.append(
      'walletAmountToUse',
      String(useWallet ? walletDeduction : 0),
    );
    formData.append('prescriptionConsent', consentGiven ? 'true' : 'false');

    if (coords) {
      formData.append('lat', String(coords.lat));
      formData.append('lng', String(coords.lng));
    }

    if (prescription) {
      formData.append('prescription', prescription);
    }

    Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v));

    return formData;
  };

  const placeDirectly = async () => {
    setPlacing(true);
    try {
      const formData = buildFormData();
      const res = await axiosInstance.post('/api/pharmacy/orders', formData);
      if (res.data?.success) {
        navigation.replace('OrderSuccess', {
          orderId: res.data.data._id,
          paymentMethod,
          fulfillmentMethod: 'delivery',
        });
      }
    } catch (err: any) {
      showToast({
        message: err?.message ?? 'Could not place order. Please try again.',
        type: 'error',
      });
    } finally {
      setPlacing(false);
    }
  };

  const placeWithRazorpay = async () => {
    setPlacing(true);
    try {
      // Step 1: Create Razorpay order on server
      const initRes = await axiosInstance.post(
        '/api/payments/create-razorpay-order',
        {amount: amountDue},
      );
      if (!initRes.data?.success) throw new Error('Could not create payment order');

      const {razorpayOrderId, amount, currency, keyId} = initRes.data.data;

      // Step 2: Open Razorpay checkout
      const options = {
        description: 'Velto Pharmacy Order',
        image: 'https://your-logo-url.png',
        currency,
        key: keyId,
        amount: String(amount),
        order_id: razorpayOrderId,
        name: 'Velto Pharmacy',
        prefill: {
          email: user?.email ?? '',
          contact: phone.trim(),
          name: user?.name ?? '',
        },
        theme: {color: theme.colors.primary},
      };

      const paymentData = await RazorpayCheckout.open(options);

      // Step 3: Place pharmacy order with razorpay info
      const formData = buildFormData({
        razorpayOrderId,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      });

      const res = await axiosInstance.post('/api/pharmacy/orders', formData);
      if (res.data?.success) {
        navigation.replace('OrderSuccess', {
          orderId: res.data.data._id,
          paymentMethod: 'Razorpay',
          fulfillmentMethod: 'delivery',
        });
      }
    } catch (err: any) {
      if (err?.code !== 'PAYMENT_CANCELLED') {
        showToast({
          message: err?.message ?? 'Payment failed. Please try again.',
          type: 'error',
        });
      }
    } finally {
      setPlacing(false);
    }
  };

  const renderAddressField = (
    label: string,
    key: keyof typeof address,
    placeholder: string,
    options?: {keyboardType?: any; maxLength?: number},
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        value={address[key]}
        onChangeText={v => setAddress(prev => ({...prev, [key]: v}))}
        {...options}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medicine Checkout</Text>
        <View style={{width: 36}} />
      </View>

      <ScrollView
        contentContainerStyle={{padding: 16, paddingBottom: 120}}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* Order summary */}
        {cartItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            {cartItems.map(c => (
              <View key={c.item._id} style={styles.summaryRow}>
                <Text style={styles.summaryName} numberOfLines={1}>
                  {c.item.name}{' '}
                  <Text style={styles.summaryBrand}>({c.item.brand})</Text>
                </Text>
                <Text style={styles.summaryQty}>
                  {c.quantity} × ₹{c.item.mrp}
                </Text>
                <Text style={styles.summaryAmt}>
                  ₹{(c.item.mrp * c.quantity).toFixed(0)}
                </Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryName, {fontWeight: '700'}]}>
                Items Total
              </Text>
              <Text style={[styles.summaryAmt, {fontWeight: '700'}]}>
                ₹{itemsTotal.toFixed(0)}
              </Text>
            </View>
            {deliveryCharge > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryName}>Delivery</Text>
                <Text style={styles.summaryAmt}>₹{deliveryCharge}</Text>
              </View>
            )}
            {deliveryCharge === 0 && (
              <Text style={styles.freeDelivery}>
                🎉 Free delivery on pharmacy orders
              </Text>
            )}
          </View>
        )}

        {/* Prescription upload */}
        {needsPrescription && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prescription</Text>
            <Text style={styles.hint}>
              One or more items require a valid doctor's prescription.
            </Text>

            {prescription ? (
              <View style={styles.prescriptionCard}>
                <Image
                  source={{uri: prescription.uri}}
                  style={styles.prescriptionThumb}
                  resizeMode="cover"
                />
                <View style={styles.prescriptionMeta}>
                  <Text style={styles.prescriptionLabel}>
                    Prescription uploaded ✓
                  </Text>
                  <TouchableOpacity onPress={pickPrescription}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={pickPrescription}
                activeOpacity={0.8}>
                <Icon
                  name="cloud-upload-outline"
                  size={24}
                  color={theme.colors.accent}
                />
                <Text style={styles.uploadText}>
                  Tap to upload prescription photo
                </Text>
              </TouchableOpacity>
            )}

            {/* Consent */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setConsentGiven(v => !v)}
              activeOpacity={0.9}>
              <View
                style={[
                  styles.checkbox,
                  consentGiven && styles.checkboxChecked,
                ]}>
                {consentGiven && (
                  <Icon name="checkmark" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.consentText}>
                I consent to sharing this prescription with the dispensing
                pharmacy. My contact details will{' '}
                <Text style={{fontWeight: '700'}}>never</Text> be shared.
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery address */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, {marginBottom: 0}]}>Delivery Address</Text>
            <TouchableOpacity 
              style={styles.gpsBtn} 
              onPress={fetchCurrentLocation}
              disabled={locationLoading}
              activeOpacity={0.8}>
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : (
                <>
                  <Icon name="location" size={14} color={theme.colors.accent} />
                  <Text style={styles.gpsBtnText}>Use GPS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={{height: 12}} />
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor={theme.colors.muted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
          {renderAddressField('Street / House No.', 'street', 'e.g. 12, Main Road')}
          {renderAddressField('City', 'city', 'e.g. Mysuru')}
          {renderAddressField('State', 'state', 'e.g. Karnataka')}
          {renderAddressField('Pincode', 'pincode', '6-digit pincode', {
            keyboardType: 'number-pad',
            maxLength: 6,
          })}
          {renderAddressField('Landmark (optional)', 'landmark', 'e.g. near bus stop')}
        </View>

        {/* Wallet */}
        {walletBalance > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.walletRow}
              onPress={() => setUseWallet(v => !v)}
              activeOpacity={0.9}>
              <View style={styles.walletLeft}>
                <Icon name="wallet-outline" size={20} color={theme.colors.accent} />
                <View>
                  <Text style={styles.walletTitle}>Velto Wallet</Text>
                  <Text style={styles.walletBalance}>
                    ₹{walletBalance.toFixed(0)} available
                  </Text>
                </View>
              </View>
              <View
                style={[styles.toggle, useWallet && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleKnob,
                    useWallet && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
            {useWallet && (
              <Text style={styles.walletDeduction}>
                ₹{walletDeduction.toFixed(0)} will be deducted from wallet
              </Text>
            )}
          </View>
        )}

        {/* Payment method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {(['Cash on Delivery', 'Razorpay', 'Direct UPI Transfer'] as PaymentMethod[]).map(
            method => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentOption,
                  paymentMethod === method && styles.paymentOptionActive,
                ]}
                onPress={() => setPaymentMethod(method)}
                activeOpacity={0.8}>
                <Icon
                  name={
                    method === 'Razorpay'
                      ? 'card-outline'
                      : method === 'Cash on Delivery'
                      ? 'cash-outline'
                      : 'qr-code-outline'
                  }
                  size={20}
                  color={
                    paymentMethod === method
                      ? theme.colors.accent
                      : theme.colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.paymentLabel,
                    paymentMethod === method && styles.paymentLabelActive,
                  ]}>
                  {method}
                </Text>
                {paymentMethod === method && (
                  <Icon
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.accent}
                    style={{marginLeft: 'auto'}}
                  />
                )}
              </TouchableOpacity>
            ),
          )}
        </View>

        {/* Price breakdown */}
        <View style={styles.section}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Items</Text>
            <Text style={styles.priceVal}>₹{itemsTotal.toFixed(0)}</Text>
          </View>
          {deliveryCharge > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Delivery</Text>
              <Text style={styles.priceVal}>₹{deliveryCharge}</Text>
            </View>
          )}
          {useWallet && walletDeduction > 0 && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Wallet Discount</Text>
              <Text style={[styles.priceVal, {color: theme.colors.success}]}>
                -₹{walletDeduction.toFixed(0)}
              </Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total to Pay</Text>
            <Text style={styles.totalVal}>₹{amountDue.toFixed(0)}</Text>
          </View>
        </View>

        {/* Privacy notice */}
        <View style={styles.privacyNote}>
          <Icon name="shield-checkmark" size={14} color={theme.colors.success} />
          <Text style={styles.privacyText}>
            Your phone number and address are{' '}
            <Text style={{fontWeight: '700'}}>never</Text> shared with the
            pharmacy. Only your medicines and prescription are shared.
          </Text>
        </View>
      </ScrollView>

      {/* Place Order Footer */}
      <View style={[styles.footer, {paddingBottom: insets.bottom + 12}]}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Amount Due</Text>
          <Text style={styles.footerTotalVal}>₹{amountDue.toFixed(0)}</Text>
        </View>
        <Button
          title={placing ? 'Placing…' : 'Place Order'}
          onPress={placeOrder}
          loading={placing}
          disabled={placing || !isPrescriptionReady || !isConsentReady}
          type="primary"
          style={{flex: 1}}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {padding: 4},
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  section: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  gpsBtnText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  summaryName: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  summaryBrand: {color: theme.colors.muted, fontWeight: '400'},
  summaryQty: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    minWidth: 60,
    textAlign: 'right',
  },
  summaryAmt: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    minWidth: 50,
    textAlign: 'right',
  },
  divider: {height: 1, backgroundColor: theme.colors.border, marginVertical: 8},
  freeDelivery: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: '600',
    marginTop: 4,
  },
  hint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accentLight,
  },
  uploadText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  prescriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.success,
    borderRadius: theme.radius.md,
    padding: 10,
    backgroundColor: '#ECFDF5',
  },
  prescriptionThumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
  },
  prescriptionMeta: {flex: 1},
  prescriptionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.success,
  },
  changeLink: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    marginTop: 2,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 14,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  consentText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  field: {marginBottom: 12},
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  walletTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  walletBalance: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {backgroundColor: theme.colors.accent},
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {alignSelf: 'flex-end'},
  walletDeduction: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: '600',
    marginTop: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  paymentOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentLight,
  },
  paymentLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  paymentLabelActive: {color: theme.colors.accent},
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary},
  priceVal: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  totalVal: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  privacyNote: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 12,
  },
  privacyText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: '#166534',
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerTotal: {},
  footerTotalLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  footerTotalVal: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
});
