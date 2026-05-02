import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import {format} from 'date-fns';
import {useAuth} from '../../hooks/useAuth';
import {Role} from '@shared/types';

export default function WalletScreen({navigation}: any) {
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState({
    balance: 0, 
    cashInHand: 0, 
    cashLimit: 2000, 
    transactions: []
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  
  // Payout Form
  const [amount, setAmount] = useState('');
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWallet = async () => {
    try {
      const res = await axiosInstance.get('/api/payouts/wallet');
      if (res.data.success) {
        setWalletData(res.data.data);
      }
    } catch (error) {
      console.error('Fetch wallet error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleRequestPayout = async () => {
    if (!amount || !holderName || !bankName || !accountNumber || !ifscCode) {
      Alert.alert('Error', 'Please fill in all bank details');
      return;
    }

    const payoutAmount = parseFloat(amount);
    if (isNaN(payoutAmount) || payoutAmount < 500) {
      Alert.alert('Error', 'Minimum payout amount is ₹500');
      return;
    }

    if (payoutAmount > walletData.balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    try {
      setSubmitting(true);
      const res = await axiosInstance.post('/api/payouts/request', {
        amount: payoutAmount,
        bankDetails: {
          holderName,
          bankName,
          accountNumber,
          ifscCode,
        },
      });

      if (res.data.success) {
        Alert.alert('Success', 'Payout request submitted! Admin will process this weekly.');
        setShowPayoutModal(false);
        fetchWallet();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTransaction = ({item}: {item: any}) => {
    const isCredit = item.type === 'credit';
    const isLiability = item.description?.includes('COD') || item.description?.includes('Offset');
    
    return (
      <View style={styles.transactionCard}>
        <View style={[styles.txIconContainer, {backgroundColor: isLiability ? '#F1F5F9' : (isCredit ? theme.colors.success + '10' : theme.colors.danger + '10')}]}>
          <Icon 
            name={isLiability ? 'swap-horizontal' : (isCredit ? 'arrow-down-circle' : 'arrow-up-circle')} 
            size={24} 
            color={isLiability ? theme.colors.muted : (isCredit ? theme.colors.success : theme.colors.danger)} 
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDescription} numberOfLines={1}>{item.description}</Text>
          <Text style={styles.txDate}>{format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}</Text>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={[styles.txAmount, {color: isLiability ? theme.colors.text : (isCredit ? theme.colors.success : theme.colors.danger)}]}>
            {isCredit ? '+' : '-'}₹{item.amount}
          </Text>
          {isLiability && (
            <Text style={{fontSize: 9, fontWeight: '700', color: theme.colors.muted}}>CASH TRK</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wallet</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchWallet();}} />}
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>₹{walletData.balance.toLocaleString()}</Text>
          <Button 
            title="Withdraw Funds" 
            type="accent" 
            style={styles.withdrawBtn}
            onPress={() => {
              // Pre-fill from user profile
              if (user?.bankDetails) {
                setHolderName(user.bankDetails.holderName || '');
                setBankName(user.bankDetails.bankName || '');
                setAccountNumber(user.bankDetails.accountNumber || '');
                setIfscCode(user.bankDetails.ifscCode || '');
              }
              setShowPayoutModal(true);
            }}
            disabled={walletData.balance < 500}
          />
          {walletData.balance < 500 && (
            <Text style={styles.minNote}>Minimum ₹500 required to withdraw</Text>
          )}
        </View>

        {/* 🚨 Cash Liability Dashboard - ONLY for Riders 🚨 */}
        {user?.role === Role.RIDER && (
          <View style={styles.liabilityCard}>
            <View style={styles.liabilityHeader}>
              <View>
                <Text style={styles.liabilityLabel}>Physical Cash in Hand</Text>
                <Text style={styles.liabilityValue}>₹{walletData.cashInHand.toLocaleString()}</Text>
              </View>
              <View style={styles.limitBadge}>
                <Text style={styles.limitBadgeText}>Tracked for Daily Settlement</Text>
              </View>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={[
                styles.progressBar, 
                { width: `${Math.min(100, (walletData.cashInHand / 10000) * 100)}%` },
                { backgroundColor: theme.colors.primary }
              ]} />
            </View>
  
            <Text style={styles.liabilityHint}>
              Total cash collected today. Please handover to Admin at end of shift.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {walletData.transactions.length > 0 ? (
            walletData.transactions.map((item: any) => (
              <React.Fragment key={item._id}>
                {renderTransaction({item})}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="receipt-outline" size={48} color={theme.colors.muted} />
              <Text style={styles.emptyText}>No transaction records yet</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payout Modal */}
      <Modal visible={showPayoutModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowPayoutModal(false)}>
              <Icon name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payout Request</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView contentContainerStyle={styles.formContent}>
            <View style={styles.infoBox}>
              <Icon name="information-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.infoText}>Enter your bank details carefully. Admin will process payments every Monday.</Text>
            </View>

            <Input 
              label="Amount to Withdraw" 
              placeholder="Min ₹500" 
              value={amount} 
              onChangeText={setAmount} 
              keyboardType="numeric"
            />
            <Input 
              label="Account Holder Name" 
              placeholder="As per bank records" 
              value={holderName} 
              onChangeText={setHolderName} 
            />
            <Input 
              label="Bank Name" 
              placeholder="e.g. HDFC Bank" 
              value={bankName} 
              onChangeText={setBankName} 
            />
            <Input 
              label="Account Number" 
              placeholder="Your bank account number" 
              value={accountNumber} 
              onChangeText={setAccountNumber} 
              keyboardType="numeric"
            />
            <Input 
              label="IFSC Code" 
              placeholder="11 digit IFSC code" 
              value={ifscCode} 
              onChangeText={setIfscCode} 
              autoCapitalize="characters"
            />

            <Button 
              title="Submit Request" 
              isLoading={submitting} 
              style={styles.submitBtn} 
              onPress={handleRequestPayout}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {loading && <Loader fullScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFC'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {fontSize: 20, fontWeight: '800', color: theme.colors.text},
  backBtn: {padding: 4},
  balanceCard: {
    backgroundColor: theme.colors.primary,
    margin: 20,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    ...theme.shadow.md,
  },
  balanceLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: 8},
  balanceValue: {color: theme.colors.white, fontSize: 36, fontWeight: '900', marginBottom: 20},
  withdrawBtn: {backgroundColor: theme.colors.white, width: '100%', height: 50},
  minNote: {color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 12, fontWeight: '500'},
  section: {padding: 20},
  sectionTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 16},
  liabilityCard: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadow.sm,
  },
  liabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  liabilityLabel: {fontSize: 12, color: theme.colors.muted, fontWeight: '700', marginBottom: 4},
  liabilityValue: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  limitBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  limitBadgeError: {
    backgroundColor: theme.colors.danger + '15',
  },
  limitBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  liabilityHint: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.danger + '10',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  txInfo: {flex: 1},
  txDescription: {fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4},
  txDate: {fontSize: 12, color: theme.colors.muted, fontWeight: '500'},
  txAmount: {fontSize: 16, fontWeight: '800'},
  emptyContainer: {alignItems: 'center', marginTop: 40},
  emptyText: {color: theme.colors.muted, marginTop: 12, fontWeight: '600'},
  modalContainer: {flex: 1, backgroundColor: theme.colors.background},
  formContent: {padding: 20},
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoText: {flex: 1, fontSize: 13, color: '#1E40AF', lineHeight: 18, fontWeight: '500'},
  submitBtn: {marginTop: 20},
});
