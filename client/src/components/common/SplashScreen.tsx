import React, {useEffect} from 'react';
import {View, StyleSheet, Text, Image, Modal} from 'react-native';
import {theme} from '../../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';

export const SplashScreen = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, {duration: 1000}),
        withTiming(1, {duration: 1000}),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, {duration: 1000}),
        withTiming(0.7, {duration: 1000}),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandWrapper, animatedStyle]}>
        <Image
          source={require('../../../assets/velto_logo.png')}
          style={styles.logo}
        />
        <Text style={styles.text}>VELTO</Text>
        <View style={styles.line} />
        <Text style={styles.tagline}>Local Market</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Clean startup white
  },
  brandWrapper: {
    alignItems: 'center',
  },
  logo: {
    width: 220, // High impact size
    height: 220,
    borderRadius: 50,
    marginBottom: 30,
  },
  text: {
    fontSize: 48, // Massive typography
    fontWeight: '900',
    color: '#1E40AF',
    letterSpacing: 4,
  },
  line: {
    width: 140,
    height: 5,
    backgroundColor: '#1E40AF',
    marginVertical: 12,
    borderRadius: 10,
    opacity: 0.9,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.muted,
    letterSpacing: 10,
    textTransform: 'uppercase',
    marginTop: 10,
  },
});