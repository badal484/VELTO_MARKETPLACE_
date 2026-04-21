import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';
import {StackNavigationProp} from '@react-navigation/stack';
import {ProfileStackParamList} from '../../navigation/types';
import {IAddress} from '@shared/types';

type PersonalDetailsScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'PersonalDetails'>;

interface PersonalDetailsProps {
  navigation: PersonalDetailsScreenNavigationProp;
}

export default function PersonalDetailsScreen({navigation}: PersonalDetailsProps) {
  const {user, token, updateUser} = useAuth();
  const {showToast} = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [addresses, setAddresses] = useState<IAddress[]>(user?.addresses || []);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      showToast({message: 'Name cannot be empty', type: 'info'});
      return;
    }
    
    try {
      setSaving(true);
      await axiosInstance.patch('/api/user/profile', { name, phoneNumber: phone });
      updateUser({ name, phoneNumber: phone });
      showToast({message: 'Profile updated successfully', type: 'success'});
    } catch (error: any) {
      showToast({message: error.response?.data?.message || 'Failed to update profile', type: 'error'});
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to remove this address?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await axiosInstance.delete(`/api/user/addresses/${addressId}`);
              if (res.data.success) {
                setAddresses(res.data.data);
                updateUser({addresses: res.data.data});
                showToast({message: 'Address removed', type: 'success'});
              }
            } catch (error) {
              showToast({message: 'Failed to delete address', type: 'error'});
            }
          }
        }
      ]
    );
  };

  const renderAddressCard = (item: IAddress, index: number) => (
    <Animated.View key={item._id || index} entering={FadeInDown.delay(index * 100)}>
      <Card style={styles.addressCard} variant="elevated">
        <View style={styles.addressHeader}>
          <View style={styles.labelRow}>
            <Icon 
              name={item.label === 'Home' ? 'home' : item.label === 'Work' ? 'briefcase' : 'location'} 
              size={16} 
              color={theme.colors.primary} 
            />
            <Text style={styles.addressLabel}>{item.label}</Text>
            {item.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultText}>DEFAULT</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => handleDeleteAddress(item._id!)}>
            <Icon name="trash-outline" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
        <Text style={styles.addressText}>{item.street}</Text>
        <Text style={styles.addressSubText}>{item.city}, {item.state} - {item.pincode}</Text>
      </Card>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Personal Details</Text>
        <View style={{width: 44}} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity & Contact</Text>
          <Card style={styles.formCard}>
            <Input
              label="Full Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              leftIcon={<Icon name="person-outline" size={20} color={theme.colors.muted} />}
            />
            <View style={{height: 12}} />
            <Input
              label="Phone Number"
              placeholder="10-digit mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              leftIcon={<Icon name="call-outline" size={20} color={theme.colors.muted} />}
            />
            <Button
              title="Save Changes"
              type="primary"
              isLoading={saving}
              onPress={handleUpdateProfile}
              style={{marginTop: 20}}
            />
          </Card>
        </View>

        {/* Saved Addresses Section */}
        <View style={[styles.section, {marginTop: 10}]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Address Book</Text>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => navigation.navigate('AddEditAddress', {})}>
              <Icon name="add-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.addBtnText}>Add New</Text>
            </TouchableOpacity>
          </View>
          
          {addresses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="map-outline" size={48} color={theme.colors.border} />
              <Text style={styles.emptyText}>No addresses saved yet.</Text>
            </View>
          ) : (
            addresses.map((addr, index) => renderAddressCard(addr, index))
          )}
        </View>

        <View style={{height: 40}} />
      </ScrollView>
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
  sectionHeader: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 11, 
    fontWeight: '900', 
    color: theme.colors.muted, 
    textTransform: 'uppercase', 
    letterSpacing: 1.5
  },
  formCard: {
    padding: 24, 
    borderRadius: 24, 
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  addBtn: {flexDirection: 'row', alignItems: 'center', gap: 6},
  addBtnText: {fontSize: 14, fontWeight: '800', color: theme.colors.primary},
  addressCard: {
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 16, 
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  addressHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  labelRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  addressLabel: {fontSize: 15, fontWeight: '800', color: theme.colors.text},
  defaultBadge: {
    backgroundColor: theme.colors.primary + '08', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 8
  },
  defaultText: {fontSize: 10, fontWeight: '900', color: theme.colors.primary, letterSpacing: 0.5},
  addressText: {fontSize: 15, fontWeight: '600', color: theme.colors.text, lineHeight: 24},
  addressSubText: {fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, fontWeight: '500'},
  emptyContainer: {
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 60,
    backgroundColor: theme.colors.white,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F1F5F9'
  },
  emptyText: {marginTop: 16, fontSize: 13, color: theme.colors.muted, fontWeight: '700'}
});

