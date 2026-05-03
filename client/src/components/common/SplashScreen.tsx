import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Dimensions, StatusBar} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';

const {width, height} = Dimensions.get('window');

// Professional Minimalist Palette
const DEEP_NAVY = '#0F172A';
const BORDER_WHITE = 'rgba(255, 255, 255, 0.15)';
const SOFT_BLUE = '#3B82F6';
const SKY_BLUE = '#60A5FA';
const ACCENT_WHITE = 'rgba(255, 255, 255, 0.6)';

const AnimatedLetter = ({letter, index}: {letter: string; index: number}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(800 + index * 100, withTiming(1, {duration: 600}));
    translateY.value = withDelay(800 + index * 100, withTiming(0, {duration: 600}));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  return <Animated.Text style={[styles.brandLetter, style]}>{letter}</Animated.Text>;
};

const GlowCircle = ({color, size, startPos, duration, delay}: {color: string; size: number; startPos: {x: number; y: number}; duration: number; delay: number}) => {
  const floatX = useSharedValue(0);
  const floatY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    floatX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(width * 0.1, {duration}),
        withTiming(-width * 0.1, {duration})
      ),
      -1,
      true
    ));
    floatY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(height * 0.05, {duration: duration * 1.5}),
        withTiming(-height * 0.05, {duration: duration * 1.5})
      ),
      -1,
      true
    ));
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, {duration: duration * 1.2}),
        withTiming(0.9, {duration: duration * 1.2})
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      {translateX: floatX.value},
      {translateY: floatY.value},
      {scale: scale.value}
    ],
  }));

  return (
    <Animated.View 
      style={[
        styles.glowCircle, 
        style, 
        {width: size, height: size, borderRadius: size / 2, backgroundColor: color, left: startPos.x, top: startPos.y}
      ]} 
    />
  );
};

export const SplashScreen = () => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, {duration: 1000});
    logoScale.value = withTiming(1, {duration: 1000});
    cardOpacity.value = withDelay(400, withTiming(1, {duration: 1000}));
    taglineOpacity.value = withDelay(1600, withTiming(1, {duration: 400}));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{scale: logoScale.value}],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background Ambience */}
      <GlowCircle color={SOFT_BLUE} size={width * 1.2} startPos={{x: -width * 0.3, y: -height * 0.1}} duration={10000} delay={0} />
      <GlowCircle color={SKY_BLUE} size={width} startPos={{x: width * 0.2, y: height * 0.3}} duration={12000} delay={1000} />
      <GlowCircle color="#fff" size={width * 0.5} startPos={{x: width * 0.3, y: height * 0.05}} duration={15000} delay={2000} />

      {/* Main Glassmorphism Card */}
      <Animated.View style={[styles.glassCard, cardStyle]}>
        <Animated.View style={[styles.logoCircle, logoStyle]}>
          <Icon name="storefront-outline" size={54} color="#fff" />
          <View style={styles.logoGlow} />
        </Animated.View>

        <View style={styles.brandRow}>
          {"VELTO".split('').map((l, i) => (
            <AnimatedLetter key={i} letter={l} index={i} />
          ))}
        </View>

        <Animated.View style={[styles.taglineWrapper, taglineStyle]}>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Local. Connected. Yours.</Text>
        </Animated.View>
      </Animated.View>

      {/* Professional Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>BENGALURU'S PREMIER LOCAL MARKETPLACE</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEEP_NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glowCircle: {
    position: 'absolute',
    opacity: 0.15,
  },
  glassCard: {
    width: width * 0.82,
    paddingVertical: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: BORDER_WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 20},
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 30,
  },
  logoGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#fff',
    opacity: 0.15,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandLetter: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  taglineWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  divider: {
    width: 32,
    height: 2,
    backgroundColor: SOFT_BLUE,
    borderRadius: 1,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT_WHITE,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
  },
  footerText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.2)',
    letterSpacing: 2,
    textAlign: 'center',
  },
});