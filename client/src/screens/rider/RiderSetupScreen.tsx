import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import {Input} from '../../components/common/Input';
import {SuccessModal} from '../../components/common/SuccessModal';
import {Button} from '../../components/common/Button';
import {axiosInstance} from '../../api/axiosInstance';
import {useAuth} from '../../hooks/useAuth';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown} from '../../mocks/reanimated';
import {riderRegisterSchema} from '@shared/validation';

export default function RiderSetupScreen({navigation}: any) {
  const {updateUser, user} = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    licenseNumber: '',
    phoneNumber: user?.phoneNumber || '',
    vehicleType: 'Bike', // Bike, Scooter, Cycle
    vehicleModel: '',
    vehicleNumber: '',
    bankName: '',
    holderName: '',
    accountNumber: '',
    ifscCode: '',
  });

  const handleSubmit = async () => {
    setErrors({});
    // Zod Validation
    const validation = riderRegisterSchema.safeParse({
      licenseNumber: formData.licenseNumber,
      phoneNumber: formData.phoneNumber,
      vehicleDetails: {
        type: formData.vehicleType,
        model: formData.vehicleModel,
        number: formData.vehicleNumber,
      },
      bankDetails: {
        bankName: formData.bankName,
        holderName: formData.holderName || user?.name || '',
        accountNumber: formData.accountNumber,
        ifscCode: formData.ifscCode,
      }
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach(issue => {
        // Handle nested paths (e.g., vehicleDetails.model -> vehicleModel)
        const path = issue.path.join('.');
        let fieldName = path;
        
        // Map common nested paths to our form state keys
        if (path === 'vehicleDetails.type') fieldName = 'vehicleType';
        if (path === 'vehicleDetails.model') fieldName = 'vehicleModel';
        if (path === 'vehicleDetails.number') fieldName = 'vehicleNumber';
        if (path === 'bankDetails.bankName') fieldName = 'bankName';
        if (path === 'bankDetails.accountNumber') fieldName = 'accountNumber';
        if (path === 'bankDetails.ifscCode') fieldName = 'ifscCode';

        fieldErrors[fieldName] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setLoading(true);
      const res = await axiosInstance.post('/api/user/register-rider', {
        licenseNumber: formData.licenseNumber,
        phoneNumber: formData.phoneNumber,
        vehicleDetails: {
          type: formData.vehicleType,
          model: formData.vehicleModel,
          number: formData.vehicleNumber,
        },
        bankDetails: {
          bankName: formData.bankName,
          holderName: formData.holderName || user?.name || '',
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
        }
      });

      if (res.data.success) {
        updateUser(res.data.data);
        setShowSuccess(true);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to submit application';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rider Application</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.infoBox}>
            <Icon name="information-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              Complete your profile with valid details to join the Velto delivery fleet.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>CONTACT INFO</Text>
          <Input
            label="Phone Number"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={formData.phoneNumber}
            onChangeText={(t) => {
              setFormData({...formData, phoneNumber: t});
              if (errors.phoneNumber) setErrors({...errors, phoneNumber: ''});
            }}
            error={errors.phoneNumber}
          />

          <Text style={styles.sectionTitle}>DOCUMENTATION</Text>
          <Input
            label="Driving License Number"
            placeholder="DL-XXXXXXXXXXXXX"
            value={formData.licenseNumber}
            onChangeText={(t) => {
              setFormData({...formData, licenseNumber: t});
              if (errors.licenseNumber) setErrors({...errors, licenseNumber: ''});
            }}
            error={errors.licenseNumber}
          />

          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.row}>
            {['Bike', 'Scooter'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chip,
                  formData.vehicleType === type && styles.chipActive
                ]}
                onPress={() => {
                  setFormData({...formData, vehicleType: type});
                  if (errors.vehicleType) setErrors({...errors, vehicleType: ''});
                }}>
                <Text style={[
                  styles.chipText,
                  formData.vehicleType === type && styles.chipTextActive
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.vehicleType && <Text style={styles.errorText}>{errors.vehicleType}</Text>}

          <Input
            label="Vehicle Model"
            placeholder="e.g. Honda Activa, Hero Splendor"
            value={formData.vehicleModel}
            onChangeText={(t) => {
              setFormData({...formData, vehicleModel: t});
              if (errors.vehicleModel) setErrors({...errors, vehicleModel: ''});
            }}
            containerStyle={{marginTop: 16}}
            error={errors.vehicleModel}
          />

          <Input
            label="Vehicle Plate Number"
            placeholder="KA 01 XX 0000"
            value={formData.vehicleNumber}
            autoCapitalize="characters"
            onChangeText={(t) => {
              setFormData({...formData, vehicleNumber: t});
              if (errors.vehicleNumber) setErrors({...errors, vehicleNumber: ''});
            }}
            error={errors.vehicleNumber}
          />

          <Text style={styles.sectionTitle}>BANKING DETAILS (For Payouts)</Text>
          <Input
            label="Bank Name"
            placeholder="e.g. HDFC Bank, SBI"
            value={formData.bankName}
            onChangeText={(t) => {
              setFormData({...formData, bankName: t});
              if (errors.bankName) setErrors({...errors, bankName: ''});
            }}
            error={errors.bankName}
          />

          <Input
            label="Account Number"
            placeholder="Your bank account number"
            keyboardType="numeric"
            value={formData.accountNumber}
            onChangeText={(t) => {
              setFormData({...formData, accountNumber: t});
              if (errors.accountNumber) setErrors({...errors, accountNumber: ''});
            }}
            error={errors.accountNumber}
          />

          <Input
            label="IFSC Code"
            placeholder="11-digit IFSC code"
            autoCapitalize="characters"
            value={formData.ifscCode}
            onChangeText={(t) => {
              setFormData({...formData, ifscCode: t});
              if (errors.ifscCode) setErrors({...errors, ifscCode: ''});
            }}
            error={errors.ifscCode}
          />

          <Button
            title="Submit Application"
            loading={loading}
            onPress={handleSubmit}
            style={{marginTop: 40, marginBottom: 20}}
          />
        </Animated.View>
      </ScrollView>
      <SuccessModal
        isVisible={showSuccess}
        title="Application Submitted!"
        message="Your rider application is pending verification. We will notify you once you're cleared to start delivering."
        buttonText="Go to Profile"
        onButtonPress={() => {
          setShowSuccess(false);
          navigation.navigate('Profile');
        }}
        onClose={() => setShowSuccess(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.white},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {fontSize: 20, fontWeight: '800', color: theme.colors.text},
  scroll: {padding: 24},
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18},
  label: {fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 10, marginTop: 16},
  errorText: {fontSize: 12, color: theme.colors.danger, marginTop: 4, marginLeft: 2},
  row: {flexDirection: 'row', gap: 12},
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary},
  chipTextActive: {color: theme.colors.white},
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.muted,
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 1,
  },
});