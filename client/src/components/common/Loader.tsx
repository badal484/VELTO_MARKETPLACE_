import React, {useEffect, useRef} from 'react';
import {View, ActivityIndicator, StyleSheet, Animated} from 'react-native';
import {theme} from '../../theme';

export const Loader = ({ fullScreen }: { fullScreen?: boolean; size?: string } = {}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <Animated.View style={[styles.loaderContainer, { opacity: fadeAnim }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  loaderContainer: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 100,
  },
});
