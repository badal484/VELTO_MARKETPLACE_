import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming,
  interpolateColor,
  Layout
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../../theme';
import { OrderStatus } from '@shared/types';

const { width } = Dimensions.get('window');

interface Milestone {
  key: string;
  label: string;
  icon: string;
  statuses: OrderStatus[];
}

interface OrderProgressStepperProps {
  status: OrderStatus;
  fulfillmentMethod: 'delivery' | 'pickup';
}

const OrderProgressStepper: React.FC<OrderProgressStepperProps> = ({ status, fulfillmentMethod }) => {
  const progress = useSharedValue(0);

  const deliveryMilestones: Milestone[] = [
    { key: 'placed', label: 'Ordered', icon: 'cart-outline', statuses: [OrderStatus.PENDING, OrderStatus.PAYMENT_UNDER_REVIEW] },
    { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline', statuses: [OrderStatus.CONFIRMED] },
    { key: 'processing', label: 'Processing', icon: 'cube-outline', statuses: [OrderStatus.READY_FOR_PICKUP, OrderStatus.SEARCHING_RIDER, OrderStatus.RIDER_ASSIGNED] },
    { key: 'transit', label: 'In Transit', icon: 'bicycle-outline', statuses: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
    { key: 'delivered', label: 'Delivered', icon: 'home-outline', statuses: [OrderStatus.DELIVERED, OrderStatus.COMPLETED] },
  ];

  const pickupMilestones: Milestone[] = [
    { key: 'placed', label: 'Ordered', icon: 'cart-outline', statuses: [OrderStatus.PENDING, OrderStatus.PAYMENT_UNDER_REVIEW] },
    { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline', statuses: [OrderStatus.CONFIRMED] },
    { key: 'ready', label: 'Packed', icon: 'cube-outline', statuses: [OrderStatus.READY_FOR_PICKUP] },
    { key: 'completed', label: 'Picked Up', icon: 'hand-left-outline', statuses: [OrderStatus.COMPLETED] },
  ];

  const milestones = fulfillmentMethod === 'delivery' ? deliveryMilestones : pickupMilestones;
  
  // Calculate current active index
  const activeIndex = milestones.findIndex(m => m.statuses.includes(status));
  const effectiveIndex = activeIndex === -1 ? (status === OrderStatus.CANCELLED ? -1 : milestones.length - 1) : activeIndex;

  useEffect(() => {
    progress.value = withSpring(effectiveIndex / (milestones.length - 1), { damping: 15 });
  }, [effectiveIndex, milestones.length]);

  const progressLineStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
      backgroundColor: theme.colors.primary,
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.stepperWrapper}>
        {/* Background Line */}
        <View style={styles.backgroundLine} />
        
        {/* Animated Progress Line */}
        <Animated.View style={[styles.progressLine, progressLineStyle]} />

        {/* Milestone Dots */}
        <View style={styles.milestonesContainer}>
          {milestones.map((milestone, index) => {
            const isActive = index <= effectiveIndex;
            const isCurrent = index === effectiveIndex;

            return (
              <View key={milestone.key} style={styles.milestoneItem}>
                <Animated.View 
                  layout={Layout.springify()}
                  style={[
                    styles.dotContainer,
                    isActive ? styles.dotActive : styles.dotInactive,
                    isCurrent && styles.dotCurrent
                  ]}>
                  <Icon 
                    name={milestone.icon} 
                    size={14} 
                    color={isActive ? theme.colors.white : theme.colors.muted} 
                  />
                </Animated.View>
                <Text style={[
                  styles.milestoneLabel,
                  isActive ? styles.labelActive : styles.labelInactive
                ]}>
                  {milestone.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
  },
  stepperWrapper: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 10,
  },
  backgroundLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#F1F5F9', // Lighter for better contrast
    left: 10,
    right: 10,
    top: 22,
    borderRadius: 2,
  },
  progressLine: {
    position: 'absolute',
    height: 2,
    left: 10,
    top: 22,
    borderRadius: 2,
    zIndex: 1,
  },
  milestonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  milestoneItem: {
    alignItems: 'center',
    width: 60,
  },
  dotContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dotActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    ...theme.shadow.sm,
  },
  dotInactive: {
    backgroundColor: theme.colors.white,
    borderColor: '#E2E8F0',
  },
  dotCurrent: {
    transform: [{ scale: 1.2 }],
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    ...theme.shadow.md,
  },
  milestoneLabel: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelActive: {
    color: '#0F172A',
  },
  labelInactive: {
    color: '#94A3B8',
  },
});

export default OrderProgressStepper;