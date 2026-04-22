import React, {useState, useRef} from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  Alert,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Category} from '@shared/types';
import {LocationSearch} from '../../components/common/LocationSearch';
import {locationService, LocationResult} from '../../services/locationService';
import {useSocket} from '../../hooks/useSocket';
import {useAuth} from '../../hooks/useAuth';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import Animated, {
  FadeInRight,
  FadeInLeft,
  Layout,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {DashboardStackParamList} from '../../navigation/types';
import Geolocation from 'react-native-geolocation-service';

const {width} = Dimensions.get('window');

type ShopSetupNavigationProp = StackNavigationProp<
  DashboardStackParamList,
  'ShopSetup'
>;

interface ShopSetupProps {
  navigation: ShopSetupNavigationProp;
}

export default function ShopSetupScreen({navigation}: ShopSetupProps) {
  const {showToast} = useToast();
  const [step, setStep] = useState(1);
  const {refreshUser} = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [myShopId, setMyShopId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Step 1: Business Details
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [aadharCard, setAadharCard] = useState('');
  const [gstin, setGstin] = useState('');

  // Step 2: Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [formattedAddress, setFormattedAddress] = useState('');

  // Step 3: Bank Details
  const [bankHolder, setBankHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');

  // Step 4: Final Info
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.OTHER);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);

  React.useEffect(() => {
    fetchExistingShop();
  }, []);

  const fetchExistingShop = async () => {
    setInitialLoading(true);
    try {
      const res = await axiosInstance.get('/api/shops/my');
      if (res.data.success) {
        const shop = res.data.data;
        setMyShopId(shop._id);
        setIsVerified(shop.isVerified);
        setRejectionReason(shop.rejectionReason || null);
        setName(shop.name);
        setBusinessName(shop.businessName);
        setAadharCard(shop.aadharCard);
        setGstin(shop.gstin || '');
        setDescription(shop.description);
        
        if (shop.detailedAddress) {
          setStreet(shop.detailedAddress.street || '');
          setCity(shop.detailedAddress.city || '');
          setState(shop.detailedAddress.state || 'Karnataka');
          setPincode(shop.detailedAddress.pincode || '');
        }
        
        if (shop.location) {
          setCoordinates({
            lat: shop.location.coordinates[1],
            lng: shop.location.coordinates[0],
          });
        }
        
        setFormattedAddress(shop.address);
        
        if (shop.bankDetails) {
          setBankHolder(shop.bankDetails.holderName || '');
          setBankName(shop.bankDetails.bankName || '');
          setAccountNumber(shop.bankDetails.accountNumber || '');
          setIfscCode(shop.bankDetails.ifscCode || '');
        }
        
        if (shop.contactInfo) {
          setEmail(shop.contactInfo.businessEmail || '');
          setPhone(shop.contactInfo.businessPhone || '');
        }
        
        setIsTermsAccepted(true);
        if (shop.category) {
          setSelectedCategory(shop.category);
        }
      }
    } catch (err) {
      // No shop yet
    } finally {
      setInitialLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!name || !businessName || !aadharCard) {
        showToast({message: 'Please fill all mandatory business details', type: 'info'});
        return;
      }
      if (aadharCard.length !== 12) {
        showToast({message: 'Aadhar number must be 12 digits', type: 'error'});
        return;
      }
    } else if (step === 2) {
      if (!street || !city || !pincode || !coordinates) {
        showToast({message: 'Please provide a complete address and pin your location', type: 'info'});
        return;
      }
    } else if (step === 3) {
      if (!bankHolder || !bankName || !accountNumber || !ifscCode) {
        showToast({message: 'Bank details are required for payouts', type: 'info'});
        return;
      }
    }
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

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
        console.warn('Location permission error:', err);
        return false;
      }
    }
    return true;
  };

  const useCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      showToast({message: 'Location permission is required to auto-fill', type: 'error'});
      return;
    }

    setLocationLoading(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        setCoordinates({lat: latitude, lng: longitude});
        const result = await locationService.reverseGeocode(
          latitude,
          longitude,
        );
        if (result) {
          setStreet(result.street || '');
          setCity(result.city || '');
          setPincode(result.postcode || '');
          setFormattedAddress(result.formatted);
        }
        setLocationLoading(false);
      },
      error => {
        showToast({message: 'Could not get your current location', type: 'error'});
        setLocationLoading(false);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const handleLocationSelect = (loc: LocationResult) => {
    setFormattedAddress(loc.formatted);
    setCoordinates({lat: loc.lat, lng: loc.lon});
    setStreet(loc.street || '');
    setCity(loc.city || '');
    setPincode(loc.postcode || '');
  };

  const handleSubmit = async () => {
    if (!isTermsAccepted) {
      showToast({message: 'Please accept the Terms & Conditions to proceed', type: 'info'});
      return;
    }

    setLoading(true);
    setLoading(true);
    try {
      // Step 4 Validation
      if (!description || description.length < 10) {
        showToast({message: 'Please provide a shop description of at least 10 characters', type: 'info'});
        setLoading(false);
        return;
      }
      if (!email || !email.includes('@')) {
        showToast({message: 'Please provide a valid business email', type: 'info'});
        setLoading(false);
        return;
      }
      if (!phone || phone.length < 10) {
        showToast({message: 'Please provide a valid 10-digit business phone', type: 'info'});
        setLoading(false);
        return;
      }

      // Use clean JSON for 100% reliability in React Native
      const payload = {
        name,
        businessName,
        description: description || '',
        aadharCard,
        gstin: gstin || '',
        address: formattedAddress,
        detailedAddress: {
          street: street || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
        },
        // IMPORTANT: Backend expects lat/lng at top level, not nested in location
        lat: coordinates?.lat || 0,
        lng: coordinates?.lng || 0,
        bankDetails: {
          holderName: bankHolder || '',
          bankName: bankName || '',
          accountNumber: accountNumber || '',
          ifscCode: ifscCode || '',
        },
        contactInfo: {
          businessEmail: email || '',
          businessPhone: phone || '',
        },
        category: selectedCategory || Category.OTHER,
        isTermsAccepted: true,
        logo: '', // No logo picker implemented yet
      };

      // Correctly prioritize PUT vs POST
      const res = myShopId 
        ? await axiosInstance.put(`/api/shops/${myShopId}`, payload)
        : await axiosInstance.post('/api/shops', payload);

      if (res.data.success) {
        await refreshUser();
        showToast({
          message: myShopId 
            ? 'Shop application updated and sent for re-verification'
            : 'Your shop application has been submitted!', 
          type: 'success'
        });
        navigation.goBack();
      }
    } catch (error: any) {
      setLoading(false);
      const serverMessage = error.response?.data?.message;
      showToast({message: serverMessage || 'Failed to submit shop setup', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.stepIndicatorWrapper}>
          <View
            style={[
              styles.stepDot,
              i <= step && styles.stepDotActive,
              i < step && styles.stepDotCompleted,
            ]}>
            {i < step ? (
              <Icon name="checkmark" size={14} color={theme.colors.white} />
            ) : (
              <Text
                style={[styles.stepNum, i === step && styles.stepNumActive]}>
                {i}
              </Text>
            )}
          </View>
          {i < 4 && (
            <View
              style={[styles.stepLine, i < step && styles.stepLineActive]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Animated.View
            entering={FadeInRight}
            exiting={FadeInLeft}
            style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Step 1: Business Details</Text>
            <Text style={styles.stepSubtitle}>
              Tell us about your brand and identity
            </Text>
            <Input
              label="Display Shop Name"
              placeholder="e.g. Ram Mobile Store"
              value={name}
              onChangeText={setName}
            />
            <Input
              label="Official Business Name"
              placeholder="As per Aadhar/GST"
              value={businessName}
              onChangeText={setBusinessName}
            />
            <Input
              label="Aadhar Card Number"
              placeholder="12-digit UID"
              value={aadharCard}
              onChangeText={setAadharCard}
              keyboardType="numeric"
              maxLength={12}
            />
            <Input
              label="GSTIN (Optional)"
              placeholder="15-digit GST Number"
              value={gstin}
              onChangeText={setGstin}
              autoCapitalize="characters"
            />
          </Animated.View>
        );
      case 2:
        return (
          <Animated.View entering={FadeInRight} style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Step 2: Operations Address</Text>
            <Text style={styles.stepSubtitle}>
              Where is your business located?
            </Text>
            <TouchableOpacity
              style={[styles.gpsButton, coordinates && {backgroundColor: theme.colors.success + '10', borderColor: theme.colors.success}]}
              onPress={useCurrentLocation}
              disabled={locationLoading}>
              <Icon 
                name={coordinates ? "checkmark-circle" : "navigate"} 
                size={20} 
                color={coordinates ? theme.colors.success : theme.colors.primary} 
              />
              <Text style={[styles.gpsButtonText, coordinates && {color: theme.colors.success}]}>
                {locationLoading
                  ? 'PINNING LOCATION...'
                  : coordinates ? 'LOCATION PINNED' : 'PIN MY SHOP LOCATION (GPS REQUIRED)'}
              </Text>
            </TouchableOpacity>

            {!coordinates && (
              <View style={styles.gpsWarning}>
                <Icon name="information-circle-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.gpsWarningText}>You must be physically present at your shop to pin the address.</Text>
              </View>
            )}

            <Input
              label="Street / Door No."
              placeholder="e.g. #123, 2nd Floor, Main Rd"
              value={street}
              onChangeText={setStreet}
              disabled={!coordinates}
            />
            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 8}}>
                <Input
                  label="City"
                  placeholder="Bengaluru"
                  value={city}
                  onChangeText={setCity}
                  disabled={!coordinates}
                />
              </View>
              <View style={{flex: 1, marginLeft: 8}}>
                <Input
                  label="Pincode"
                  placeholder="560XXX"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                  disabled={!coordinates}
                />
              </View>
            </View>
            <Input label="State" value={state} disabled />
          </Animated.View>
        );
      case 3:
        return (
          <Animated.View entering={FadeInRight} style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Step 3: Payout Details</Text>
            <Text style={styles.stepSubtitle}>
              Provide bank details for earnings
            </Text>
            <Input
              label="Account Holder Name"
              placeholder="As in Bank Account"
              value={bankHolder}
              onChangeText={setBankHolder}
            />
            <Input
              label="Bank Name"
              placeholder="e.g. HDFC Bank, SBI"
              value={bankName}
              onChangeText={setBankName}
            />
            <Input
              label="Account Number"
              placeholder="Enter your account number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />
            <Input
              label="IFSC Code"
              placeholder="11-character code"
              value={ifscCode}
              onChangeText={setIfscCode}
              autoCapitalize="characters"
              maxLength={11}
            />
          </Animated.View>
        );
      case 4:
        return (
          <Animated.View entering={FadeInRight} style={styles.stepWrapper}>
            <Text style={styles.stepTitle}>Step 4: Contact & Finalize</Text>
            <Text style={styles.stepSubtitle}>
              Nearly there! Complete your business profile
            </Text>
            <Input
              label="Business Email"
              placeholder="contact@yourshop.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Input
              label="Business Phone"
              placeholder="+91 XXXXX XXXXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Input
              label="Shop Description"
              placeholder="What do you specialize in?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.categorySection}>
              <Text style={styles.categoryLabelTitle}>Business Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.categoryScroll}>
                {[
                  {id: Category.ELECTRONICS, icon: 'hardware-chip'},
                  {id: Category.FOOD, icon: 'fast-food'},
                  {id: Category.CLOTHING, icon: 'shirt'},
                  {id: Category.HOME, icon: 'home'},
                  {id: Category.OTHER, icon: 'build'},
                  {id: Category.OTHER, icon: 'sparkles'},
                ].map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                      onPress={() => setSelectedCategory(cat.id)}>
                      <Icon 
                        name={cat.icon} 
                        size={14} 
                        color={isActive ? theme.colors.white : theme.colors.primary} 
                      />
                      <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                        {cat.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setIsTermsAccepted(!isTermsAccepted)}>
              <Icon
                name={isTermsAccepted ? 'checkbox' : 'square-outline'}
                size={24}
                color={
                  isTermsAccepted ? theme.colors.primary : theme.colors.muted
                }
              />
              <Text style={styles.termsText}>
                I agree to Velto's Merchant Terms of Use and Privacy Policy.
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (step > 1 ? prevStep() : navigation.goBack())}
          style={styles.backBtn}
          activeOpacity={0.7}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Merchant Setup</Text>
          <Text style={styles.headerSubtitle}>Verified Seller Workflow</Text>
        </View>
      </View>

      {renderProgressBar()}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        
        {/* Status Indicator Banner */}
        {myShopId && isVerified === false && (
          <Animated.View 
            entering={FadeInRight}
            style={[
              styles.statusBanner, 
              rejectionReason ? styles.statusBannerRejected : styles.statusBannerPending
            ]}>
            <View style={styles.statusBannerHeader}>
              <Icon 
                name={rejectionReason ? "alert-circle" : "time"} 
                size={20} 
                color={rejectionReason ? '#991B1B' : '#854D0E'} 
              />
              <Text style={[
                styles.statusBannerTitle, 
                {color: rejectionReason ? '#991B1B' : '#854D0E'}
              ]}>
                {rejectionReason ? 'Application Rejected' : 'Application Under Review'}
              </Text>
            </View>
            <Text style={[
              styles.statusBannerText,
              {color: rejectionReason ? '#B91C1C' : '#A16207'}
            ]}>
              {rejectionReason 
                ? `Reason: ${rejectionReason}. Please fix the details below and resubmit.`
                : "Your merchant details are currently being reviewed by our admin team. You can update your info if needed."}
            </Text>
          </Animated.View>
        )}

        {renderStep()}

        <View style={styles.navContainer}>
          {step < 4 ? (
            <Button
              title="Save & Continue"
              onPress={nextStep}
              style={styles.nextBtn}
            />
          ) : (
            <Button
              title={myShopId ? "Resubmit for Verification" : "Submit Final Application"}
              onPress={handleSubmit}
              isLoading={loading}
              style={styles.nextBtn}
            />
          )}
          {step > 1 && (
            <TouchableOpacity onPress={prevStep} style={styles.backLink}>
              <Text style={styles.backLinkText}>Go Back to Previous Step</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  scrollContent: {padding: 24, paddingBottom: 40},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitleContainer: {flex: 1},
  headerTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  headerSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
  },
  stepIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  stepDotActive: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepNum: {fontSize: 12, fontWeight: '800', color: theme.colors.muted},
  stepNumActive: {color: theme.colors.primary},
  stepLine: {
    width: 40,
    height: 3,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 8,
  },
  stepLineActive: {backgroundColor: theme.colors.primary},
  stepWrapper: {gap: 20},
  stepTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 8,
    fontWeight: '500',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary + '10',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  gpsButtonText: {fontSize: 14, fontWeight: '800', color: theme.colors.primary},
  orText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.muted,
    textAlign: 'center',
    marginVertical: 4,
    letterSpacing: 1.5,
  },
  row: {flexDirection: 'row'},
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingRight: 20,
  },
  termsText: {
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
    fontWeight: '500',
  },
  navContainer: {marginTop: 40, gap: 16},
  nextBtn: {height: 56, borderRadius: 16},
  backLink: {alignItems: 'center', paddingVertical: 8},
  backLinkText: {fontSize: 14, color: theme.colors.muted, fontWeight: '700'},
  categorySection: {marginTop: 10},
  categoryLabelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  categoryScroll: {gap: 8, paddingRight: 20},
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  categoryChipTextActive: {
    color: theme.colors.white,
  },
  statusBanner: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  statusBannerPending: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FEF08A',
  },
  statusBannerRejected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  statusBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginLeft: 28,
  },
  gpsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    marginBottom: 12,
  },
  gpsWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
});