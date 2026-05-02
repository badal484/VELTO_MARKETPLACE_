import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {Badge} from '../../components/common/Badge';
import Icon from 'react-native-vector-icons/Ionicons';
import {IUser, Role} from '@shared/types';
import {AdminUserDetailModal} from '../../components/admin/AdminUserDetailModal';
import Animated, {FadeInUp} from 'react-native-reanimated';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'riders' | 'sellers'>('all');

  useEffect(() => {
    fetchUsers();
  }, [activeFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/api/admin/users');
      let filtered = res.data.data;
      
      if (activeFilter === 'riders') {
        filtered = filtered.filter((u: any) => u.role === Role.RIDER);
      } else if (activeFilter === 'sellers') {
        filtered = filtered.filter((u: any) => u.role === Role.SELLER || u.role === Role.SHOP_OWNER);
      }
      
      setUsers(filtered);
    } catch (error: unknown) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
    Alert.alert(
      'Permanent Deletion',
      `Are you absolutely sure you want to remove ${name}? All associated shop data and listings will be deleted.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete User',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/api/admin/users/${id}`);
              Alert.alert(
                'User Removed',
                `${name} has been successfully deleted from the platform.`,
              );
              fetchUsers();
            } catch (error: unknown) {
              if (error && typeof error === 'object' && 'response' in error) {
                const axiosErr = error as {response: {data: {message: string}}};
                Alert.alert(
                  'Deletion Failed',
                  axiosErr.response?.data?.message || 'Failed to remove user.',
                );
              }
            }
          },
        },
      ],
    );
  };

  const handleVerifyRider = async (id: string) => {
    try {
      setLoading(true);
      await axiosInstance.patch(`/api/admin/users/${id}/verify-rider`);
      Alert.alert('Success', 'Rider has been verified and can now accept deliveries.');
      fetchUsers();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to verify rider');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRider = async (id: string, reason: string) => {
    try {
      setLoading(true);
      await axiosInstance.patch(`/api/admin/users/${id}/reject-rider`, { rejectionReason: reason });
      Alert.alert('Rider Rejected', 'The application has been rejected and the user notified.');
      fetchUsers();
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject rider');
    } finally {
      setLoading(false);
    }
  };

  const getRoleConfig = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
        return {
          color: theme.colors.danger,
          label: 'Administrator',
          icon: 'shield-checkmark',
        };
      case Role.SHOP_OWNER:
        return {
          color: theme.colors.primary,
          label: 'Shop Owner',
          icon: 'business',
        };
      case Role.SELLER:
        return {color: '#8B5CF6', label: 'Merchant', icon: 'storefront'};
      case Role.RIDER:
        return {color: '#6366F1', label: 'Rider', icon: 'bicycle'};
      default:
        return {color: theme.colors.muted, label: 'Buyer', icon: 'person'};
    }
  };

  const renderUser = ({item, index}: {item: IUser; index: number}) => {
    const roleConfig = getRoleConfig(item.role);
    return (
      <Animated.View entering={FadeInUp.delay(index * 40).duration(500)}>
        <TouchableOpacity 
          activeOpacity={0.7} 
          onPress={() => {
            setSelectedUser(item);
            setModalVisible(true);
          }}
        >
          <Card style={styles.card} variant="elevated">
          <View style={styles.userMain}>
            <View
              style={[
                styles.avatarBox,
                {backgroundColor: roleConfig.color + '10'},
              ]}>
              <Text style={[styles.avatarLetter, {color: roleConfig.color}]}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
              <View
                style={[
                  styles.roleIndicator,
                  {backgroundColor: roleConfig.color},
                ]}
              />
            </View>

            <View style={styles.userDetails}>
              <View style={styles.titleRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.role === Role.ADMIN && (
                  <View style={styles.adminBadge}>
                    <Icon
                      name="shield-half"
                      size={10}
                      color={theme.colors.danger}
                    />
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>
                {item.email}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.roleLabel}>
                  <Icon
                    name={roleConfig.icon}
                    size={12}
                    color={roleConfig.color}
                  />
                  <Text style={[styles.roleText, {color: roleConfig.color}]}>
                    {roleConfig.label}
                  </Text>
                </View>
                <Text style={styles.joinedLabel}>
                  Since {new Date(item.createdAt ?? Date.now()).toLocaleDateString()}
                </Text>
              </View>
            </View>

            {item.role !== Role.ADMIN && (
              <TouchableOpacity
                onPress={() => handleDeleteUser(item._id, item.name)}
                style={styles.trashCircle}
                activeOpacity={0.6}>
                <Icon
                  name="trash-outline"
                  size={18}
                  color={theme.colors.danger}
                />
              </TouchableOpacity>
            )}
          </View>
        </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderFilter = (id: typeof activeFilter, label: string) => (
    <TouchableOpacity
      style={[styles.filterBtn, activeFilter === id && styles.activeFilterBtn]}
      onPress={() => setActiveFilter(id)}>
      <Text style={[styles.filterText, activeFilter === id && styles.activeFilterText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !refreshing && users.length === 0) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>User Management</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterBar}
          >
             {renderFilter('all', 'All')}
             {renderFilter('riders', 'Riders')}
             {renderFilter('sellers', 'Sellers')}
          </ScrollView>
        </View>
        <FlatList
          data={users}
          keyExtractor={item => item._id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="people-outline" size={64} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No users found in this category</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchUsers();
              }}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>
      <AdminUserDetailModal 
        visible={modalVisible} 
        user={selectedUser} 
        onClose={() => setModalVisible(false)} 
        onVerifyRider={handleVerifyRider}
        onRejectRider={handleRejectRider}
      />
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
  userMain: {flexDirection: 'row', alignItems: 'center'},
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarLetter: {fontSize: 20, fontWeight: '900'},
  roleIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  userDetails: {flex: 1, marginLeft: 16, marginRight: 8},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    flexShrink: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.danger + '10',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {fontSize: 9, fontWeight: '900', color: theme.colors.danger},
  userEmail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  roleLabel: {flexDirection: 'row', alignItems: 'center', gap: 4},
  roleText: {fontSize: 11, fontWeight: '700'},
  joinedLabel: {fontSize: 10, color: theme.colors.muted, fontWeight: '600'},
  trashCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.danger + '08',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    paddingTop: 16,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeFilterBtn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  activeFilterText: {
    color: theme.colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 12,
  },
});