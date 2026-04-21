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
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import {useAuth} from '../../hooks/useAuth';
import {StackNavigationProp} from '@react-navigation/stack';
import {ProfileStackParamList} from '../../navigation/types';

type AddEditAddressScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'AddEditAddress'>;

interface AddEditAddressProps {
  navigation: AddEditAddressScreenNavigationProp;
}

const LABELS = ['Home', 'Work', 'Other'];

export default function AddEditAddressScreen({navigation}: AddEditAddressProps) {
  const {showToast} = useToast();
  const {refreshUser} = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [label, setLabel] = useState('Home');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Karnataka');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = async () => {
    if (!street || !city || !pincode) {
      showToast({message: 'Please fill in all required fields.', type: 'info'});
      return;
    }

    try {
      setLoading(true);
      await axiosInstance.post('/api/user/addresses', {
        label,
        street,
        city,
        state,
        pincode,
        landmark,
        isDefault
      });
      
      await refreshUser();
      showToast({message: 'Address saved successfully!', type: 'success'});
      navigation.goBack();
    } catch (error: any) {
      showToast({message: error.response?.data?.message || 'Failed to save address', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1}}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Address</Text>
          <View style={{width: 44}} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.sectionLabel}>Address Label</Text>
          <View style={styles.labelRow}>
            {LABELS.map((item) => (
              <TouchableOpacity 
                key={item}
                style={[styles.labelChip, label === item && styles.activeChip]}
                onPress={() => setLabel(item)}>
                <Icon 
                  name={item === 'Home' ? 'home' : item === 'Work' ? 'briefcase' : 'location'} 
                  size={16} 
                  color={label === item ? theme.colors.white : theme.colors.muted} 
                />
                <Text style={[styles.chipText, label === item && styles.activeChipText]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Location Details</Text>
          <View style={styles.form}>
            <Input
              label="House No / Flat Name / Street *"
              placeholder="e.g. #42, 5th Cross, Indiranagar"
              value={street}
              onChangeText={setStreet}
            />
            <View style={{height: 16}} />
            <Input
              label="Landmark (Optional)"
              placeholder="e.g. Near Metro Station"
              value={landmark}
              onChangeText={setLandmark}
            />
            <View style={styles.row}>
              <View style={{flex: 1.5}}>
                <Input
                  label="City *"
                  placeholder="e.g. Bangalore"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{width: 12}} />
              <View style={{flex: 1}}>
                <Input
                  label="Pincode *"
                  placeholder="560038"
                  value={pincode}
                  onChangeText={setPincode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>
            <View style={{height: 16}} />
            <Input
              label="State *"
              value={state}
              onChangeText={setState}
            />
          </View>

          <TouchableOpacity 
            style={styles.defaultToggle}
            onPress={() => setIsDefault(!isDefault)}
            activeOpacity={0.8}>
            <View style={[styles.checkbox, isDefault && styles.checked]}>
              {isDefault && <Icon name="checkmark" size={14} color="white" />}
            </View>
            <Text style={styles.defaultText}>Set as primary delivery address</Text>
          </TouchableOpacity>

        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Confirm & Save Address"
            type="primary"
            isLoading={loading}
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.white},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  scrollContent: {padding: 24, paddingBottom: 100},
  sectionLabel: {
    fontSize: 11, 
    fontWeight: '900', 
    color: theme.colors.muted, 
    textTransform: 'uppercase', 
    letterSpacing: 2,
    marginBottom: 16,
    marginTop: 24
  },
  labelRow: {flexDirection: 'row', gap: 12, marginBottom: 12},
  labelChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  activeChip: {
    backgroundColor: theme.colors.primary, 
    borderColor: theme.colors.primary,
    ...theme.shadow.md,
  },
  chipText: {fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary},
  activeChipText: {color: theme.colors.white},
  form: {gap: 16},
  row: {flexDirection: 'row', gap: 12},
  defaultToggle: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 14, 
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  checkbox: {
    width: 24, 
    height: 24, 
    borderRadius: 8, 
    borderWidth: 2, 
    borderColor: '#E2E8F0', 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  checked: {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary},
  defaultText: {fontSize: 14, fontWeight: '700', color: theme.colors.text},
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    ...theme.shadow.lg,
  },
  saveBtn: {borderRadius: 18},
});