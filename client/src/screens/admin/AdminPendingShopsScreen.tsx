import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {IShop, IUser} from '@shared/types';
import {useToast} from '../../hooks/useToast';
import Animated, {FadeInUp} from 'react-native-reanimated';

export default function AdminPendingShopsScreen() {
  const {showToast} = useToast();
  const [activeTab, setActiveTab] = useState<'shops' | 'riders'>('shops');
  const [shops, setShops] = useState<IShop[]>([]);
  const [riders, setRiders] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Rejection Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingType, setRejectingType] = useState<'shop' | 'rider' | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'shops') {
        const res = await axiosInstance.get('/api/admin/shops/pending');
        setShops(res.data.data);
      } else {
        const res = await axiosInstance.get('/api/admin/users');
        const pending = res.data.data.filter((u: any) => u.riderStatus === 'pending');
        setRiders(pending);
      }
    } catch (error: unknown) {
      console.error('Error fetching pending applications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApproveShop = async (id: string) => {
    Alert.alert('Approve Shop', 'Are you sure you want to verify this shop and make it live?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Approve', style: 'default',
        onPress: async () => {
          try {
            await axiosInstance.patch(`/api/admin/shops/${id}/approve`);
            showToast({message: 'Shop approved and verified successfully!', type: 'success'});
            fetchData();
          } catch (error: unknown) {
            showToast({message: 'Failed to approve shop', type: 'error'});
          }
        },
      },
    ]);
  };

  const handleApproveRider = async (id: string) => {
    Alert.alert('Approve Rider', 'Are you sure you want to verify this rider?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Approve', style: 'default',
        onPress: async () => {
          try {
            await axiosInstance.patch(`/api/admin/users/${id}/verify-rider`);
            showToast({message: 'Rider verified successfully!', type: 'success'});
            fetchData();
          } catch (error: unknown) {
            showToast({message: 'Failed to verify rider', type: 'error'});
          }
        },
      },
    ]);
  };

  const handleReject = (id: string, type: 'shop' | 'rider') => {
    setRejectingId(id);
    setRejectingType(type);
    setRejectReason('');
    setIsRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId || !rejectReason.trim()) {
      showToast({message: 'Please provide a reason for rejection', type: 'info'});
      return;
    }

    setIsRejecting(true);
    try {
      if (rejectingType === 'shop') {
        await axiosInstance.patch(`/api/admin/shops/${rejectingId}/reject`, { reason: rejectReason });
        showToast({message: 'Shop application rejected', type: 'info'});
      } else {
        await axiosInstance.patch(`/api/admin/users/${rejectingId}/reject-rider`, { rejectionReason: rejectReason });
        showToast({message: 'Rider application rejected', type: 'info'});
      }
      setIsRejectModalVisible(false);
      fetchData();
    } catch (error: unknown) {
      showToast({message: 'Failed to reject', type: 'error'});
    } finally {
      setIsRejecting(false);
    }
  };

  const PendingShopCard = ({
    item,
    index,
    onApprove,
    onReject,
  }: {
    item: IShop;
    index: number;
    onApprove: (id: string) => void;
    onReject: (id: string, type: 'shop' | 'rider') => void;
  }) => {
    const [showDetails, setShowDetails] = useState(false);


    return (
      <Animated.View entering={FadeInUp.delay(index * 120).duration(600)}>
        <Card style={styles.card} variant="elevated">
          <View style={styles.shopHeader}>
            <View style={styles.logoBox}>
              <Icon name="business" size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.shopName}>{item.name}</Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsBox}>
            <View style={styles.detailItem}>
              <Icon
                name="location-outline"
                size={14}
                color={theme.colors.muted}
              />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.address}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Icon
                name="document-text-outline"
                size={14}
                color={theme.colors.muted}
              />
              <Text style={styles.description} numberOfLines={3}>
                {item.description}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.expandRow}
            onPress={() => setShowDetails(!showDetails)}>
            <Text style={styles.expandText}>
              {showDetails
                ? 'Hide Verification Data'
                : 'View Verification Data'}
            </Text>
            <Icon
              name={showDetails ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          {showDetails && (
            <View style={styles.kycSection}>
              <Text style={styles.kycTitle}>ID & Tax Verification</Text>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Official Name:</Text>
                <Text style={styles.kycValue}>{item.businessName}</Text>
              </View>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Aadhar Card:</Text>
                <Text style={styles.kycValue}>{item.aadharCard}</Text>
              </View>
              {item.gstin && (
                <View style={styles.kycRow}>
                  <Text style={styles.kycLabel}>GSTIN:</Text>
                  <Text style={styles.kycValue}>{item.gstin}</Text>
                </View>
              )}

              <Text style={[styles.kycTitle, {marginTop: 16}]}>
                Bank Details (Payouts)
              </Text>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Holder:</Text>
                <Text style={styles.kycValue}>
                  {item.bankDetails?.holderName || 'N/A'}
                </Text>
              </View>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Bank:</Text>
                <Text style={styles.kycValue}>{item.bankDetails?.bankName || 'N/A'}</Text>
              </View>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Account:</Text>
                <Text style={styles.kycValue}>
                  {item.bankDetails?.accountNumber || 'N/A'}
                </Text>
              </View>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>IFSC:</Text>
                <Text style={styles.kycValue}>{item.bankDetails?.ifscCode || 'N/A'}</Text>
              </View>

              <Text style={[styles.kycTitle, {marginTop: 16}]}>
                Detailed Address
              </Text>
              <Text style={styles.kycValue}>
                {item.detailedAddress?.street}, {item.detailedAddress?.city},{' '}
                {item.detailedAddress?.state} - {item.detailedAddress?.pincode}
              </Text>

              <Text style={[styles.kycTitle, {marginTop: 16}]}>
                Direct Contact
              </Text>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Email:</Text>
                <Text style={styles.kycValue}>
                  {item.contactInfo?.businessEmail || 'N/A'}
                </Text>
              </View>
              <View style={styles.kycRow}>
                <Text style={styles.kycLabel}>Phone:</Text>
                <Text style={styles.kycValue}>
                  {item.contactInfo?.businessPhone || 'N/A'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => onApprove(String(item._id))}>
              <Icon name="checkmark-circle" size={18} color={theme.colors.white} />
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => onReject(String(item._id), 'shop')}>
              <Icon name="close-circle" size={18} color={theme.colors.danger} />
              <Text style={[styles.btnText, {color: theme.colors.danger}]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </Animated.View>
    );
  };

  const PendingRiderCard = ({ item, index }: { item: IUser; index: number }) => {
    return (
      <Animated.View entering={FadeInUp.delay(index * 120).duration(600)}>
        <Card style={styles.card} variant="elevated">
          <View style={styles.shopHeader}>
            <View style={[styles.logoBox, {backgroundColor: '#6366F115'}]}>
              <Icon name="bicycle" size={24} color="#6366F1" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.shopName}>{item.name}</Text>
              <Text style={styles.detailText}>{item.email}</Text>
            </View>
          </View>

          <View style={styles.kycSection}>
            <Text style={styles.kycTitle}>Rider Documents</Text>
            <View style={styles.kycRow}>
              <Text style={styles.kycLabel}>License:</Text>
              <Text style={styles.kycValue}>{item.licenseNumber || 'Not provided'}</Text>
            </View>
            <View style={styles.kycRow}>
              <Text style={styles.kycLabel}>Vehicle:</Text>
              <Text style={styles.kycValue}>
                {item.vehicleDetails?.model} ({item.vehicleDetails?.number})
              </Text>
            </View>
            <View style={styles.kycRow}>
              <Text style={styles.kycLabel}>Type:</Text>
              <Text style={styles.kycValue}>{item.vehicleDetails?.type}</Text>
            </View>
            <Text style={[styles.kycLabel, {marginTop: 6}]}>{item.riderDocuments?.length || 0} File(s) Uploaded</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApproveRider(String(item._id))}>
              <Icon name="checkmark-circle" size={18} color={theme.colors.white} />
              <Text style={styles.btnText}>View / Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(String(item._id), 'rider')}>
              <Icon name="close-circle" size={18} color={theme.colors.danger} />
              <Text style={[styles.btnText, {color: theme.colors.danger}]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Pending Approvals</Text>
          <Text style={styles.subtitle}>{shops.length + riders.length} total applications</Text>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity onPress={() => setActiveTab('shops')} style={[styles.tabBtn, activeTab === 'shops' && styles.activeTabBtn]}>
              <Text style={[styles.tabText, activeTab === 'shops' && styles.activeTabText]}>Shops ({shops.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('riders')} style={[styles.tabBtn, activeTab === 'riders' && styles.activeTabBtn]}>
              <Text style={[styles.tabText, activeTab === 'riders' && styles.activeTabText]}>Riders ({riders.length})</Text>
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={activeTab === 'shops' ? (shops as any[]) : (riders as any[])}
          keyExtractor={item => String(item._id)}
          renderItem={({item, index}) => 
            activeTab === 'shops' ? (
              <PendingShopCard item={item} index={index} onApprove={handleApproveShop} onReject={handleReject} />
            ) : (
              <PendingRiderCard item={item} index={index} />
            )
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <Icon
                  name="checkmark-done"
                  size={48}
                  color={theme.colors.success}
                />
              </View>
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>
                No pending {activeTab} applications to review at this time.
              </Text>
            </View>
          }
        />
      </View>

      <Modal
        visible={isRejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rejection Reason</Text>
            <Text style={styles.modalSub}>
              Please tell the merchant why their application was refused.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. Bank details are unreadable"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsRejectModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={confirmReject}
                disabled={isRejecting}>
                <Text style={styles.confirmBtnText}>
                  {isRejecting ? 'Rejecting...' : 'Reject Application'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  headerTitleContainer: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '800',
  },
  list: {padding: 16, paddingBottom: 40},
  card: {marginBottom: 16, padding: 20, borderRadius: 20},
  shopHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerInfo: {flex: 1},
  shopName: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  categoryBadge: {
    backgroundColor: theme.colors.primary + '10',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  categoryText: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  detailItem: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  detailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
    flex: 1,
  },
  actions: {flexDirection: 'row', gap: 12, marginTop: 24},
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  approveBtn: {backgroundColor: theme.colors.success},
  rejectBtn: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  btnText: {color: theme.colors.white, fontWeight: '800', fontSize: 14},
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: theme.colors.primary + '08',
    borderRadius: 12,
    gap: 8,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  kycSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kycTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  kycRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  kycLabel: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  kycValue: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  emptyText: {
    color: theme.colors.muted,
    marginTop: 10,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    ...theme.shadow.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 20,
    lineHeight: 20,
  },
  reasonInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    height: 120,
    fontSize: 15,
    color: theme.colors.text,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F1F5F9',
  },
  confirmBtn: {
    backgroundColor: theme.colors.danger,
  },
  cancelBtnText: {
    color: theme.colors.text,
    fontWeight: '800',
  },
  confirmBtnText: {
    color: theme.colors.white,
    fontWeight: '800',
  },
});