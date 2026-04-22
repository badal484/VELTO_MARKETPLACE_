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

      const res = await axiosInstance.post('/api/chat', {
        receiverId: owner._id,
      });

      navigation.navigate('ChatTab', {
        screen: 'ChatRoom',
        params: {
          conversationId: res.data.data._id,
          otherUser: owner,
          shopName: shop.name,
        },
      });
    } catch (error: any) {
      console.error('Error initiating chat:', error);
      showToast({
        message: error.response?.data?.message || 'Could not start conversation',
        type: 'error',
      });
    }
  };

  const renderShop = ({item, index}: {item: IShop; index: number}) => (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(500)}>
      <Card style={styles.card} variant="elevated">
        <View style={styles.shopMain}>
          <View style={styles.iconContainer}>
            <Icon name="storefront" size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.infoContent}>
            <View style={styles.nameRow}>
              <Text style={styles.shopName} numberOfLines={1}>
                {item.name}
              </Text>
              <Badge
                label={
                  item.isVerified
                    ? 'Verified'
                    : item.rejectionReason
                    ? 'Rejected'
                    : 'Pending'
                }
                type={
                  item.isVerified
                    ? 'success'
                    : item.rejectionReason
                    ? 'danger'
                    : 'warning'
                }
              />
            </View>
            <Text style={styles.ownerText}>
              Owner:{' '}
              {typeof item.owner === 'object' ? (item.owner as any)?.name : 'Merchant'}
            </Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon name="map-outline" size={12} color={theme.colors.muted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.address}
                </Text>
              </View>
            </View>
          </View>
        </View>

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
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{item.category}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.contactBar} 
          onPress={() => handleContactMerchant(item)}>
          <Icon name="mail-outline" size={14} color={theme.colors.primary} />
          <Text style={styles.contactText}>Contact Merchant</Text>
        </TouchableOpacity>
      </Card>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Shop Directory</Text>
          <Text style={styles.subtitle}>
            {shops.length} total merchants on VELTO
          </Text>
        </View>
        <FlatList
          data={shops}
          keyExtractor={item => String(item._id)}
          renderItem={renderShop}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAllShops();
              }}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>
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
  list: {padding: 16, paddingBottom: 40},
  card: {marginBottom: 12, padding: 16, borderRadius: 20},
  shopMain: {flexDirection: 'row', gap: 16},
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {flex: 1},
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  ownerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  metaRow: {flexDirection: 'row', alignItems: 'center', marginTop: 8},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 11, color: theme.colors.muted, fontWeight: '500'},
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tag: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  performanceRow: {flexDirection: 'row', gap: 16},
  perfItem: {alignItems: 'center'},
  perfValue: {fontSize: 13, fontWeight: '900', color: theme.colors.text},
  perfLabel: {fontSize: 8, fontWeight: '700', color: theme.colors.muted, marginTop: 2},
  contactBar: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary + '08',
    paddingVertical: 8,
    borderRadius: 10,
  },
  contactText: {fontSize: 12, fontWeight: '800', color: theme.colors.primary},
  dateText: {fontSize: 10, color: theme.colors.muted, fontWeight: '600'},
});
