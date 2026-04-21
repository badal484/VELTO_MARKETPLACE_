import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {theme} from '../../theme';
import Animated, {FadeIn} from 'react-native-reanimated';

export const Loader = () => (
  <View style={styles.container}>
    <Animated.View entering={FadeIn} style={styles.loaderContainer}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </Animated.View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loaderContainer: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 100,
  },
});
