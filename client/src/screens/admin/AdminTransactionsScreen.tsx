import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import Icon from 'react-native-vector-icons/Ionicons';
import {format} from 'date-fns';
import {IWalletTransaction, IUser} from '@shared/types';

export default function AdminTransactionsScreen({route, navigation}: any) {
  const filterOrderId = route.params?.orderId;
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<IWalletTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<IWalletTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filterOrderId || '');

  const fetchTransactions = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/transactions');
      if (res.data.success) {
        setTransactions(res.data.data);
        applyFilter(res.data.data, searchQuery);
      }
    } catch (error) {
      console.error('Fetch transactions error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilter = (data: IWalletTransaction[], query: string) => {
    if (!query) {
      setFilteredTransactions(data);
      return;
    }
    const q = query.toLowerCase();
    const filtered = data.filter(t => {
      const user = t.user as unknown as IUser;
      const orderId = t.orderId?.toString().toLowerCase() || '';
      const userName = user?.name?.toLowerCase() || '';
      const description = t.description.toLowerCase();
      return orderId.includes(q) || userName.includes(q) || description.includes(q);
    });
    setFilteredTransactions(filtered);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    applyFilter(transactions, searchQuery);
  }, [searchQuery, transactions]);

  const stats = {
    totalCredits: transactions.filter(t => t.type === 'credit').reduce((acc, t) => acc + t.amount, 0),
    totalDebits: transactions.filter(t => t.type === 'debit').reduce((acc, t) => acc + t.amount, 0),
    count: transactions.length
  };

  const renderItem = ({item}: {item: IWalletTransaction}) => {
    const user = item.user as unknown as IUser;
    const isSystem = (item.user as any)?._id === '000000000000000000000000' || item.user?.toString() === '000000000000000000000000';
    const isCredit = item.type === 'credit';

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.userInfo}>
            <View style={[styles.typeIcon, {backgroundColor: isSystem ? '#EEF2FF' : isCredit ? '#DCFCE7' : '#FEE2E2'}]}>
              <Icon 
                name={isSystem ? "shield-checkmark" : isCredit ? "arrow-down-outline" : "arrow-up-outline"} 
                size={16} 
                color={isSystem ? '#4F46E5' : isCredit ? '#15803D' : '#B91C1C'} 
              />
            </View>
            <View>
              <Text style={styles.userName}>{isSystem ? 'VELTO SYSTEM REVENUE' : user?.name || 'Unknown User'}</Text>
              <Text style={styles.userSub}>{isSystem ? 'Central Revenue Account' : user?.email || 'No email'}</Text>
            </View>
          </View>
          <Text style={[styles.amount, {color: isSystem ? '#4F46E5' : isCredit ? '#15803D' : '#B91C1C'}]}>
            {isCredit ? '+' : '-'} ₹{item.amount.toLocaleString()}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBottom}>
          <View style={styles.descRow}>
            <Icon name="information-circle-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.description}>{item.description}</Text>
          </View>
          
          {(item.orderId as any)?.paymentMethod && (
            <View style={styles.paymentInfoRow}>
              <Icon name="card-outline" size={14} color={theme.colors.info} />
              <Text style={styles.paymentInfoText}>
                Source: {(item.orderId as any).paymentMethod} 
                {(item.orderId as any).razorpayOrderId ? ` (#${(item.orderId as any).razorpayOrderId.slice(-8)})` : ''}
              </Text>
            </View>
          )}

          {user?.bankDetails?.accountNumber && item.description.toLowerCase().includes('refund') && (
            <View style={styles.bankInfoBox}>
              <View style={styles.bankHeader}>
                <Icon name="business-outline" size={12} color={theme.colors.warning} />
                <Text style={styles.bankTitle}>TARGET BANK DETAILS</Text>
              </View>
              <Text style={styles.bankValue}>Acc: {user.bankDetails.accountNumber}</Text>
              <Text style={styles.bankValue}>IFSC: {user.bankDetails.ifscCode}</Text>
              <Text style={styles.bankValue}>Holder: {user.bankDetails.holderName}</Text>
            </View>
          )}

          <View style={styles.dateRow}>
            <Icon name="time-outline" size={14} color={theme.colors.muted} />
            <Text style={styles.date}>
              {format(new Date(item.createdAt || Date.now()), 'dd MMM yyyy, hh:mm a')}
            </Text>
          </View>
        </View>

        {item.orderId && (
          <TouchableOpacity 
            style={styles.orderLink}
            onPress={() => {
              const id = (item.orderId as any)?._id || item.orderId?.toString();
              navigation.navigate('Orders', {searchId: id});
            }}>
            <Text style={styles.orderLinkText}>View Order Details</Text>
            <Icon name="chevron-forward" size={12} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Global Ledger</Text>
        </View>
        <Text style={styles.subtitle}>Audit all wallet movements</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={20} color={theme.colors.muted} />
          <TextInput
            placeholder="Search by Order ID, Name, or Note..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total In (Credits)</Text>
          <Text style={[styles.statValue, {color: '#15803D'}]}>₹{stats.totalCredits.toLocaleString()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Out (Debits)</Text>
          <Text style={[styles.statValue, {color: '#B91C1C'}]}>₹{stats.totalDebits.toLocaleString()}</Text>
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderItem}
        keyExtractor={(item) => item._id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {setRefreshing(true); fetchTransactions();}} 
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="receipt-outline" size={64} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No transactions found matching your search</Text>
          </View>
        }
      />

      {loading && !refreshing && <Loader fullScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  header: {padding: 20, backgroundColor: theme.colors.white},
  headerTop: {flexDirection: 'row', alignItems: 'center', gap: 12},
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 13, color: theme.colors.muted, marginTop: 4, fontWeight: '600', marginLeft: 52},
  searchContainer: {padding: 16, backgroundColor: theme.colors.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9'},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchInput: {flex: 1, marginLeft: 8, fontSize: 14, color: theme.colors.text, fontWeight: '500'},
  statsRow: {flexDirection: 'row', padding: 16, gap: 12},
  statBox: {
    flex: 1, 
    backgroundColor: theme.colors.white, 
    padding: 16, 
    borderRadius: 20,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statLabel: {fontSize: 10, color: theme.colors.muted, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4},
  statValue: {fontSize: 18, fontWeight: '900'},
  list: {padding: 16},
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  userInfo: {flexDirection: 'row', alignItems: 'center', gap: 12},
  typeIcon: {width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center'},
  userName: {fontSize: 15, fontWeight: '700', color: theme.colors.text},
  userSub: {fontSize: 12, color: theme.colors.muted, marginTop: 1},
  amount: {fontSize: 16, fontWeight: '900'},
  divider: {height: 1, backgroundColor: '#F1F5F9', marginVertical: 16},
  cardBottom: {gap: 8},
  descRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  description: {fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500'},
  dateRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  date: {fontSize: 11, color: theme.colors.muted, fontWeight: '600'},
  paymentInfoRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4},
  paymentInfoText: {fontSize: 12, color: theme.colors.info, fontWeight: '700'},
  bankInfoBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderStyle: 'dashed',
  },
  bankHeader: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8},
  bankTitle: {fontSize: 10, fontWeight: '800', color: theme.colors.warning, letterSpacing: 0.5},
  bankValue: {fontSize: 12, color: theme.colors.text, fontWeight: '700', marginBottom: 2},
  orderLink: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: theme.colors.primary + '08',
    borderRadius: 10,
  },
  orderLinkText: {fontSize: 12, fontWeight: '800', color: theme.colors.primary},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100},
  emptyText: {color: theme.colors.muted, marginTop: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40},
});
