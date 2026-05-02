import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import {useAuth} from '../../hooks/useAuth';
import {useNotifications} from '../../context/NotificationContext';
import {Button} from '../../components/common/Button';
import {Loader} from '../../components/common/Loader';
import {theme} from '../../theme';
import {Role} from '@shared/types';
import {launchImageLibrary} from 'react-native-image-picker';
import {Image} from 'react-native';
import {axiosInstance} from '../../api/axiosInstance';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInUp, FadeInRight} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {CompositeNavigationProp} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ProfileStackParamList,
  MainTabParamList,
} from '../../navigation/types';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'Profile'>,
  BottomTabNavigationProp<MainTabParamList>
>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

export default function ProfileScreen({navigation}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const {user, logout, updateUser} = useAuth();
  const {unreadCount: unreadNotifications, unreadChatCount: unreadChats, fetchUnreadCount, fetchUnreadChatCount} = useNotifications();
  const [uploading, setUploading] = useState(false);
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
      fetchUnreadChatCount();
    });
    return unsubscribe;
  }, [navigation, fetchUnreadCount, fetchUnreadChatCount]);

  const handleSelectImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel || !result.assets) return;

    const selectedImage = result.assets[0];
    handleAvatarUpload(selectedImage);
  };

  const handleAvatarUpload = async (image: any) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('avatar', {
        uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
        type: image.type,
        name: image.fileName || `avatar_${Date.now()}.jpg`,
      } as any);

      const res = await axiosInstance.patch('/api/user/avatar', formData);

      if (res.data.success) {
        updateUser({avatar: res.data.data.avatar});
        // Alert.alert('Success', 'Profile photo updated!');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpgradeNavigation = () => {
    (navigation.navigate as any)('ShopSetup');
  };
  
  const handleContactUs = () => {
    setIsContactModalVisible(true);
  };

  const handleSupportChat = async () => {
    try {
      const res = await axiosInstance.post('/api/chat/support');
      
      if (res.data.success) {
        const conversation = res.data.data;
        // Find the admin participant in the returned conversation
        const admin = (conversation.participants as any[]).find(p => p.role === Role.ADMIN || p.role === 'admin');
        
        // Fallback with a safe placeholder ID if admin is not found for some reason
        const supportUser = admin || { 
          _id: (conversation.participants as any[]).find(p => p._id !== user?._id)?._id || 'support_admin', 
          name: 'Velto Support Team', 
          role: Role.ADMIN 
        };

        (navigation as any).navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser: supportUser,
          shopName: 'Velto Support Hub',
        });
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Unable to connect to support team at the moment.';
      Alert.alert('Support Unavailable', msg);
    }
  };

  const renderMenuItem = (
    icon: string,
    label: string,
    onPress: () => void,
    iconColor = theme.colors.primary, 
    delay = 0,
    badgeCount = 0,
  ) => {
    return (
      <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={onPress}
          activeOpacity={0.7}>
          <View style={styles.menuLeft}>
            <View style={[styles.iconBox, {backgroundColor: iconColor + '08'}]}>
              <Icon name={icon} size={20} color={iconColor} />
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
          </View>
          
          <View style={styles.menuRight}>
            {badgeCount > 0 && (
              <View style={styles.rowBadge}>
                <Text style={styles.rowBadgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
              </View>
            )}
            <Icon name="chevron-forward" size={16} color={theme.colors.muted} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };




  return (
    <View style={[styles.safeArea, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image 
            source={require('../../../assets/velto_logo.png')} 
            style={styles.headerLogo} 
          />
          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        <Animated.View
          entering={FadeInUp.duration(600)}
          style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {user?.avatar ? (
                <Image 
                  key={user.avatar}
                  source={{uri: user.avatar}} 
                  style={styles.avatarImage} 
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase()}
                </Text>
              )}
              {uploading && (
                <View style={styles.uploadOverlay}>
                  <Loader />
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.editAvatarBtn} 
              activeOpacity={0.8}
              onPress={handleSelectImage}
              disabled={uploading}>
              <Icon name="camera" size={14} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.roleBadgeContainer}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      user?.role === Role.ADMIN
                        ? theme.colors.success
                        : theme.colors.primary,
                  },
                ]}
              />
              <Text style={styles.roleText}>
                {user?.role?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Activity Section - ONLY for Buyers */}
        {user?.role === Role.BUYER && (
          <>
            <Text style={styles.sectionLabel}>Activity</Text>
            <View style={styles.menuGroup}>
              {renderMenuItem(
                'receipt-outline',
                'Order History',
                () => navigation.navigate('OrderHistory'),
                theme.colors.text,
                100,
              )}
              
              {renderMenuItem(
                'heart-outline',
                'Wishlist',
                () => (navigation.navigate as any)('Wishlist'),
                theme.colors.text,
                150,
              )}
            </View>
          </>
        )}

        <View style={styles.menuGroup}>
          {renderMenuItem(
            'notifications-outline',
            'Notifications',
            () => (navigation.navigate as any)('Notifications'),
            theme.colors.text,
            200,
          )}

          {renderMenuItem(
            'person-circle-outline',
            'Personal Details',
            () => navigation.navigate('PersonalDetails'),
            theme.colors.text,
            250,
          )}
        </View>



        {/* Specialized Tools for non-admins if any in future */}


        {(user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) && (
          <>
            <Text style={styles.sectionLabel}>Seller Suite</Text>
            <View style={styles.menuGroup}>
              {renderMenuItem(
                'cube-outline',
                'Manage Inventory',
                () => (navigation.navigate as any)('DashboardTab', { screen: 'ManageInventory' }),
                theme.colors.text,
                300,
              )}
              {renderMenuItem(
                'stats-chart-outline',
                'Business Dashboard',
                () => (navigation.navigate as any)('DashboardTab', { screen: 'Dashboard' }),
                theme.colors.text,
                350,
              )}
              {renderMenuItem(
                'receipt-outline',
                'Sales History',
                () => navigation.navigate('OrderHistory'),
                theme.colors.text,
                400,
              )}
            </View>

          </>
        )}

        {user?.role === Role.RIDER && (
          <>
            <Text style={styles.sectionLabel}>Partner Hub</Text>
            <View style={styles.menuGroup}>
              {renderMenuItem(
                'bicycle-outline',
                'Rider Dashboard',
                () => navigation.navigate('RiderTab' as any),
                theme.colors.text,
                300,
              )}
              {renderMenuItem(
                'wallet-outline',
                'Earnings & Wallet',
                () => (navigation.navigate as any)('RiderTab', { screen: 'Wallet' }),
                theme.colors.text,
                350,
              )}
            </View>

          </>
        )}

        {user?.role === Role.BUYER && (
          <>
            <Text style={styles.sectionLabel}>Partner with Velto</Text>
            
            {/* Seller Application Card */}
            {(!user?.isShopVerified || user?.shopRejectionReason) && (
              <View style={styles.upgradeCard}>
                <View style={styles.upgradeHeader}>
                  <View style={[
                    styles.upgradeIconBox,
                    user?.hasShop && { backgroundColor: 'rgba(255,255,255,0.05)' }
                  ]}>
                    <Icon 
                      name={user?.shopRejectionReason ? "alert-circle" : (user?.hasShop ? "time" : "rocket")} 
                      size={24} 
                      color={theme.colors.white} 
                    />
                  </View>
                  <View style={styles.upgradeHeaderText}>
                    <Text style={styles.upgradeTitle}>
                      {user?.shopRejectionReason ? 'Shop Rejected' : (user?.hasShop ? 'Shop Pending' : 'Become a Seller')}
                    </Text>
                    <Text style={styles.upgradeSub}>
                      {user?.shopRejectionReason 
                        ? `Reason: ${user.shopRejectionReason}`
                        : (user?.hasShop 
                          ? 'Our team is reviewing your business details.'
                          : 'Reach thousands of customers in Karnataka.')}
                    </Text>
                  </View>
                </View>
                  <Button
                    title={
                      user?.shopRejectionReason 
                        ? "Fix & Resubmit" 
                        : (user?.hasShop ? "Reviewing Application..." : "Start Application")
                    }
                    size="sm"
                    type={user?.shopRejectionReason ? "primary" : "accent"}
                    disabled={!!(user?.hasShop && !user?.shopRejectionReason)}
                    style={{marginTop: 20}}
                    onPress={handleUpgradeNavigation}
                  />
              </View>
            )}

            {/* Rider Application Card */}
            {(user?.role as string) !== Role.RIDER && (
              <View style={[
                styles.upgradeCard, 
                {marginTop: 16, backgroundColor: user?.riderStatus === 'rejected' ? '#991B1B' : '#4F46E5'}
              ]}>
                <View style={styles.upgradeHeader}>
                  <View style={styles.upgradeIconBox}>
                    <Icon 
                      name={user?.riderStatus === 'pending' ? 'hourglass-outline' : 'bicycle'} 
                      size={24} 
                      color={theme.colors.white} 
                    />
                  </View>
                  <View style={styles.upgradeHeaderText}>
                    <Text style={styles.upgradeTitle}>
                      {user?.riderStatus === 'pending' ? 'Application Pending' : 
                       user?.riderStatus === 'rejected' ? 'Rider Rejected' : 'Earn as a Rider'}
                    </Text>
                    <Text style={styles.upgradeSub}>
                      {user?.riderStatus === 'pending' ? 'We are verifying your driving license and documents.' : 
                       user?.riderStatus === 'rejected' ? `Reason: ${user.riderRejectionReason || 'Invalid documents'}` : 
                       'Join our delivery fleet and earn on every delivery.'}
                    </Text>
                  </View>
                </View>
                  <Button
                    title={
                      user?.riderStatus === 'pending' 
                        ? "Reviewing Documents..." 
                        : (user?.riderStatus === 'rejected' ? "Fix & Try Again" : "Apply as Rider")
                    }
                    size="sm"
                    type="primary"
                    disabled={user?.riderStatus === 'pending'}
                    style={{marginTop: 20, backgroundColor: 'rgba(255,255,255,0.2)'}}
                    onPress={() => (navigation.navigate as any)('RiderSetup')}
                  />
              </View>
            )}
          </>
        )}

        {user?.role !== Role.ADMIN && (
          <>
            <Text style={styles.sectionLabel}>Support</Text>
            <View style={styles.menuGroup}>
              {renderMenuItem(
                'chatbubbles-outline',
                'Support',
                () => navigation.navigate('Support'),
                '#10B981',
                530,
              )}
            </View>
          </>
        )}

        <View
          style={[
            styles.menuGroup,
            {marginTop: 32, marginBottom: 80},
          ]}>
          {renderMenuItem(
            'log-out-outline',
            'Log Out',
            logout,
            theme.colors.danger,
            600,
          )}
        </View>

        <View style={{height: 80}} />
      </ScrollView>

      {/* Custom Contact Choice Sheet (Toast-styled) */}
      <Modal
        visible={isContactModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsContactModalVisible(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsContactModalVisible(false)}>
          <Animated.View entering={FadeInUp} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity onPress={() => setIsContactModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>How would you like to reach out to us?</Text>
            
            <TouchableOpacity 
              style={[styles.contactOption, {backgroundColor: '#ECFDF5', borderColor: '#10B981'}]}
              onPress={() => {
                Linking.openURL('tel:6204646300');
                setIsContactModalVisible(false);
              }}>
              <View style={[styles.contactIconBox, {backgroundColor: '#10B981'}]}>
                <Icon name="call" size={20} color={theme.colors.white} />
              </View>
              <View>
                <Text style={[styles.contactOptionTitle, {color: '#065F46'}]}>Call Support</Text>
                <Text style={[styles.contactOptionSub, {color: '#065F46'}]}>Immediate assistance via phone</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.contactOption, {backgroundColor: '#EFF6FF', borderColor: '#3B82F6'}]}
              onPress={() => {
                Linking.openURL('mailto:support@velto.app?subject=Velto Support Request');
                setIsContactModalVisible(false);
              }}>
              <View style={[styles.contactIconBox, {backgroundColor: '#3B82F6'}]}>
                <Icon name="mail" size={20} color={theme.colors.white} />
              </View>
              <View>
                <Text style={[styles.contactOptionTitle, {color: '#1E40AF'}]}>Email Us</Text>
                <Text style={[styles.contactOptionSub, {color: '#1E40AF'}]}>Get help via our support desk</Text>
              </View>
            </TouchableOpacity>

            <Button 
              title="Cancel" 
              type="secondary" 
              onPress={() => setIsContactModalVisible(false)}
              style={{marginTop: 10}}
            />
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.white,
  },
  headerLogo: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  headerTitle: {fontSize: 28, fontWeight: '900', color: theme.colors.text},
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 24,
    borderRadius: 24,
    ...theme.shadow.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarContainer: {position: 'relative'},
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {fontSize: 34, fontWeight: '900', color: theme.colors.white},
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {marginLeft: 20, flex: 1},
  name: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  email: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dot: {width: 6, height: 6, borderRadius: 3, marginRight: 8},
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    paddingHorizontal: 28,
    marginTop: 28,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  menuGroup: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  menuLeft: {flexDirection: 'row', alignItems: 'center', flex: 1},
  menuRight: {flexDirection: 'row', alignItems: 'center', gap: 12},
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9', // Neutral background for all icons
  },
  menuLabel: {fontSize: 15, fontWeight: '700', color: theme.colors.text, marginLeft: 16},
  rowBadge: {
    backgroundColor: theme.colors.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  rowBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },


  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    ...theme.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 24,
    fontWeight: '500',
  },
  contactOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  contactIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  contactOptionSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  upgradeCard: {
    marginHorizontal: 16,
    padding: 24,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    ...theme.shadow.lg,
  },
  upgradeHeader: {flexDirection: 'row', alignItems: 'center'},
  upgradeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeHeaderText: {marginLeft: 16, flex: 1},
  upgradeTitle: {fontSize: 20, fontWeight: '800', color: theme.colors.white},
  upgradeSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    fontWeight: '500',
  },
  supportHubCard: {
    backgroundColor: theme.colors.primary,
    marginVertical: 16,
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
});