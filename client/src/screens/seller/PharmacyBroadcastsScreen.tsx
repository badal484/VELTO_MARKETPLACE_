import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {useSocket} from '../../hooks/useSocket';
import {SocketEvent} from '@shared/constants/socketEvents';
import {StackNavigationProp} from '@react-navigation/stack';
import {DashboardStackParamList} from '../../navigation/types';

type Nav = StackNavigationProp<DashboardStackParamList, 'PharmacyBroadcasts'>;
interface Props {navigation: Nav}

interface BroadcastOrder {
  _id: string;
  catalogItems: Array<{
    catalogItem: {_id: string; name: string; strength: string; form: string};
    name: string;
    mrp: number;
    quantity: number;
  }>;
  totalPrice: number;
  deliveryCharge: number;
  prescriptionRedactedUrl?: string;
  broadcastExpiry: string;
  secondsRemaining: number;
  createdAt: string;
}

// Per-card countdown — avoids a global interval updating all cards at once
function useCountdown(initialSeconds: number) {
  const [secs, setSecs] = useState(initialSeconds);
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSecs(initialSeconds);
    if (ref.current) clearInterval(ref.current);
    if (initialSeconds <= 0) return;

    ref.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) {
          clearInterval(ref.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [initialSeconds]);

  return secs;
}

function CountdownBadge({seconds}: {seconds: number}) {
  const live = useCountdown(seconds);
  const mins = Math.floor(live / 60);
  const secs = live % 60;
  const isUrgent = live < 120;
  const expired = live <= 0;

  return (
    <View
      style={[
        styles.countdownBadge,
        isUrgent && !expired && styles.countdownUrgent,
        expired && styles.countdownExpired,
      ]}>
      <Icon
        name={expired ? 'time-outline' : 'timer-outline'}
        size={12}
        color={
          expired ? '#9CA3AF' : isUrgent ? '#EF4444' : theme.colors.success
        }
      />
      <Text
        style={[
          styles.countdownText,
          isUrgent && !expired && styles.countdownTextUrgent,
          expired && styles.countdownTextExpired,
        ]}>
        {expired
          ? 'Expired'
          : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
      </Text>
    </View>
  );
}

export default function PharmacyBroadcastsScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const {socket, isConnected} = useSocket();

  const [broadcasts, setBroadcasts] = useState<BroadcastOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  // Socket: new broadcast → add to list
  // Order taken by another shop → remove from list
  // Order expired → remove from list
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(SocketEvent.PHARMACY_ORDER_BROADCAST, (payload: any) => {
      // Fetch fresh list to get full item details
      fetchBroadcasts(false);
      showToast({message: '💊 New pharmacy order available!', type: 'info'});
    });

    socket.on(SocketEvent.PHARMACY_ORDER_TAKEN, ({orderId}: {orderId: string}) => {
      setBroadcasts(prev => prev.filter(b => b._id !== orderId));
      showToast({message: 'Order was accepted by another pharmacy', type: 'info'});
    });

    socket.on(SocketEvent.PHARMACY_ORDER_EXPIRED, ({orderId}: {orderId: string}) => {
      setBroadcasts(prev => prev.filter(b => b._id !== orderId));
    });

    return () => {
      socket.off(SocketEvent.PHARMACY_ORDER_BROADCAST);
      socket.off(SocketEvent.PHARMACY_ORDER_TAKEN);
      socket.off(SocketEvent.PHARMACY_ORDER_EXPIRED);
    };
  }, [socket, isConnected]);

  useEffect(() => {
    fetchBroadcasts(true);
  }, []);

  const fetchBroadcasts = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const res = await axiosInstance.get('/api/pharmacy/seller/broadcasts');
      setBroadcasts(res.data.data ?? []);
    } catch {
      showToast({message: 'Could not load broadcasts', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = useCallback(
    async (orderId: string) => {
      setAccepting(orderId);
      try {
        await axiosInstance.post(`/api/pharmacy/seller/orders/${orderId}/accept`);
        setBroadcasts(prev => prev.filter(b => b._id !== orderId));
        showToast({message: '✅ Order accepted! Prepare the medicines.', type: 'success'});
        // Navigate to seller orders so they can see the confirmed order
        navigation.navigate('SellerOrders');
      } catch (err: any) {
        const msg = err?.message ?? 'Could not accept order';
        showToast({message: msg, type: 'error'});
        // Order may have been taken — refresh to get current state
        fetchBroadcasts(false);
      } finally {
        setAccepting(null);
      }
    },
    [navigation],
  );

  const renderBroadcast = ({item}: {item: BroadcastOrder}) => {
    const isAccepting = accepting === item._id;
    const hasPrescription = !!item.prescriptionRedactedUrl;

    return (
      <View style={styles.card}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>
              #{item._id.slice(-6).toUpperCase()}
            </Text>
            {hasPrescription && (
              <View style={styles.rxIndicator}>
                <Icon name="document-text" size={12} color="#6D28D9" />
                <Text style={styles.rxIndicatorText}>Has Prescription</Text>
              </View>
            )}
          </View>
          <CountdownBadge seconds={item.secondsRemaining} />
        </View>

        {/* Items */}
        <View style={styles.itemsList}>
          {item.catalogItems.map((ci, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Icon
                name="ellipse"
                size={6}
                color={theme.colors.muted}
                style={{marginTop: 5}}
              />
              <Text style={styles.itemText} numberOfLines={1}>
                {ci.name}
                <Text style={styles.itemMeta}>
                  {' '}× {ci.quantity} · ₹{ci.mrp * ci.quantity}
                </Text>
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalValue}>₹{item.totalPrice}</Text>
          </View>
          {item.deliveryCharge > 0 && (
            <Text style={styles.deliveryNote}>
              +₹{item.deliveryCharge} delivery
            </Text>
          )}
        </View>

        {/* Prescription hint */}
        {hasPrescription && (
          <View style={styles.prescriptionHint}>
            <Icon name="alert-circle-outline" size={13} color="#6D28D9" />
            <Text style={styles.prescriptionHintText}>
              Verify the prescription carefully before dispensing. Patient
              contact details are hidden.
            </Text>
          </View>
        )}

        {/* Accept CTA */}
        <TouchableOpacity
          style={[styles.acceptBtn, isAccepting && styles.acceptBtnLoading]}
          onPress={() => handleAccept(item._id)}
          disabled={isAccepting || !!accepting}
          activeOpacity={0.88}>
          {isAccepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept Order</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle}>Pharmacy Broadcasts</Text>
          {broadcasts.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{broadcasts.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => fetchBroadcasts(false)}
          style={styles.refreshBtn}>
          <Icon name="refresh-outline" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Real-time status indicator */}
      <View
        style={[
          styles.socketStatus,
          isConnected ? styles.socketConnected : styles.socketDisconnected,
        ]}>
        <View
          style={[
            styles.socketDot,
            {backgroundColor: isConnected ? '#10B981' : '#EF4444'},
          ]}
        />
        <Text style={styles.socketText}>
          {isConnected ? 'Live — new orders appear instantly' : 'Offline — pull to refresh'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Checking broadcasts…</Text>
        </View>
      ) : broadcasts.length === 0 ? (
        <View style={styles.centered}>
          <Icon name="storefront-outline" size={56} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No active broadcasts</Text>
          <Text style={styles.emptySubtext}>
            When a customer orders medicines near you, the order will appear
            here. First to accept, wins the order.
          </Text>
        </View>
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={b => b._id}
          renderItem={renderBroadcast}
          contentContainerStyle={{padding: 16, gap: 12}}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchBroadcasts(false);
              }}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {padding: 4},
  headerMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  refreshBtn: {padding: 4},
  socketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  socketConnected: {backgroundColor: '#F0FDF4'},
  socketDisconnected: {backgroundColor: '#FEF2F2'},
  socketDot: {width: 7, height: 7, borderRadius: 4},
  socketText: {fontSize: theme.fontSize.xs, color: theme.colors.textSecondary},
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {color: theme.colors.muted, marginTop: 8},
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderIdRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  orderId: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 1,
  },
  rxIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: theme.radius.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rxIndicatorText: {fontSize: 11, fontWeight: '700', color: '#6D28D9'},
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  countdownUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  countdownExpired: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
  },
  countdownText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.success,
  },
  countdownTextUrgent: {color: '#EF4444'},
  countdownTextExpired: {color: theme.colors.muted},
  itemsList: {
    gap: 6,
    marginBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8},
  itemText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
  },
  itemMeta: {fontWeight: '400', color: theme.colors.textSecondary},
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  totalLabel: {fontSize: theme.fontSize.xs, color: theme.colors.muted},
  totalValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
    color: theme.colors.text,
  },
  deliveryNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  prescriptionHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F5F3FF',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: 12,
  },
  prescriptionHintText: {
    flex: 1,
    fontSize: theme.fontSize.xs,
    color: '#5B21B6',
    lineHeight: 17,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
  },
  acceptBtnLoading: {opacity: 0.7},
  acceptBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
});
