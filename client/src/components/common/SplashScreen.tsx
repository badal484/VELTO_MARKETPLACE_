import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Image, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {theme} from '../../theme';

const {width} = Dimensions.get('window');

export const SplashScreen = () => {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    // Initial entrance animation
    scale.value = withSpring(1, {damping: 15, stiffness: 100});
    opacity.value = withTiming(1, {duration: 800});
    
    // Delayed text appearance
    textOpacity.value = withTiming(1, {
      duration: 1200,
      easing: Easing.out(Easing.exp),
    });
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: opacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{translateY: withTiming(textOpacity.value === 1 ? 0 : 20, {duration: 1000})}],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={require('../../../assets/velto_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text style={styles.title}>VELTO</Text>
        <View style={styles.separator} />
        <Text style={styles.subtitle}>Hyper-Local Marketplace</Text>
      </Animated.View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ for Karnataka</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: width * 0.35,
    height: width * 0.35,
    marginBottom: 32,
    borderRadius: 24,
    backgroundColor: '#fff',
    ...theme.shadow.lg,
    padding: 2,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 8,
    includeFontPadding: false,
  },
  separator: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
    marginVertical: 12,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 60,
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '700',
    letterSpacing: 1,
  },
});