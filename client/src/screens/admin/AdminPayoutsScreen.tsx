import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import {format} from 'date-fns';
import {PayoutRequestStatus} from '@shared/types';

export default function AdminPayoutsScreen({navigation}: any) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Selection/Update
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await axiosInstance.get('/api/payouts/admin/all');
      if (res.data.success) {
        setRequests(res.data.data);
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error('Fetch payouts error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (status: PayoutRequestStatus) => {
    if (status === PayoutRequestStatus.COMPLETED && !transactionId) {
      Alert.alert('Required', 'Please enter a Transaction ID for completion');
      return;
    }

    try {
      setUpdating(true);
      const res = await axiosInstance.patch(`/api/payouts/admin/${selectedRequest._id}`, {
        status,
        adminNote,
        transactionId,
      });

      if (res.data.success) {
        Alert.alert('Success', `Payout marked as ${status}`);
        setSelectedRequest(null);
        fetchRequests();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const renderItem = ({item}: {item: any}) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => {
        setSelectedRequest(item);
        setAdminNote(item.adminNote || '');
        setTransactionId(item.transactionId || '');
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>
            {item.shopName ? `${item.shopName} (${item.rider?.name || item.rider?._id || 'User'})` : (item.rider?.name || item.rider?._id || 'User')}
          </Text>
          <Text style={styles.riderEmail}>{item.rider?.role?.toUpperCase() || 'UNKNOWN'} • {item.rider?.email || 'No Email'}</Text>
        </View>
        <Text style={styles.amount}>₹{item.amount}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <Text style={styles.date}>{format(new Date(item.createdAt), 'dd MMM yyyy')}</Text>
        <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status) + '20'}]}>
          <Text style={[styles.statusText, {color: getStatusColor(item.status)}]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: PayoutRequestStatus) => {
    switch (status) {
      case PayoutRequestStatus.PENDING: return '#F59E0B';
      case PayoutRequestStatus.PROCESSING: return theme.colors.primary;
      case PayoutRequestStatus.COMPLETED: return theme.colors.success;
      case PayoutRequestStatus.REJECTED: return theme.colors.danger;
      default: return theme.colors.muted;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Payouts</Text>
        <Text style={styles.subtitle}>Review and clear rider earnings</Text>
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>₹{stats.totalPendingAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Requests</Text>
            <Text style={styles.statValue}>{stats.pending}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Processed</Text>
            <Text style={styles.statValue}>{stats.completed}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchRequests();}} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="cash-outline" size={64} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No payout requests found</Text>
          </View>
        }
      />

      {/* Process Modal */}
      <Modal visible={!!selectedRequest} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Process Payout</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      setUpdating(true);
                      const res = await axiosInstance.post('/api/chat', {receiverId: selectedRequest.rider._id});
                      navigation.navigate('ChatRoom', {
                        conversationId: res.data.data._id,
                        otherUser: selectedRequest.rider,
                        shopName: 'Payout Inquiry',
                      });
                    } catch (e) {
                      Alert.alert('Error', 'Could not start chat');
                    } finally {
                      setUpdating(false);
                    }
                  }}
                  style={styles.modalContactBtn}>
                  <Icon name="chatbubble-ellipses-outline" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedRequest && (
              <ScrollView>
                <View style={styles.payoutDetail}>
                  <View style={styles.beneficiarySummary}>
                    <View style={{flex: 1, paddingRight: 10}}>
                      <Text style={styles.detailLabel}>Beneficiary</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4}}>
                        <Text style={styles.detailValue} numberOfLines={1}>
                          {selectedRequest.shopName || selectedRequest.rider?.name || 'User'}
                        </Text>
                        <View style={[styles.roleBadge, {backgroundColor: selectedRequest.rider?.role === 'rider' ? '#EEF2FF' : '#FFF7ED'}]}>
                          <Text style={[styles.roleBadgeText, {color: selectedRequest.rider?.role === 'rider' ? '#4F46E5' : '#C2410C'}]}>
                            {selectedRequest.rider?.role?.toUpperCase() || 'USER'}
                          </Text>
                        </View>
                      </View>
                      {selectedRequest.shopName && (
                         <Text style={{fontSize: 12, color: theme.colors.muted, marginTop: 2}}>Owner: {selectedRequest.rider?.name}</Text>
                      )}
                    </View>
                    <View style={styles.balanceBadge}>
                      <Text style={styles.balanceBadgeLabel}>Balance</Text>
                      <Text style={styles.balanceBadgeValue}>₹{selectedRequest.rider?.walletBalance ?? 0}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.detailLabel}>Bank Details</Text>
                  <View style={styles.bankBox}>
                    <Text style={styles.bankText}>Hold: {selectedRequest.bankDetails.holderName}</Text>
                    <Text style={styles.bankText}>Bank: {selectedRequest.bankDetails.bankName}</Text>
                    <Text style={styles.bankText}>Acc: {selectedRequest.bankDetails.accountNumber}</Text>
                    <Text style={styles.bankText}>IFSC: {selectedRequest.bankDetails.ifscCode}</Text>
                  </View>

                  <Text style={styles.detailLabel}>Settlement Breakdown</Text>
                  <View style={styles.breakdownBox}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Requested Amount</Text>
                      <Text style={styles.breakdownValue}>₹{selectedRequest.amount}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>TDS (1%)</Text>
                      <Text style={[styles.breakdownValue, {color: theme.colors.danger}]}>- ₹{(selectedRequest.amount * 0.01).toFixed(2)}</Text>
                    </View>
                    <View style={styles.dividerSmall} />
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, {fontWeight: '800'}]}>Final Payable</Text>
                      <Text style={[styles.breakdownValue, {fontWeight: '900', color: theme.colors.primary}]}>
                        ₹{(selectedRequest.amount * 0.99).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.detailLabel}>Payout Timeline</Text>
                  <View style={styles.timeline}>
                    <View style={styles.timelineItem}>
                      <Icon name="radio-button-on" size={16} color={theme.colors.success} />
                      <Text style={styles.timelineText}>Requested on {format(new Date(selectedRequest.createdAt), 'dd MMM, hh:mm a')}</Text>
                    </View>
                    {selectedRequest.processedAt && (
                      <View style={styles.timelineItem}>
                        <Icon name="checkmark-circle" size={16} color={theme.colors.success} />
                        <Text style={styles.timelineText}>Processed on {format(new Date(selectedRequest.processedAt), 'dd MMM, hh:mm a')}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailAmount}>₹{selectedRequest.amount}</Text>

                  {selectedRequest.status === PayoutRequestStatus.COMPLETED ? (
                    <View style={styles.completedBox}>
                      <View style={styles.successBanner}>
                        <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
                        <Text style={styles.successBannerText}>This payout has been successfully settled.</Text>
                      </View>
                      
                      <View style={styles.readOnlyItem}>
                        <Text style={styles.detailLabel}>Reference / Transaction ID</Text>
                        <Text style={styles.readOnlyValue}>{selectedRequest.transactionId || 'N/A'}</Text>
                      </View>

                      {selectedRequest.adminNote && (
                        <View style={[styles.readOnlyItem, {marginTop: 15}]}>
                          <Text style={styles.detailLabel}>Admin Note</Text>
                          <Text style={styles.readOnlyValue}>{selectedRequest.adminNote}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View>
                      <Input 
                        label="Transaction ID / Reference" 
                        placeholder="Enter after payment" 
                        value={transactionId} 
                        onChangeText={setTransactionId}
                      />
                      <Input 
                        label="Internal Admin Note" 
                        placeholder="Optional message" 
                        value={adminNote} 
                        onChangeText={setAdminNote}
                      />

                      <View style={styles.modalActions}>
                        <Button 
                          title="Mark as Paid" 
                          style={{flex: 1}} 
                          isLoading={updating}
                          onPress={() => handleUpdateStatus(PayoutRequestStatus.COMPLETED)}
                        />
                        <Button 
                          title="Reject" 
                          type="danger" 
                          style={{marginLeft: 10}}
                          isLoading={updating}
                          onPress={() => handleUpdateStatus(PayoutRequestStatus.REJECTED)}
                        />
                      </View>
                      <Button 
                        title="Move to Processing" 
                        type="outline" 
                        style={{marginTop: 10}}
                        isLoading={updating}
                        disabled={selectedRequest.status === PayoutRequestStatus.PROCESSING}
                        onPress={() => handleUpdateStatus(PayoutRequestStatus.PROCESSING)}
                      />
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {loading && !refreshing && <Loader fullScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F1F5F9'},
  header: {padding: 24, backgroundColor: theme.colors.white},
  title: {fontSize: 28, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 14, color: theme.colors.muted, marginTop: 4, fontWeight: '500'},
  list: {padding: 16},
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  riderInfo: {flex: 1},
  riderName: {fontSize: 16, fontWeight: '700', color: theme.colors.text},
  riderEmail: {fontSize: 12, color: theme.colors.muted, marginTop: 2},
  amount: {fontSize: 18, fontWeight: '900', color: theme.colors.primary},
  divider: {height: 1, backgroundColor: '#F1F5F9', marginVertical: 16},
  cardFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  date: {fontSize: 12, color: theme.colors.muted, fontWeight: '500'},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8},
  statusText: {fontSize: 10, fontWeight: '800'},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100},
  emptyText: {color: theme.colors.muted, marginTop: 16, fontWeight: '600'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24},
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  payoutDetail: {paddingBottom: 20},
  detailLabel: {fontSize: 12, color: theme.colors.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8},
  detailValue: {fontSize: 18, fontWeight: '700', color: theme.colors.text},
  detailAmount: {fontSize: 32, fontWeight: '900', color: theme.colors.primary, marginBottom: 20},
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  bankBox: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankText: {fontSize: 14, color: theme.colors.text, marginBottom: 4, fontWeight: '500'},
  modalActions: {flexDirection: 'row', marginTop: 10},
  modalContactBtn: {
    padding: 8,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 10,
  },
  beneficiarySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  balanceBadge: {
    backgroundColor: theme.colors.success + '15',
    padding: 12,
    borderRadius: 16,
    alignItems: 'flex-end',
  },
  balanceBadgeLabel: {
    fontSize: 10,
    color: theme.colors.success,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  balanceBadgeValue: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.success,
  },
  statsRow: {
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 12,
    backgroundColor: theme.colors.white,
  },
  statBox: {
    flex: 1, 
    backgroundColor: '#F8FAFC', 
    padding: 16, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: {fontSize: 10, color: theme.colors.muted, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4},
  statValue: {fontSize: 16, fontWeight: '900', color: theme.colors.text},
  breakdownBox: {
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  breakdownRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  breakdownLabel: {fontSize: 13, color: theme.colors.muted, fontWeight: '500'},
  breakdownValue: {fontSize: 13, color: theme.colors.text, fontWeight: '700'},
  dividerSmall: {height: 1, backgroundColor: '#E2E8F0', marginVertical: 8},
  timeline: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  timelineItem: {flexDirection: 'row', alignItems: 'center', gap: 10},
  timelineText: {fontSize: 12, color: theme.colors.text, fontWeight: '500'},
  completedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.success + '15',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.success,
  },
  readOnlyItem: {
    paddingLeft: 4,
  },
  readOnlyValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
});
