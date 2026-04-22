import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  BackHandler,
} from 'react-native';
import {theme} from '../../theme';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {axiosInstance} from '../../api/axiosInstance';
import {useSocket} from '../../hooks/useSocket';
import {Linking} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';

export default function OrderSuccessScreen({navigation, route}: any) {
  const {orderId, paymentMethod} = route.params || {};
  const {socket, isConnected} = useSocket();
  
  const [paymentConfirmed, setPaymentConfirmed] = React.useState(false);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1.2, {damping: 10, stiffness: 100}, () => {
      scale.value = withSpring(1);
    });
    opacity.value = withTiming(1, {duration: 800});

    // Prevent going back to checkout
    const backAction = () => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }],
      });
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    if (paymentMethod === 'Razorpay') {
      checkInitialStatus();
    }

    return () => backHandler.remove();
  }, []);

  const checkInitialStatus = async () => {
    try {
      const res = await axiosInstance.get(`/api/orders/${orderId}`);
      if (res.data.success && res.data.data.status === 'confirmed') {
        setPaymentConfirmed(true);
      }
    } catch (err) {
      // Failed to check initial status
    }

  };

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('order_status_updated', (updatedOrder: any) => {
        if (updatedOrder._id === orderId && updatedOrder.status === 'confirmed') {
          setPaymentConfirmed(true);
        }
      });
    }
    return () => {
      if (socket) socket.off('order_status_updated');
    };
  }, [socket, isConnected, orderId]);



  const handlePayNow = async () => {
    try {
      const res = await axiosInstance.get(`/api/orders/${orderId}`);
      const order = res.data.data;
      
      const options = {
        description: 'Payment for Velto Order',
        image: 'https://ik.imagekit.io/oellcbqek/velto_logo.png',
        currency: 'INR',
        key: 'rzp_test_SdCBOGIizlvuxK',
        amount: Math.round(order.totalPrice * 100),
        name: 'Velto Marketplace',
        order_id: order.razorpayOrderId,
        prefill: {
          email: 'customer@example.com',
          contact: order.buyerPhone,
          name: 'Velto Customer'
        },
        theme: {color: theme.colors.primary}
      };

      RazorpayCheckout.open(options).then(async (data: any) => {
        await axiosInstance.post('/api/payments/verify', {
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature
        });
        setPaymentConfirmed(true);
      }).catch((e: any) => {
        // Payment retry failed or cancelled
      });

    } catch (err) {
      // Retry payment initialization failed
    }

  };

  const animatedCircle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  const animatedContent = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: withTiming(opacity.value ? 0 : 20, {duration: 1000})}],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.content}>
        <Animated.View style={[styles.successIconBox, animatedCircle]}>
          <View style={styles.innerCircle}>
            <Icon name="checkmark" size={60} color={theme.colors.white} />
          </View>
        </Animated.View>


        <Animated.View style={[styles.textBox, animatedContent]}>
          <Text style={styles.title}>{paymentConfirmed ? 'Payment Received!' : 'All Set!'}</Text>
          <Text style={styles.subtitle}>
            {paymentConfirmed 
              ? 'Your payment has been verified. Your order is now being processed.' 
              : 'Your order has been placed successfully.'}
          </Text>
          
          <View style={styles.orderLabel}>
            <Text style={styles.orderIdTitle}>ORDER ID</Text>
            <Text style={styles.orderIdValue}>#{orderId?.toString().slice(-8).toUpperCase()}</Text>
          </View>

          {/* Verification Code Display */}
          <View style={styles.codeContainer}>
             {paymentMethod === 'Razorpay' && !paymentConfirmed && (
               <View style={[styles.codeBox, {borderStyle: 'solid', borderColor: theme.colors.primary}]}>
                  <Text style={styles.codeTitle}>PAYMENT ACTION REQUIRED</Text>
                  <Icon name="card-outline" size={40} color={theme.colors.primary} style={{marginVertical: 10}} />
                  <Text style={styles.codeInfo}>Please complete the secure Razorpay checkout to start processing your order.</Text>
               </View>
             )}

              {(route.params?.fulfillmentMethod === 'delivery' && (paymentMethod !== 'Razorpay' || paymentConfirmed)) && (
                <View style={styles.codeBox}>
                   <Text style={styles.codeTitle}>HOME DELIVERY PIN</Text>
                   {route.params?.deliveryCode ? (
                     <Text style={styles.codeValue}>{route.params?.deliveryCode}</Text>
                   ) : (
                     <View style={styles.pendingPinBox}>
                       <Icon name="time-outline" size={32} color={theme.colors.primary} />
                       <Text style={styles.pendingPinText}>Will be generated when out for delivery</Text>
                     </View>
                   )}
                   <Text style={styles.codeInfo}>Share this with the rider when they arrive</Text>
                </View>
              )}
              {(route.params?.fulfillmentMethod === 'pickup' && (paymentMethod !== 'Razorpay' || paymentConfirmed)) && (
                <View style={styles.codeBox}>
                   <Text style={styles.codeTitle}>STORE PICKUP PIN</Text>
                   {route.params?.pickupCode ? (
                     <Text style={styles.codeValue}>{route.params?.pickupCode}</Text>
                   ) : (
                     <View style={styles.pendingPinBox}>
                       <Icon name="time-outline" size={32} color={theme.colors.primary} />
                       <Text style={styles.pendingPinText}>Will be generated when ready for pickup</Text>
                     </View>
                   )}
                   <Text style={styles.codeInfo}>Provide this to the shop owner at pickup</Text>
                </View>
              )}
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {paymentMethod === 'Razorpay' && !paymentConfirmed && (
           <Button
             title="Complete Razorpay Payment"
             type="primary"
             style={{...styles.btn, backgroundColor: '#4F46E5'}}
             onPress={handlePayNow}
             leftIcon={<Icon name="shield-checkmark-outline" size={20} color="white" style={{marginRight: 8}} />}
           />
        )}
        <Button
          title={paymentConfirmed ? "View Order Status" : "Track Order"}
          type="primary"
          style={styles.btn}
          onPress={() => navigation.navigate('MainTabs', { screen: 'ProfileTab', params: { screen: 'OrderHistory' } })}
        />
        <Button
          title="Continue Shopping"
          type="outline"
          style={{...styles.btn, ...styles.outlineBtn}}
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }],
          })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  innerCircle: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadow.md,
  },

  textBox: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 12,
  },
  pendingPinBox: {
    marginVertical: 15,
    alignItems: 'center',
    gap: 8,
  },
  pendingPinText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    opacity: 0.8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  orderLabel: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderIdTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  orderIdValue: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  codeContainer: {
    marginTop: 40,
    width: '100%',
  },
  codeBox: {
    backgroundColor: theme.colors.primary + '08',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary + '20',
    borderStyle: 'dashed',
  },
  codeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 10,
    marginBottom: 12,
  },
  pendingPinBox: {
    marginVertical: 15,
    alignItems: 'center',
    gap: 8,
  },
  pendingPinText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    opacity: 0.8,
  },
  codeInfo: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  btn: {
    width: '100%',
    borderRadius: 16,
    height: 56,
  },
  outlineBtn: {
      borderWidth: 2,
  }
});