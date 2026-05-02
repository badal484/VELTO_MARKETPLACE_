import React, {useEffect, useState, useCallback, useRef} from 'react';
import {LayoutAnimation, Platform, UIManager} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import {IShop, IUser} from '@shared/types';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';

// ── Reusable detail row ──────────────────────────────────────────────────────
const DetailRow = ({
  icon, label, value, sensitive, muted, highlight,
}: {
  icon: string;
  label: string;
  value: string;
  sensitive?: boolean;
  muted?: boolean;
  highlight?: boolean;
}) => (
  <View style={detailRowStyles.row}>
    <Icon name={icon} size={13} color={highlight ? theme.colors.success : theme.colors.muted} style={detailRowStyles.icon} />
    <Text style={detailRowStyles.label}>{label}</Text>
    <Text
      style={[
        detailRowStyles.value,
        muted && detailRowStyles.valueMuted,
        highlight && detailRowStyles.valueHighlight,
      ]}
      numberOfLines={2}
      selectable={!sensitive}>
      {sensitive ? maskSensitive(value) : value}
    </Text>
  </View>
);

const maskSensitive = (val: string) => {
  if (!val || val.length < 6) return val;
  return val.slice(0, 4) + '•••••' + val.slice(-3);
};

const detailRowStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7},
  icon: {marginTop: 2},
  label: {fontSize: 11, color: theme.colors.muted, fontWeight: '700', width: 100, flexShrink: 0},
  value: {fontSize: 12, color: theme.colors.text, fontWeight: '500', flex: 1},
  valueMuted: {color: theme.colors.muted, fontStyle: 'italic'},
  valueHighlight: {color: theme.colors.success, fontWeight: '700'},
});
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPendingShopsScreen({navigation}: {navigation: any}) {
  const {showToast} = useToast();
  const [pendingShops, setPendingShops] = useState<IShop[]>([]);
  const [pendingRiders, setPendingRiders] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [shopsRes, usersRes] = await Promise.all([
        axiosInstance.get('/api/admin/shops/pending'),
        axiosInstance.get('/api/admin/users'),
      ]);
      setPendingShops(shopsRes.data.data || []);
      const riders = (usersRes.data.data || []).filter(
        (u: IUser) => (u as any).riderStatus === 'pending',
      );
      setPendingRiders(riders);
    } catch (error) {
      showToast({message: 'Failed to load pending applications', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // --- Shop Actions ---
  const handleApproveShop = async (shopId: string) => {
    setProcessingId(shopId);
    try {
      await axiosInstance.patch(`/api/admin/shops/${shopId}/approve`);
      showToast({message: 'Shop approved and is now live!', type: 'success'});
      fetchData();
    } catch (e: any) {
      showToast({message: e.response?.data?.message || 'Failed to approve', type: 'error'});
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectShop = (shopId: string) => {
    Alert.prompt(
      'Reject Shop Application',
      'Enter reason for rejection:',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              showToast({message: 'A reason is required', type: 'info'});
              return;
            }
            setProcessingId(shopId);
            try {
              await axiosInstance.patch(`/api/admin/shops/${shopId}/reject`, {reason});
              showToast({message: 'Shop application rejected', type: 'info'});
              fetchData();
            } catch (e: any) {
              showToast({message: e.response?.data?.message || 'Failed to reject', type: 'error'});
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  // --- Rider Actions ---
  const handleApproveRider = async (riderId: string) => {
    setProcessingId(riderId);
    try {
      await axiosInstance.patch(`/api/admin/users/${riderId}/verify-rider`);
      showToast({message: 'Rider verified and activated!', type: 'success'});
      fetchData();
    } catch (e: any) {
      showToast({message: e.response?.data?.message || 'Failed to verify rider', type: 'error'});
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRider = (riderId: string) => {
    Alert.prompt(
      'Reject Rider Application',
      'Enter reason for rejection:',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              showToast({message: 'A reason is required', type: 'info'});
              return;
            }
            setProcessingId(riderId);
            try {
              await axiosInstance.patch(`/api/admin/users/${riderId}/reject-rider`, {reason});
              showToast({message: 'Rider application rejected', type: 'info'});
              fetchData();
            } catch (e: any) {
              showToast({message: e.response?.data?.message || 'Failed to reject', type: 'error'});
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const handleContact = async (userId: string, name: string) => {
    try {
      const res = await axiosInstance.post('/api/chat', {receiverId: userId});
      navigation.navigate('ChatRoom', {
        conversationId: res.data.data._id,
        otherUser: {_id: userId, name},
        shopName: name,
      });
    } catch (e: any) {
      showToast({message: 'Could not start chat', type: 'error'});
    }
  };

  // --- Render Items ---
  const renderShopItem = ({item, index}: {item: IShop; index: number}) => (
    <ShopCard
      key={String(item._id)}
      item={item}
      index={index}
      processingId={processingId}
      onApprove={handleApproveShop}
      onReject={handleRejectShop}
      onContact={handleContact}
    />
  );

  const renderRiderItem = ({item, index}: {item: IUser; index: number}) => (
    <RiderCard
      key={String(item._id)}
      item={item}
      index={index}
      processingId={processingId}
      onApprove={handleApproveRider}
      onReject={handleRejectRider}
      onContact={handleContact}
    />
  );

  const renderSectionHeader = ({section}: {section: any}) => (
    <View style={styles.sectionHeader}>
      <Icon name={section.icon} size={16} color={section.color} />
      <Text style={[styles.sectionTitle, {color: section.color}]}>{section.title}</Text>
      <View style={[styles.sectionBadge, {backgroundColor: section.color + '20'}]}>
        <Text style={[styles.sectionBadgeText, {color: section.color}]}>{section.data.length}</Text>
      </View>
    </View>
  );

  const renderEmpty = ({section}: {section: any}) =>
    section.data.length === 0 ? (
      <View style={styles.sectionEmpty}>
        <Icon name="checkmark-done-outline" size={28} color={theme.colors.success} />
        <Text style={styles.sectionEmptyText}>No pending {section.emptyLabel}</Text>
      </View>
    ) : null;

  const sections = [
    {
      title: 'Pending Shops',
      icon: 'storefront-outline',
      color: '#D97706',
      emptyLabel: 'shop applications',
      data: pendingShops as any[],
      renderItem: renderShopItem,
    },
    {
      title: 'Pending Riders',
      icon: 'bicycle-outline',
      color: '#4F46E5',
      emptyLabel: 'rider applications',
      data: pendingRiders as any[],
      renderItem: renderRiderItem,
    },
  ];

  if (loading) return <Loader />;

  const totalPending = pendingShops.length + pendingRiders.length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Pending</Text>
          <Text style={styles.subtitle}>
            {totalPending} application{totalPending !== 1 ? 's' : ''} awaiting review
          </Text>
        </View>
        <View style={[styles.countBadge, totalPending > 0 && {backgroundColor: '#FEF3C7'}]}>
          <Text style={[styles.countBadgeText, totalPending > 0 && {color: '#D97706'}]}>
            {totalPending}
          </Text>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => String(item._id || index)}
        renderItem={({item, index, section}) => (section as any).renderItem({item, index})}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {setRefreshing(true); fetchData();}}
            tintColor={theme.colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  header: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 13, color: theme.colors.muted, marginTop: 4, fontWeight: '600'},
  countBadge: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
  },
  countBadgeText: {fontSize: 18, fontWeight: '900', color: theme.colors.muted},
  list: {padding: 16, paddingBottom: 60},
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 12, marginTop: 8,
  },
  sectionTitle: {fontSize: 15, fontWeight: '900', letterSpacing: 0.3},
  sectionBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  sectionBadgeText: {fontSize: 11, fontWeight: '900'},
  sectionEmpty: {
    alignItems: 'center', paddingVertical: 32,
    backgroundColor: theme.colors.white,
    borderRadius: 16, marginBottom: 16,
    borderStyle: 'dashed', borderWidth: 1.5, borderColor: theme.colors.border,
    gap: 8,
  },
  sectionEmptyText: {fontSize: 13, color: theme.colors.muted, fontWeight: '600'},
  card: {marginBottom: 12, padding: 16, borderRadius: 18, backgroundColor: theme.colors.white},
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 14},
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  itemInfo: {flex: 1},
  itemName: {fontSize: 15, fontWeight: '800', color: theme.colors.text},
  itemSub: {fontSize: 11, color: theme.colors.muted, fontWeight: '600', marginTop: 2},
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  pendingBadgeText: {fontSize: 9, fontWeight: '900', color: '#D97706', letterSpacing: 0.5},
  metaGrid: {gap: 7, marginBottom: 16},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  metaText: {fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500', flex: 1},
  actions: {flexDirection: 'row', gap: 10},
  approveBtn: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  rejectBtn: {
    flex: 1, height: 42, borderRadius: 12,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5, borderColor: theme.colors.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  disabledBtn: {opacity: 0.45},
  approveBtnText: {color: '#fff', fontWeight: '800', fontSize: 13},
  rejectBtnText: {color: theme.colors.danger, fontWeight: '800', fontSize: 13},
  // ── New styles for expanded shop card ──
  businessNameText: {fontSize: 11, color: theme.colors.primary, fontWeight: '700', marginTop: 1},
  tagRow: {flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap'},
  categoryTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryTagText: {fontSize: 11, fontWeight: '800', color: '#D97706'},
  dateTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  dateTagText: {fontSize: 11, fontWeight: '600', color: theme.colors.muted},
  descriptionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  descriptionText: {fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500', lineHeight: 18},
  section: {
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 12, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 9, fontWeight: '900', color: theme.colors.muted,
    letterSpacing: 1.2, marginBottom: 10,
  },
  // ── View Details toggle button ──
  viewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, marginBottom: 12,
    backgroundColor: '#F0F4FF',
    borderRadius: 10,
    borderWidth: 1, borderColor: '#C7D7FF',
  },
  viewDetailsBtnText: {
    fontSize: 12, fontWeight: '700', color: theme.colors.primary,
  },
  // ── Contact bar ──
  contactBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.colors.primary + '08',
    paddingVertical: 8, borderRadius: 10,
    marginTop: 10,
  },
  contactText: {fontSize: 12, fontWeight: '800', color: theme.colors.primary},
});

// ─────────────────────────────────────────────────────────────────────────────
// ShopCard — self-contained component with expand/collapse state
// ─────────────────────────────────────────────────────────────────────────────
type ShopCardProps = {
  item: IShop;
  index: number;
  processingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onContact: (userId: string, name: string) => void;
};

const ShopCard = ({item, index, processingId, onApprove, onReject, onContact}: ShopCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const owner = item.owner as unknown as IUser;
  const isProcessing = processingId === String(item._id);
  const shop = item as any;
  const appliedAt = shop.createdAt
    ? new Date(shop.createdAt).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})
    : null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <Card style={styles.card} variant="elevated">

        {/* ── Header ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, {backgroundColor: '#FEF3C7'}]}>
            <Icon name="storefront" size={22} color="#D97706" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            {shop.businessName && shop.businessName !== item.name && (
              <Text style={styles.businessNameText}>"{shop.businessName}"</Text>
            )}
            <Text style={styles.itemSub}>Owner: {owner?.name || 'Merchant'}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>SHOP</Text>
          </View>
        </View>

        {/* ── Summary tags ── */}
        <View style={styles.tagRow}>
          <View style={styles.categoryTag}>
            <Icon name="pricetag-outline" size={11} color="#D97706" />
            <Text style={styles.categoryTagText}>{item.category}</Text>
          </View>
          {appliedAt && (
            <View style={styles.dateTag}>
              <Icon name="calendar-outline" size={11} color={theme.colors.muted} />
              <Text style={styles.dateTagText}>Applied {appliedAt}</Text>
            </View>
          )}
        </View>

        {/* ── View Details toggle ── */}
        <TouchableOpacity style={styles.viewDetailsBtn} onPress={toggle} activeOpacity={0.7}>
          <Icon name="document-text-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.viewDetailsBtnText}>
            {expanded ? 'Hide Details' : 'View Details'}
          </Text>
          <Icon
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={14}
            color={theme.colors.primary}
          />
        </TouchableOpacity>

        {/* ── Expanded Detail Sections ── */}
        {expanded && (
          <View>
            {/* Description */}
            {shop.description ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{shop.description}</Text>
              </View>
            ) : null}

            {/* Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CONTACT</Text>
              <DetailRow icon="person-outline" label="Owner Email" value={owner?.email || '—'} />
              {owner?.phoneNumber && (
                <DetailRow icon="call-outline" label="Owner Phone" value={owner.phoneNumber} />
              )}
              {shop.contactInfo?.businessEmail && (
                <DetailRow icon="mail-outline" label="Business Email" value={shop.contactInfo.businessEmail} />
              )}
              {shop.contactInfo?.businessPhone && (
                <DetailRow icon="phone-portrait-outline" label="Business Phone" value={shop.contactInfo.businessPhone} />
              )}
            </View>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ADDRESS</Text>
              <DetailRow icon="map-outline" label="Full Address" value={item.address} />
              {shop.detailedAddress?.street && (
                <DetailRow icon="location-outline" label="Street" value={shop.detailedAddress.street} />
              )}
              {shop.detailedAddress?.city && (
                <DetailRow
                  icon="business-outline"
                  label="City"
                  value={`${shop.detailedAddress.city}, ${shop.detailedAddress.state || ''} - ${shop.detailedAddress.pincode || ''}`}
                />
              )}
            </View>

            {/* KYC */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>KYC DOCUMENTS</Text>
              {shop.aadharCard && (
                <DetailRow icon="card-outline" label="Aadhaar No." value={shop.aadharCard} sensitive />
              )}
              <DetailRow
                icon="document-text-outline"
                label="GSTIN"
                value={shop.gstin || 'Not provided'}
                muted={!shop.gstin}
              />
              <DetailRow
                icon="shield-checkmark-outline"
                label="Terms Accepted"
                value={shop.isTermsAccepted ? 'Yes' : 'No'}
                highlight={shop.isTermsAccepted}
              />
            </View>

            {/* Bank */}
            {shop.bankDetails && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BANK DETAILS</Text>
                {shop.bankDetails.bankName && (
                  <DetailRow icon="business-outline" label="Bank" value={shop.bankDetails.bankName} />
                )}
                {shop.bankDetails.holderName && (
                  <DetailRow icon="person-outline" label="Account Holder" value={shop.bankDetails.holderName} />
                )}
                {shop.bankDetails.accountNumber && (
                  <DetailRow icon="wallet-outline" label="Account No." value={shop.bankDetails.accountNumber} sensitive />
                )}
                {shop.bankDetails.ifscCode && (
                  <DetailRow icon="code-outline" label="IFSC Code" value={shop.bankDetails.ifscCode} />
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveBtn, isProcessing && styles.disabledBtn]}
            onPress={() => onApprove(String(item._id))}
            disabled={isProcessing}>
            <Icon name="checkmark-circle-outline" size={15} color="#fff" />
            <Text style={styles.approveBtnText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectBtn, isProcessing && styles.disabledBtn]}
            onPress={() => onReject(String(item._id))}
            disabled={isProcessing}>
            <Icon name="close-circle-outline" size={15} color={theme.colors.danger} />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.contactBar} 
          onPress={() => onContact(String(owner?._id), item.name)}>
          <Icon name="mail-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.contactText}>Contact Merchant</Text>
        </TouchableOpacity>

      </Card>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RiderCard — self-contained component with expand/collapse state
// ─────────────────────────────────────────────────────────────────────────────
type RiderCardProps = {
  item: IUser;
  index: number;
  processingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onContact: (userId: string, name: string) => void;
};

const RiderCard = ({item, index, processingId, onApprove, onReject, onContact}: RiderCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const isProcessing = processingId === String(item._id);
  const rider = item as any;
  const appliedAt = rider.createdAt
    ? new Date(rider.createdAt).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})
    : null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
      <Card style={styles.card} variant="elevated">

        {/* ── Header ── */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, {backgroundColor: '#EEF2FF'}]}>
            <Icon name="bicycle" size={22} color="#4F46E5" />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemSub}>{item.email}</Text>
          </View>
          <View style={[styles.pendingBadge, {backgroundColor: '#EEF2FF'}]}>
            <Text style={[styles.pendingBadgeText, {color: '#4F46E5'}]}>RIDER</Text>
          </View>
        </View>

        {/* ── Summary tags ── */}
        <View style={styles.tagRow}>
          {rider.vehicleDetails?.type && (
            <View style={[styles.categoryTag, {backgroundColor: '#EEF2FF'}]}>
              <Icon name="bicycle-outline" size={11} color="#4F46E5" />
              <Text style={[styles.categoryTagText, {color: '#4F46E5'}]}>
                {rider.vehicleDetails.type}
              </Text>
            </View>
          )}
          {appliedAt && (
            <View style={styles.dateTag}>
              <Icon name="calendar-outline" size={11} color={theme.colors.muted} />
              <Text style={styles.dateTagText}>Applied {appliedAt}</Text>
            </View>
          )}
        </View>

        {/* ── View Details toggle ── */}
        <TouchableOpacity
          style={[styles.viewDetailsBtn, {backgroundColor: '#EEF2FF', borderColor: '#C4C9F7'}]}
          onPress={toggle}
          activeOpacity={0.7}>
          <Icon name="person-circle-outline" size={14} color="#4F46E5" />
          <Text style={[styles.viewDetailsBtnText, {color: '#4F46E5'}]}>
            {expanded ? 'Hide Details' : 'View Details'}
          </Text>
          <Icon
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            size={14}
            color="#4F46E5"
          />
        </TouchableOpacity>

        {/* ── Expanded Detail Sections ── */}
        {expanded && (
          <View>
            {/* Contact */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CONTACT</Text>
              <DetailRow icon="mail-outline" label="Email" value={item.email} />
              {item.phoneNumber && (
                <DetailRow icon="call-outline" label="Phone" value={item.phoneNumber} />
              )}
            </View>

            {/* Vehicle Info */}
            {rider.vehicleDetails?.type && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>VEHICLE INFO</Text>
                <DetailRow icon="bicycle-outline" label="Type" value={rider.vehicleDetails.type} />
                {rider.vehicleDetails.model && (
                  <DetailRow icon="car-outline" label="Model" value={rider.vehicleDetails.model} />
                )}
                {rider.vehicleDetails.number && (
                  <DetailRow icon="barcode-outline" label="Reg. Number" value={rider.vehicleDetails.number} />
                )}
              </View>
            )}

            {/* KYC / Documents */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>KYC DOCUMENTS</Text>
              {rider.licenseNumber ? (
                <DetailRow icon="card-outline" label="License No." value={rider.licenseNumber} sensitive />
              ) : (
                <DetailRow icon="card-outline" label="License No." value="Not provided" muted />
              )}
              <DetailRow
                icon="documents-outline"
                label="Doc Uploads"
                value={
                  rider.riderDocuments?.length > 0
                    ? `${rider.riderDocuments.length} file${rider.riderDocuments.length > 1 ? 's' : ''} uploaded`
                    : 'No documents uploaded'
                }
                muted={!rider.riderDocuments?.length}
              />
            </View>

            {/* Bank Details */}
            {rider.bankDetails && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>BANK DETAILS</Text>
                {rider.bankDetails.bankName && (
                  <DetailRow icon="business-outline" label="Bank" value={rider.bankDetails.bankName} />
                )}
                {rider.bankDetails.holderName && (
                  <DetailRow icon="person-outline" label="Account Holder" value={rider.bankDetails.holderName} />
                )}
                {rider.bankDetails.accountNumber && (
                  <DetailRow icon="wallet-outline" label="Account No." value={rider.bankDetails.accountNumber} sensitive />
                )}
                {rider.bankDetails.ifscCode && (
                  <DetailRow icon="code-outline" label="IFSC Code" value={rider.bankDetails.ifscCode} />
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.approveBtn, {backgroundColor: '#4F46E5'}, isProcessing && styles.disabledBtn]}
            onPress={() => onApprove(String(item._id))}
            disabled={isProcessing}>
            <Icon name="checkmark-circle-outline" size={15} color="#fff" />
            <Text style={styles.approveBtnText}>Verify Rider</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rejectBtn, isProcessing && styles.disabledBtn]}
            onPress={() => onReject(String(item._id))}
            disabled={isProcessing}>
            <Icon name="close-circle-outline" size={15} color={theme.colors.danger} />
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.contactBar, {backgroundColor: '#EEF2FF'}]} 
          onPress={() => onContact(String(item._id), item.name)}>
          <Icon name="mail-outline" size={14} color="#4F46E5" />
          <Text style={[styles.contactText, {color: '#4F46E5'}]}>Contact Rider</Text>
        </TouchableOpacity>

      </Card>
    </Animated.View>
  );
};
