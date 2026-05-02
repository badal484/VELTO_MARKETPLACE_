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
import {Button} from '../../components/common/Button';
import {axiosInstance} from '../../api/axiosInstance';
import {useAuth} from '../../hooks/useAuth';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {riderRegisterSchema} from '@shared/validation';

export default function RiderSetupScreen({navigation}: any) {
  const {updateUser, user} = useAuth();
  const [loading, setLoading] = useState(false);
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
      Alert.alert('Validation Error', validation.error.errors[0].message);
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
        Alert.alert(
          'Application Submitted',
          'Your rider application is pending verification. You can now access the Rider Dashboard.',
          [{text: 'Great', onPress: () => navigation.navigate('Profile')}]
        );
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
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            value={formData.phoneNumber}
            onChangeText={(t) => setFormData({...formData, phoneNumber: t})}
          />

          <Text style={styles.sectionTitle}>DOCUMENTATION</Text>
          <Text style={styles.label}>Driving License Number</Text>
          <TextInput
            style={styles.input}
            placeholder="DL-XXXXXXXXXXXXX"
            value={formData.licenseNumber}
            onChangeText={(t) => setFormData({...formData, licenseNumber: t})}
          />

          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.row}>
            {['Bike', 'Scooter', 'Cycle'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.chip,
                  formData.vehicleType === type && styles.chipActive
                ]}
                onPress={() => setFormData({...formData, vehicleType: type})}>
                <Text style={[
                  styles.chipText,
                  formData.vehicleType === type && styles.chipTextActive
                ]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Vehicle Model</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Honda Activa, Hero Splendor"
            value={formData.vehicleModel}
            onChangeText={(t) => setFormData({...formData, vehicleModel: t})}
          />

          <Text style={styles.label}>Vehicle Plate Number</Text>
          <TextInput
            style={styles.input}
            placeholder="KA 01 XX 0000"
            value={formData.vehicleNumber}
            autoCapitalize="characters"
            onChangeText={(t) => setFormData({...formData, vehicleNumber: t})}
          />

          <Text style={styles.sectionTitle}>BANKING DETAILS (For Payouts)</Text>
          <Text style={styles.label}>Bank Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. HDFC Bank, SBI"
            value={formData.bankName}
            onChangeText={(t) => setFormData({...formData, bankName: t})}
          />

          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Your bank account number"
            keyboardType="numeric"
            value={formData.accountNumber}
            onChangeText={(t) => setFormData({...formData, accountNumber: t})}
          />

          <Text style={styles.label}>IFSC Code</Text>
          <TextInput
            style={styles.input}
            placeholder="11-digit IFSC code"
            autoCapitalize="characters"
            value={formData.ifscCode}
            onChangeText={(t) => setFormData({...formData, ifscCode: t})}
          />

          <Button
            title="Submit Application"
            loading={loading}
            onPress={handleSubmit}
            style={{marginTop: 40, marginBottom: 20}}
          />
        </Animated.View>
      </ScrollView>
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
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
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