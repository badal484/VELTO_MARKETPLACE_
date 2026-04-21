import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInDown, ZoomIn} from 'react-native-reanimated';
import {IUser, Role} from '@shared/types';

interface AdminUserDetailModalProps {
  visible: boolean;
  onClose: () => void;
  user: ExtendedUser | null;
  onVerifyRider?: (id: string) => void;
  onRejectRider?: (id: string, reason: string) => void;
}

const {height} = Dimensions.get('window');

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  visible,
  onClose,
  user,
  onVerifyRider,
  onRejectRider,
}) => {
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [showRejectInput, setShowRejectInput] = React.useState(false);

  if (!user) return null;

  const renderStat = (label: string, value: string | number, icon: string, color: string) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, {backgroundColor: color + '15'}]}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} onPress={onClose} />
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.content}
        >
          <View style={styles.handle} />
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Animated.View 
                entering={ZoomIn}
                style={[styles.avatar, {backgroundColor: theme.colors.primary + '10'}]}
              >
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </Animated.View>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              {renderStat('Lifetime Spent', `₹${(user.totalSpent || 0).toLocaleString()}`, 'wallet-outline', theme.colors.success)}
              {renderStat('Total Orders', user.orderCount || 0, 'cart-outline', theme.colors.primary)}
            </View>

            {user.shop && (
              <View style={styles.businessSection}>
                <Text style={styles.sectionTitle}>Merchant Profile</Text>
                <View style={styles.businessCard}>
                  <View style={styles.businessHeader}>
                    <Icon name="business" size={24} color={theme.colors.primary} />
                    <View style={styles.businessInfo}>
                      <Text style={styles.businessName}>{user.shop.name}</Text>
                      <Text style={styles.businessCat}>{user.shop.category}</Text>
                    </View>
                  </View>
                  <View style={styles.businessMetrics}>
                    <Text style={styles.metricText}>
                      Member since {new Date(user.createdAt).toLocaleDateString()}
                    </Text>
                    <View style={styles.verifiedTag}>
                       <Icon name="checkmark-circle" size={12} color={theme.colors.success} />
                       <Text style={styles.verifiedText}>STAKEHOLDER</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {(user.role === Role.RIDER || user.riderStatus === 'pending' || user.riderStatus === 'rejected') && (
              <View style={styles.businessSection}>
                <Text style={styles.sectionTitle}>Rider Documentation</Text>
                <View style={styles.businessCard}>
                  <View style={styles.businessHeader}>
                    <Icon name="bicycle" size={24} color="#6366F1" />
                    <View style={styles.businessInfo}>
                      <Text style={styles.businessName}>Vehicle Fleet Partner</Text>
                      <Text style={[styles.businessCat, {color: '#6366F1'}]}>
                        {user.vehicleDetails?.type} - {user.vehicleDetails?.model}
                      </Text>
                    </View>
                  </View>
                <View style={styles.riderMeta}>
                    <View style={styles.riderDetailRow}>
                      <Text style={styles.riderDetailLabel}>License No:</Text>
                      <Text style={styles.riderDetailValue}>{user.licenseNumber || 'Not Provided'}</Text>
                    </View>
                    <View style={styles.riderDetailRow}>
                      <Text style={styles.riderDetailLabel}>Plate No:</Text>
                      <Text style={styles.riderDetailValue}>{user.vehicleDetails?.number || 'N/A'}</Text>
                    </View>
                    <View style={styles.riderDetailRow}>
                      <Text style={styles.riderDetailLabel}>Status:</Text>
                      <Text style={[
                        styles.riderDetailValue, 
                        {color: user.riderStatus === 'verified' ? theme.colors.success : theme.colors.warning}
                      ]}>
                        {(user.riderStatus || 'PENDING').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {user.riderDocuments && user.riderDocuments.length > 0 && (
                  <View style={styles.docGallery}>
                    <Text style={styles.subTitle}>Uploaded Documents</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docScroll}>
                      {user.riderDocuments.map((doc, i) => (
                        <View key={i} style={styles.docPlaceholder}>
                           <Icon name="document-attach" size={24} color={theme.colors.primary} />
                           <Text style={styles.docLabel}>DOC {i+1}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {user.riderStatus === 'pending' && !showRejectInput && (
                  <View style={styles.decisionRow}>
                    <TouchableOpacity 
                      style={[styles.verifyBtn, {flex: 2}]}
                      onPress={() => onVerifyRider?.(user._id)}>
                      <Icon name="checkmark-shield" size={20} color={theme.colors.white} />
                      <Text style={styles.verifyBtnText}>Approve Rider</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.verifyBtn, styles.rejectBtn, {flex: 1}]}
                      onPress={() => setShowRejectInput(true)}>
                      <Icon name="close-circle" size={20} color={theme.colors.white} />
                    </TouchableOpacity>
                  </View>
                )}

                {showRejectInput && (
                  <View style={styles.rejectionContainer}>
                    <Text style={styles.rejectionLabel}>Reason for Rejection</Text>
                    <View style={styles.inputWrapper}>
                       <Icon name="chatbubble-ellipses" size={16} color={theme.colors.muted} />
                       <TextInput 
                         style={styles.textInput}
                         placeholder="e.g. Invalid license number..."
                         placeholderTextColor={theme.colors.muted}
                         value={rejectionReason}
                         onChangeText={setRejectionReason}
                       />
                    </View>
                    <View style={styles.decisionRow}>
                       <TouchableOpacity 
                         style={[styles.verifyBtn, styles.rejectBtn, {flex: 1}]}
                         onPress={() => {
                           if (!rejectionReason) return Alert.alert('Error', 'Please provide a reason');
                           onRejectRider?.(user._id, rejectionReason);
                         }}>
                         <Text style={styles.verifyBtnText}>Confirm Reject</Text>
                       </TouchableOpacity>
                       <TouchableOpacity 
                         style={[styles.verifyBtn, {flex: 1, backgroundColor: theme.colors.muted}]}
                         onPress={() => setShowRejectInput(false)}>
                         <Text style={styles.verifyBtnText}>Cancel</Text>
                       </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn}>
                <Icon name="mail-outline" size={20} color={theme.colors.text} />
                <Text style={styles.actionText}>Email User</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]}>
                <Icon name="ban-outline" size={20} color={theme.colors.danger} />
                <Text style={[styles.actionText, {color: theme.colors.danger}]}>Restrict Access</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close Profile</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: height * 0.75,
    padding: 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  email: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  businessSection: {
    marginBottom: 24,
  },
  businessCard: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 16,
  },
  businessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  businessCat: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  businessMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.success,
  },
  actions: {
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  dangerBtn: {
    backgroundColor: '#FFF1F2',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  riderMeta: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  riderDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riderDetailLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  riderDetailValue: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '800',
  },
  verifyBtn: {
    height: 54,
    backgroundColor: '#6366F1',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    ...theme.shadow.sm,
  },
  rejectBtn: {
    backgroundColor: theme.colors.danger,
  },
  verifyBtnText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  docGallery: {
    marginTop: 20,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  docScroll: {
    flexDirection: 'row',
  },
  docPlaceholder: {
    width: 100,
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  docLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
    marginTop: 8,
  },
  rejectionContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.danger,
    marginBottom: 12,
  },
  inputWrapper: {
    height: 50,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    padding: 0,
  }
});
