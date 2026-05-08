import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Dimensions, StatusBar} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Animated as RNAnimated } from 'react-native';

const {width, height} = Dimensions.get('window');

// Professional Minimalist Palette
const DEEP_NAVY = '#0F172A';
const BORDER_WHITE = 'rgba(255, 255, 255, 0.15)';
const SOFT_BLUE = '#3B82F6';
const SKY_BLUE = '#60A5FA';
const ACCENT_WHITE = 'rgba(255, 255, 255, 0.6)';

const AnimatedLetter = ({letter, index}: {letter: string; index: number}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      delay: 800 + index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.Text style={[styles.brandLetter, { opacity }]}>
      {letter}
    </Animated.Text>
  );
};

export const SplashScreen = () => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Static Background Ambience for stability */}
      <View style={[styles.glowCircle, {width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, backgroundColor: SOFT_BLUE, left: -width * 0.3, top: -height * 0.1, opacity: 0.1}]} />
      
      <Animated.View style={[styles.glassCard, { opacity: fadeAnim }]}>
        <View style={styles.logoCircle}>
          <Icon name="storefront-outline" size={54} color="#fff" />
          <View style={styles.logoGlow} />
        </View>

        <View style={styles.brandRow}>
          {"VELTO".split('').map((l, i) => (
            <AnimatedLetter key={i} letter={l} index={i} />
          ))}
        </View>

        <View style={styles.taglineWrapper}>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Local. Connected. Yours.</Text>
        </View>
      </Animated.View>

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