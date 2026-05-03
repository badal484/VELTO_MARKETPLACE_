import React, {useEffect} from 'react';
import {View, Text, StyleSheet, Image, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import {theme} from '../../theme';

const {width, height} = Dimensions.get('window');

// Gemini AI Palette
const GEMINI_BLUE = '#4285F4';
const GEMINI_CYAN = '#4DB6E1';
const GEMINI_PURPLE = '#9B72CB';
const GEMINI_PINK = '#D96570';

const FloatingGraphic = ({delay, color, size, startPos}: {delay: number; color: string; size: number; startPos: {x: number; y: number}}) => {
  const floatY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.1, {duration: 1000}));
    floatY.value = withRepeat(
      withSequence(
        withTiming(-40, {duration: 4000 + Math.random() * 2000}),
        withTiming(40, {duration: 4000 + Math.random() * 2000})
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: floatY.value}],
  }));

  return (
    <Animated.View 
      style={[
        styles.graphic, 
        style, 
        {width: size, height: size, left: startPos.x, top: startPos.y, backgroundColor: color}
      ]} 
    />
  );
};

const AISparkle = ({delay, position}: {delay: number; position: {x: number; y: number}}) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, {duration: 800}),
        withTiming(0, {duration: 800})
      ),
      -1,
      false
    ));
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.8, {duration: 800}),
        withTiming(0, {duration: 800})
      ),
      -1,
      false
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{scale: scale.value}],
  }));

  return (
    <Animated.View style={[styles.sparkle, style, {left: position.x, top: position.y}]} />
  );
};

const AnimatedLetter = ({letter, index, delayBase, duration = 600, targetY = 0}: {letter: string; index: number; delayBase: number; duration?: number; targetY?: number}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  useEffect(() => {
    opacity.value = withDelay(delayBase + index * 80, withTiming(1, {duration}));
    translateY.value = withDelay(
      delayBase + index * 80,
      withTiming(targetY, {duration})
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{translateY: translateY.value}],
  }));

  return (
    <Animated.Text style={[styles.letter, animatedStyle]}>
      {letter}
    </Animated.Text>
  );
};

export const SplashScreen = () => {
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(0);
  const colorProgress = useSharedValue(0);
  const loadingProgress = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(20);

  const brandName = "VELTO";

  useEffect(() => {
    // 1. Entrance (0.0s – 1.2s)
    logoScale.value = withTiming(1, {duration: 1200});
    logoRotate.value = withRepeat(
      withTiming(360, {duration: 8000}),
      -1,
      false
    );

    // 2. Color Cycling
    colorProgress.value = withRepeat(
      withTiming(1, {duration: 4000}),
      -1,
      true
    );

    // 3. Tagline (2.0s – 3.0s)
    taglineOpacity.value = withDelay(2000, withTiming(1, {duration: 1000}));
    taglineTranslateY.value = withDelay(2000, withTiming(0, {duration: 1000}));

    // 4. Loading Progress (2.0s – 5.0s)
    loadingProgress.value = withDelay(2000, withTiming(1, {duration: 3000}));
  }, []);

  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [
      {scale: logoScale.value},
      {rotate: `${logoRotate.value}deg`}
    ],
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 0.33, 0.66, 1],
      [GEMINI_BLUE, GEMINI_CYAN, GEMINI_PURPLE, GEMINI_PINK]
    ),
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      [GEMINI_BLUE, GEMINI_PURPLE, GEMINI_PINK]
    ),
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{translateY: taglineTranslateY.value}],
  }));

  const loadingStyle = useAnimatedStyle(() => ({
    width: `${loadingProgress.value * 100}%`,
    backgroundColor: interpolateColor(
      colorProgress.value,
      [0, 1],
      [GEMINI_BLUE, GEMINI_PURPLE]
    ),
  }));

  return (
    <View style={styles.container}>
      {/* Dynamic Background */}
      <FloatingGraphic delay={0} color={GEMINI_BLUE} size={300} startPos={{x: -150, y: 100}} />
      <FloatingGraphic delay={1000} color={GEMINI_PURPLE} size={250} startPos={{x: width - 100, y: height - 400}} />
      
      {/* AI Sparkles */}
      <AISparkle delay={0} position={{x: width/2 - 120, y: height/2 - 150}} />
      <AISparkle delay={400} position={{x: width/2 + 100, y: height/2 - 100}} />
      <AISparkle delay={800} position={{x: width/2 - 80, y: height/2 + 120}} />

      {/* Centerpiece: Gemini-V */}
      <View style={styles.centerContainer}>
        <Animated.View style={[styles.outerGlow, outerGlowStyle]} />
        <Animated.View style={[styles.geminiLogoContainer, logoContainerStyle]}>
          <Text style={styles.logoTextV}>V</Text>
        </Animated.View>
      </View>
      
      {/* Brand & Tagline */}
      <View style={styles.textContainer}>
        <View style={styles.brandRow}>
          {brandName.split('').map((char, index) => (
            <AnimatedLetter 
              key={index} 
              letter={char} 
              index={index} 
              delayBase={1000} // (Starts at 1.0s)
              duration={600} // (Finishes at 1.6s - 2.0s staggered)
            />
          ))}
        </View>
        
        {/* Tagline removed as requested */}
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.loadingBar}>
          <Animated.View style={[styles.loadingProgress, loadingStyle]} />
        </View>
        <Text style={styles.footerText}>Next-Gen Intelligence</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphic: {
    position: 'absolute',
    borderRadius: 200,
  },
  sparkle: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  outerGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.15,
  },
  geminiLogoContainer: {
    width: width * 0.48,
    height: width * 0.48,
    borderRadius: width * 0.24,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoTextV: {
    fontSize: 130,
    fontWeight: '900',
    color: '#fff',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  letter: {
    fontSize: 60,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  taglineRow: {
    marginTop: 10,
  },
  subtitle: {
    fontSize: 14,
    color: GEMINI_CYAN,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    width: '100%',
  },
  loadingBar: {
    width: width * 0.6,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    borderRadius: 1,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});