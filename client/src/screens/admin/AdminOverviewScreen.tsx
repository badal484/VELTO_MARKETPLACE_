import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Button} from '../../components/common/Button';
import {AdminAnalyticsCard} from '../../components/admin/AdminAnalyticsCard';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import Animated, {FadeInUp, FadeInRight} from 'react-native-reanimated';
import {IShop, IUser} from '@shared/types';

interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  totalShops: number;
  pendingShops: number;
  totalOrders: number;
  totalConversations: number;
  totalRevenue: number;
  platformRevenue: number;
  dailySales: any[];
  monthlySales: any[];
  topShops: any[];
  riderStats: {
    total: number;
    pending: number;
  };
}

export default function AdminOverviewScreen() {
  const {showToast} = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingShops, setPendingShops] = useState<IShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        axiosInstance.get('/api/admin/stats'),
        axiosInstance.get('/api/admin/shops/pending'),
      ]);
      setStats(statsRes.data.data);
      setPendingShops(pendingRes.data.data);
    } catch (e: unknown) {
      console.log('Admin Overview Data Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (shopId: string) => {
    try {
      await axiosInstance.patch(`/api/admin/shops/${shopId}/approve`);
      showToast({message: 'Shop approved and verified live!', type: 'success'});
      fetchData();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'response' in e) {
        const axiosErr = e as {response: {data: {message: string}}};
        showToast({message: axiosErr.response?.data?.message || 'Failed to approve shop', type: 'error'});
      }
    }
  };

  const handleReject = (shopId: string) => {
    Alert.prompt(
      'Reject Application',
      'Please enter the reason for rejection:',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async reason => {
            if (!reason) {
              showToast({message: 'A rejection reason is required', type: 'info'});
              return;
            }
            try {
              await axiosInstance.patch(`/api/admin/shops/${shopId}/reject`, {
                reason,
              });
              showToast({message: 'Shop application rejected', type: 'info'});
              fetchData();
            } catch (e: unknown) {
              if (e && typeof e === 'object' && 'response' in e) {
                const axiosErr = e as {response: {data: {message: string}}};
                showToast({message: axiosErr.response?.data?.message || 'Failed to reject shop', type: 'error'});
              }
            }
          },
        },
      ],
    );
  };

  const renderStatCard = (
    label: string,
    value: number | string,
    icon: string,
    color: string,
    index: number,
  ) => (
    <Animated.View
      key={label}
      entering={FadeInUp.delay(index * 100)}
      style={styles.statCardWrapper}>
      <Card style={styles.statCard} variant="elevated">
        <View style={[styles.statIconBox, {backgroundColor: color + '15'}]}>
          <Icon name={icon} size={20} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </Animated.View>
  );

  if (loading && !stats) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.container}
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
        }>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>
            Marketplace Oversight & Statistics
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStatCard(
            'Revenue',
            `₹${(stats?.totalRevenue || 0).toLocaleString()}`,
            'wallet',
            theme.colors.text,
            0,
          )}
          {renderStatCard(
            'Velto Share',
            `₹${(stats?.platformRevenue || 0).toLocaleString()}`,
            'calculator',
            theme.colors.text,
            1,
          )}
          {renderStatCard(
            'Total Riders',
            stats?.riderStats.total || 0,
            'bicycle',
            theme.colors.text,
            2,
          )}
          {renderStatCard(
            'Users',
            stats?.totalUsers || 0,
            'people',
            theme.colors.text,
            3,
          )}
          {renderStatCard(
            'Products',
            stats?.totalProducts || 0,
            'cube',
            theme.colors.text,
            2,
          )}
          {renderStatCard(
            'Orders',
            stats?.totalOrders || 0,
            'cart',
            theme.colors.text,
            3,
          )}
          {renderStatCard(
            'Pending',
            stats?.pendingShops || 0,
            'time',
            theme.colors.text,
            4,
          )}
          {renderStatCard(
            'Chats',
            stats?.totalConversations || 0,
            'chatbubbles',
            theme.colors.text,
            5,
          )}
        </View>


        {stats && stats.dailySales && (
          <AdminAnalyticsCard
            title="Sales Trend (Weekly)"
            data={stats.dailySales}
            type="daily"
          />
        )}

        {stats && stats.topShops && stats.topShops.length > 0 && (
          <View style={styles.topShopsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Performing Shops</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topShopsList}>
              {stats.topShops.map((shop, idx) => (
                <Card key={idx} style={styles.topShopCard} variant="elevated">
                  <View style={styles.topShopHeader}>
                    <Text style={styles.topShopName} numberOfLines={1}>{shop.name}</Text>
                    <Icon name="trophy" size={14} color={theme.colors.primary} />
                  </View>

                  <Text style={styles.topShopRevenue}>₹{shop.revenue.toLocaleString()}</Text>
                  <Text style={styles.topShopOrders}>{shop.orderCount} Orders</Text>
                </Card>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verification Queue</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeText}>{pendingShops.length} apps</Text>
          </View>
        </View>

        <View style={styles.queueContainer}>
          {pendingShops.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <Icon
                  name="checkmark-done"
                  size={40}
                  color={theme.colors.success}
                />
              </View>
              <Text style={styles.emptyTitle}>Queue Cleared</Text>
              <Text style={styles.emptyText}>
                All shop applications have been reviewed.
              </Text>
            </View>
          ) : (
            pendingShops.map((shop, index) => (
              <Animated.View
                key={String(shop._id)}
                entering={FadeInRight.delay(index * 150)}>
                <Card style={styles.shopCard} variant="elevated">
                  <View style={styles.shopContent}>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {shop.name}
                      </Text>
                      <View style={styles.locRow}>
                        <Icon
                          name="location-outline"
                          size={12}
                          color={theme.colors.muted}
                        />
                        <Text style={styles.shopAddress} numberOfLines={1}>
                          {shop.address}
                        </Text>
                      </View>
                      <Text style={styles.ownerText}>
                        Owner:{' '}
                        {(shop.owner as unknown as IUser)?.name || 'Merchant'}
                      </Text>
                    </View>
                    <View style={styles.catBadge}>
                      <Text style={styles.catText}>{shop.category}</Text>
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn]}
                      onPress={() => handleApprove(String(shop._id))}>
                      <Text style={styles.btnText}>Quick Verify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn]}
                      onPress={() => handleReject(String(shop._id))}>
                      <Text
                        style={[styles.btnText, {color: theme.colors.danger}]}>
                        Refuse
                      </Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </Animated.View>
            ))
          )}
        </View>
        <View style={{height: 60}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: 26, fontWeight: '900', color: theme.colors.text},
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', padding: 12},
  statCardWrapper: {flexBasis: '50%', padding: 6},
  statCard: {padding: 20, alignItems: 'flex-start', borderRadius: 20},
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  statLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  badgeCount: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {color: theme.colors.white, fontSize: 10, fontWeight: '800'},
  queueContainer: {paddingHorizontal: 16},
  shopCard: {marginBottom: 16, padding: 20, borderRadius: 20},
  shopContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  shopInfo: {flex: 1, marginRight: 12},
  shopName: {fontSize: 16, fontWeight: '800', color: theme.colors.text},
  locRow: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4},
  shopAddress: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  ownerText: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 8,
    fontWeight: '600',
  },
  catBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  catText: {fontSize: 10, fontWeight: '700', color: theme.colors.primary},
  actions: {flexDirection: 'row', gap: 10, marginTop: 20},
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveBtn: {backgroundColor: theme.colors.primary},
  rejectBtn: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  btnText: {color: theme.colors.white, fontWeight: '800', fontSize: 13},
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: 4,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  emptyTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  emptyText: {
    color: theme.colors.muted,
    marginTop: 6,
    fontWeight: '500',
    fontSize: 13,
    textAlign: 'center',
  },
  topShopsSection: {
    marginTop: 20,
  },
  topShopsList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  topShopCard: {
    width: 160,
    padding: 16,
    borderRadius: 16,
  },
  topShopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topShopName: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 4,
  },
  topShopRevenue: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  topShopOrders: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
});