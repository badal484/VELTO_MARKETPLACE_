import React, { useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

interface SkeletonProps {
  width: any;
  height: any;
  borderRadius?: number;
  style?: any;
}

export const Skeleton = ({ width, height, borderRadius = 8, style }: SkeletonProps) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E2E8F0',
          opacity,
        },
        style,
      ]}
    />
  );
};

export const CardSkeleton = () => (
  <View style={styles.cardSkeleton}>
    <Skeleton width={130} height={130} borderRadius={20} />
    <View style={{ flex: 1, padding: 12, gap: 10 }}>
      <Skeleton width="40%" height={10} />
      <Skeleton width="90%" height={16} />
      <Skeleton width="60%" height={20} style={{ marginTop: 10 }} />
      <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
    </View>
  </View>
);

export const ProductGridSkeleton = () => (
  <View style={styles.gridContainer}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={styles.gridItem}>
        <Skeleton width="100%" height={180} borderRadius={20} />
        <Skeleton width="80%" height={14} style={{ marginTop: 12 }} />
        <Skeleton width="50%" height={14} style={{ marginTop: 8 }} />
      </View>
    ))}
  </View>
);

export const ShopListSkeleton = () => (
  <View style={{ padding: 16, gap: 16 }}>
    {[1, 2, 3, 4].map((i) => (
      <View key={i} style={[styles.cardSkeleton, { padding: 16, flexDirection: 'column' }]}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={52} height={52} borderRadius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={10} />
          </View>
        </View>
        <View style={{ marginTop: 16, height: 1, backgroundColor: '#F1F5F9' }} />
        <View style={{ flexDirection: 'row', gap: 20, marginTop: 12 }}>
          <Skeleton width={60} height={12} />
          <Skeleton width={60} height={12} />
        </View>
      </View>
    ))}
  </View>
);

export const ProductDetailSkeleton = () => (
  <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <Skeleton width="100%" height={width * 1.2} borderRadius={0} />
    <View style={{ padding: 24, marginTop: -30, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
       <Skeleton width={100} height={24} borderRadius={8} />
       <Skeleton width="80%" height={32} style={{ marginTop: 20 }} />
       <Skeleton width="40%" height={24} style={{ marginTop: 16 }} />
       <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 }} />
       <Skeleton width="100%" height={100} borderRadius={16} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  cardSkeleton: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
  },
  gridItem: {
    width: (width - 48) / 2,
    marginBottom: 8,
  },
});
