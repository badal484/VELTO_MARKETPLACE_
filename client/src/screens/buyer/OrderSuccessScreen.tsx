import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  BackHandler,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { theme } from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from '../../mocks/reanimated';

import { useSocket } from '../../hooks/useSocket';
import { useNotifications } from '../../context/NotificationContext';
import { OrderStatus } from '@shared/types';

const ACCENT = theme.colors.accent;

const steps = [
  { icon: 'checkmark-circle', label: 'Payment Confirmed' },
  { icon: 'storefront-outline', label: 'Awaiting Seller' },
  { icon: 'cube-outline', label: 'Preparing Order' },
  { icon: 'bicycle-outline', label: 'Out for Delivery' },
];

export default function OrderSuccessScreen({ navigation, route }: any) {
  const { fetchCartCount } = useNotifications();
  const { orderId, paymentMethod, deliveryCode } = route.params || {};
  const { socket, isConnected } = useSocket();

  const [paymentConfirmed, setPaymentConfirmed] = React.useState(paymentMethod === 'Razorpay');

  const iconScale = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(30);

  useEffect(() => {
    iconScale.value = withSpring(1, { damping: 12, stiffness: 120 });
    ring1.value = withDelay(200, withTiming(1, { duration: 600 }));
    ring2.value = withDelay(400, withTiming(1, { duration: 800 }));
    contentOpacity.value = withDelay(300, withTiming(1, { duration: 500 }));
    contentY.value = withDelay(300, withTiming(0, { duration: 500 }));

    const backAction = () => {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }] });
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    fetchCartCount();
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('order_status_updated', (updatedOrder: any) => {
        if (updatedOrder._id === orderId && updatedOrder.status !== OrderStatus.PAYMENT_UNDER_REVIEW) {
          setPaymentConfirmed(true);
        }
      });
    }
    return () => { if (socket) socket.off('order_status_updated'); };
  }, [socket, isConnected, orderId]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const ring1Style = useAnimatedStyle(() => ({
    opacity: 1 - ring1.value,
    transform: [{ scale: 1 + ring1.value * 0.6 }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    opacity: (1 - ring2.value) * 0.5,
    transform: [{ scale: 1 + ring2.value * 1.1 }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  const shortId = `#${orderId?.toString().slice(-8).toUpperCase()}`;
  const isCOD = paymentMethod === 'Cash on Delivery';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ───────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.iconWrapper}>
            <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
            <Animated.View style={[styles.ring, styles.ring1, ring1Style]} />
            <Animated.View style={[styles.iconCircle, iconStyle]}>
              <Icon name="checkmark" size={44} color="#fff" />
            </Animated.View>
          </View>

          <Animated.View style={[styles.heroText, contentStyle]}>
            <Text style={styles.title}>
              {paymentConfirmed ? 'Payment Received!' : 'Order Placed!'}
            </Text>
            <Text style={styles.subtitle}>
              {paymentConfirmed
                ? 'Your payment was verified successfully. The seller will confirm your order shortly.'
                : 'Your order is awaiting seller confirmation.'}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.cardsWrapper, contentStyle]}>
          {/* ── Order ID card ──────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <Icon name="receipt-outline" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>Order ID</Text>
                <Text style={styles.cardValue}>{shortId}</Text>
              </View>
              <View style={[styles.methodBadge, isCOD && styles.codBadge]}>
                <Icon
                  name={isCOD ? 'cash-outline' : 'card-outline'}
                  size={12}
                  color={isCOD ? '#059669' : ACCENT}
                />
                <Text style={[styles.methodText, isCOD && { color: '#059669' }]}>
                  {paymentMethod || 'COD'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Order Timeline ─────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ORDER PROGRESS</Text>
            <View style={styles.timeline}>
              {steps.map((step, i) => {
                const isActive = i === 0;
                const isDone = i === 0;
                return (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        isDone && styles.timelineDotActive,
                        !isDone && !isActive && styles.timelineDotFuture,
                      ]}>
                        <Icon
                          name={isDone ? 'checkmark' : step.icon}
                          size={12}
                          color={isDone ? '#fff' : isActive ? ACCENT : theme.colors.muted}
                        />
                      </View>
                      {i < steps.length - 1 && (
                        <View style={[styles.timelineLine, i === 0 && styles.timelineLineDone]} />
                      )}
                    </View>
                    <Text style={[
                      styles.timelineLabel,
                      isDone && styles.timelineLabelActive,
                      !isDone && styles.timelineLabelFuture,
                    ]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* ── Delivery PIN card ──────────────────────────────────── */}
          <View style={[styles.card, styles.pinCard]}>
            <View style={styles.pinHeader}>
              <View style={styles.pinIconBox}>
                <Icon name="lock-closed-outline" size={16} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.pinTitle}>Delivery PIN</Text>
                <Text style={styles.pinSub}>Share only with your rider on arrival</Text>
              </View>
            </View>

            {deliveryCode ? (
              <View style={styles.pinDisplay}>
                {deliveryCode.toString().split('').map((digit: string, i: number) => (
                  <View key={i} style={styles.pinDigit}>
                    <Text style={styles.pinDigitText}>{digit}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.pinPending}>
                <Icon name="time-outline" size={22} color={theme.colors.muted} />
                <Text style={styles.pinPendingText}>Generated when rider is out for delivery</Text>
              </View>
            )}
          </View>

          {/* ── What's next ────────────────────────────────────────── */}
          <View style={[styles.card, styles.nextCard]}>
            <Icon name="information-circle-outline" size={18} color={ACCENT} />
            <Text style={styles.nextText}>
              You'll be notified once the seller confirms your order. You can track the status anytime from Order History.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Footer buttons ─────────────────────────────────────────── */}
      <Animated.View style={[styles.footer, contentStyle]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('MainTabs', {
              screen: 'ProfileTab',
              params: { screen: 'OrderHistory' },
            })
          }
        >
          <Icon name="receipt-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>View Order Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.8}
          onPress={() =>
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }],
            })
          }
        >
          <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingBottom: 16,
  },

  // ── Hero ──────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  iconWrapper: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
  },
  ring1: {
    borderColor: ACCENT + '50',
  },
  ring2: {
    borderColor: ACCENT + '25',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  heroText: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // ── Cards ─────────────────────────────────────────────────────────
  cardsWrapper: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
    letterSpacing: 1,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  codBadge: {
    backgroundColor: '#D1FAE5',
  },
  methodText: {
    fontSize: 11,
    fontWeight: '700',
    color: ACCENT,
  },

  // ── Timeline ──────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    minHeight: 40,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: ACCENT + '30',
  },
  timelineDotActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  timelineDotFuture: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    minHeight: 16,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: ACCENT + '40',
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    paddingTop: 4,
    paddingBottom: 14,
  },
  timelineLabelActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  timelineLabelFuture: {
    color: theme.colors.muted,
    fontWeight: '500',
  },

  // ── PIN card ──────────────────────────────────────────────────────
  pinCard: {
    borderWidth: 1.5,
    borderColor: ACCENT + '20',
  },
  pinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  pinIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  pinSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 1,
  },
  pinDisplay: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  pinDigit: {
    width: 52,
    height: 60,
    borderRadius: 14,
    backgroundColor: ACCENT + '0D',
    borderWidth: 1.5,
    borderColor: ACCENT + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDigitText: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0,
  },
  pinPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinPendingText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },

  // ── What's next ───────────────────────────────────────────────────
  nextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: ACCENT + '08',
    borderWidth: 1,
    borderColor: ACCENT + '18',
  },
  nextText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 10,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
});
