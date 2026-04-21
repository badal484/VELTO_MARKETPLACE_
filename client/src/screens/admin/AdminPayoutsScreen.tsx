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

export default function AdminPayoutsScreen() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
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
          <Text style={styles.riderName}>{item.rider?.name}</Text>
          <Text style={styles.riderEmail}>{item.rider?.email}</Text>
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
              <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedRequest && (
              <ScrollView>
                <View style={styles.payoutDetail}>
                  <Text style={styles.detailLabel}>Rider</Text>
                  <Text style={styles.detailValue}>{selectedRequest.rider?.name}</Text>
                  
                  <Text style={styles.detailLabel}>Bank Details</Text>
                  <View style={styles.bankBox}>
                    <Text style={styles.bankText}>Hold: {selectedRequest.bankDetails.holderName}</Text>
                    <Text style={styles.bankText}>Bank: {selectedRequest.bankDetails.bankName}</Text>
                    <Text style={styles.bankText}>Acc: {selectedRequest.bankDetails.accountNumber}</Text>
                    <Text style={styles.bankText}>IFSC: {selectedRequest.bankDetails.ifscCode}</Text>
                  </View>

                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailAmount}>₹{selectedRequest.amount}</Text>

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
                    onPress={() => handleUpdateStatus(PayoutRequestStatus.PROCESSING)}
                  />
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
  detailValue: {fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 20},
  detailAmount: {fontSize: 32, fontWeight: '900', color: theme.colors.primary, marginBottom: 20},
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
});
