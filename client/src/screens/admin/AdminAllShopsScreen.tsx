import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Badge} from '../../components/common/Badge';
import Icon from 'react-native-vector-icons/Ionicons';
import {IShop, IUser} from '@shared/types';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {useToast} from '../../hooks/useToast';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Reusable helpers ──────────────────────────────────────────────────────────
const maskSensitive = (val: string) => {
  if (!val || val.length < 6) return val;
  return val.slice(0, 4) + '•••••' + val.slice(-3);
};

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
  <View style={drStyles.row}>
    <Icon
      name={icon}
      size={13}
      color={highlight ? theme.colors.success : theme.colors.muted}
      style={drStyles.icon}
    />
    <Text style={drStyles.label}>{label}</Text>
    <Text
      style={[drStyles.value, muted && drStyles.valueMuted, highlight && drStyles.valueHighlight]}
      numberOfLines={2}
      selectable={!sensitive}>
      {sensitive ? maskSensitive(value) : value}
    </Text>
  </View>
);

const drStyles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7},
  icon: {marginTop: 2},
  label: {fontSize: 11, color: theme.colors.muted, fontWeight: '700', width: 100, flexShrink: 0},
  value: {fontSize: 12, color: theme.colors.text, fontWeight: '500', flex: 1},
  valueMuted: {color: theme.colors.muted, fontStyle: 'italic'},
  valueHighlight: {color: theme.colors.success, fontWeight: '700'},
});
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminAllShopsScreen({navigation}: {navigation: any}) {
  const {showToast} = useToast();
  const [shops, setShops] = useState<IShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllShops();
  }, []);

  const fetchAllShops = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/shops/all');
      setShops(res.data.data);
    } catch (error: unknown) {
      console.error('Error fetching all shops:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleContactMerchant = async (shop: IShop) => {
    try {
      const owner = shop.owner as unknown as IUser;
      if (!owner || !owner._id) {
        showToast({message: 'Owner information not available', type: 'error'});
        return;
      }
      const res = await axiosInstance.post('/api/chat', {receiverId: owner._id});
      
      // Navigate directly to ChatRoom which is in our RootStack
      navigation.navigate('ChatRoom', {
        conversationId: res.data.data._id,
        otherUser: owner,
        shopName: shop.name,
      });
    } catch (error: any) {
      showToast({
        message: error.response?.data?.message || 'Could not start conversation',
        type: 'error',
      });
    }
  };

  if (loading && !refreshing) return <Loader />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Shop Directory</Text>
          <Text style={styles.subtitle}>{shops.length} total merchants on VELTO</Text>
        </View>
        <FlatList
          data={shops}
          keyExtractor={item => String(item._id)}
          renderItem={({item, index}) => (
            <AllShopCard
              item={item}
              index={index}
              onContact={handleContactMerchant}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {setRefreshing(true); fetchAllShops();}}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

// ── AllShopCard ───────────────────────────────────────────────────────────────
type AllShopCardProps = {
  item: IShop;
  index: number;
  onContact: (shop: IShop) => void;
};

const AllShopCard = ({item, index, onContact}: AllShopCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const shop = item as any;
  const owner = item.owner as unknown as IUser;

  const verifiedAt = shop.verifiedAt
    ? new Date(shop.verifiedAt).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})
    : null;
  const createdAt = shop.createdAt
    ? new Date(shop.createdAt).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})
    : null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(v => !v);
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(500)}>
      <Card style={styles.card} variant="elevated">

        {/* ── Header ── */}
        <View style={styles.shopMain}>
          <View style={styles.iconContainer}>
            <Icon name="storefront" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <View style={styles.nameRow}>
              <Text style={styles.shopName} numberOfLines={1}>{item.name}</Text>
              <Badge
                label={item.isVerified ? 'Verified' : item.rejectionReason ? 'Rejected' : 'Pending'}
                type={item.isVerified ? 'success' : item.rejectionReason ? 'danger' : 'warning'}
              />
            </View>
            {shop.businessName && shop.businessName !== item.name && (
              <Text style={styles.businessName}>"{shop.businessName}"</Text>
            )}
            <Text style={styles.ownerText}>
              Owner: {typeof owner === 'object' ? owner?.name : 'Merchant'}
            </Text>
            <View style={styles.metaRow}>
              <Icon name="map-outline" size={12} color={theme.colors.muted} />
              <Text style={styles.metaText} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
        </View>

        {/* ── Performance row ── */}
        <View style={styles.footer}>
          <View style={styles.performanceRow}>
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>₹{(item.totalRevenue || 0).toLocaleString()}</Text>
              <Text style={styles.perfLabel}>REVENUE</Text>
            </View>
            <View style={styles.perfItem}>
              <Text style={styles.perfValue}>{item.listingCount || 0}</Text>
              <Text style={styles.perfLabel}>LISTINGS</Text>
            </View>
            {verifiedAt && (
              <View style={styles.perfItem}>
                <Text style={styles.perfValue}>{verifiedAt}</Text>
                <Text style={styles.perfLabel}>VERIFIED ON</Text>
              </View>
            )}
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.category}</Text>
          </View>
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

        {/* ── Expanded Sections ── */}
        {expanded && (
          <View>
            {/* Description */}
            {shop.description ? (
              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>{shop.description}</Text>
              </View>
            ) : null}

            {/* Contact */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>CONTACT</Text>
              <DetailRow icon="person-outline" label="Owner" value={owner?.name || '—'} />
              <DetailRow icon="mail-outline" label="Owner Email" value={owner?.email || '—'} />
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
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>ADDRESS</Text>
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
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>KYC DOCUMENTS</Text>
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
              {createdAt && (
                <DetailRow icon="calendar-outline" label="Applied On" value={createdAt} />
              )}
            </View>

            {/* Rejection reason if rejected */}
            {item.rejectionReason && (
              <View style={[styles.detailSection, styles.rejectionBox]}>
                <Text style={styles.detailSectionLabel}>REJECTION REASON</Text>
                <DetailRow icon="alert-circle-outline" label="Reason" value={item.rejectionReason} />
              </View>
            )}

            {/* Bank Details */}
            {shop.bankDetails && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>BANK DETAILS</Text>
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

        {/* ── Contact bar ── */}
        <TouchableOpacity style={styles.contactBar} onPress={() => onContact(item)}>
          <Icon name="mail-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.contactText}>Contact Merchant</Text>
        </TouchableOpacity>

      </Card>
    </Animated.View>
  );
};

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
  subtitle: {fontSize: 13, color: theme.colors.muted, marginTop: 4, fontWeight: '600'},
  list: {padding: 16, paddingBottom: 40},
  card: {marginBottom: 12, padding: 16, borderRadius: 20},
  shopMain: {flexDirection: 'row', gap: 16},
  iconContainer: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center', alignItems: 'center',
  },
  infoContent: {flex: 1},
  nameRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  shopName: {fontSize: 16, fontWeight: '800', color: theme.colors.text, flex: 1, marginRight: 8},
  businessName: {fontSize: 11, color: theme.colors.primary, fontWeight: '700', marginBottom: 2},
  ownerText: {fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600'},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6},
  metaText: {fontSize: 11, color: theme.colors.muted, fontWeight: '500', flex: 1},
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
    marginBottom: 12,
  },
  performanceRow: {flexDirection: 'row', gap: 16},
  perfItem: {alignItems: 'center'},
  perfValue: {fontSize: 13, fontWeight: '900', color: theme.colors.text},
  perfLabel: {fontSize: 8, fontWeight: '700', color: theme.colors.muted, marginTop: 2},
  tag: {
    backgroundColor: '#F8FAFC', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 6,
  },
  tagText: {fontSize: 10, fontWeight: '700', color: theme.colors.primary, textTransform: 'uppercase'},
  // ── View Details ──
  viewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, marginBottom: 12,
    backgroundColor: '#F0F4FF', borderRadius: 10,
    borderWidth: 1, borderColor: '#C7D7FF',
  },
  viewDetailsBtnText: {fontSize: 12, fontWeight: '700', color: theme.colors.primary},
  // ── Detail sections ──
  detailSection: {
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    paddingTop: 12, marginBottom: 12,
  },
  detailSectionLabel: {
    fontSize: 9, fontWeight: '900', color: theme.colors.muted,
    letterSpacing: 1.2, marginBottom: 10,
  },
  descriptionBox: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12,
    marginBottom: 14, borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
  },
  descriptionText: {
    fontSize: 12, color: theme.colors.textSecondary,
    fontWeight: '500', lineHeight: 18,
  },
  rejectionBox: {
    backgroundColor: '#FFF5F5', borderRadius: 10,
    padding: 12, borderLeftWidth: 3, borderLeftColor: theme.colors.danger,
  },
  // ── Contact bar ──
  contactBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: theme.colors.primary + '08',
    paddingVertical: 8, borderRadius: 10,
  },
  contactText: {fontSize: 12, fontWeight: '800', color: theme.colors.primary},
  dateText: {fontSize: 10, color: theme.colors.muted, fontWeight: '600'},
});
