import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, Dimensions, StatusBar, Animated, Easing} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const {width, height} = Dimensions.get('window');

export const SplashScreenV2 = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;

  // Particle animations using standard Animated
  const particles = useRef([...Array(15)].map(() => ({
    x: Math.random() * width,
    y: Math.random() * height,
    anim: new Animated.Value(0),
    delay: Math.random() * 2000
  }))).current;

  useEffect(() => {
    // Main Logo Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Text Animation
    Animated.timing(textFadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 500,
      useNativeDriver: true,
    }).start();

    // Loader Animation
    Animated.timing(loaderAnim, {
      toValue: 1,
      duration: 4000,
      easing: Easing.linear,
      useNativeDriver: false, // Width cannot be animated with native driver
    }).start();

    // Particle Loops
    particles.forEach((p) => {
      const runAnimation = () => {
        p.anim.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, {
            toValue: 1,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          })
        ]).start(() => runAnimation());
      };
      runAnimation();
    });
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Background Ambience (Particles) */}
      <View style={styles.ambienceContainer}>
        {particles.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: p.x,
                top: p.y,
                opacity: p.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0],
                }),
                transform: [{
                  translateY: p.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -100],
                  })
                }]
              }
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Animated.View style={[
          styles.logoContainer,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}>
          <View style={styles.logoCircle}>
            <Icon name="cube-outline" size={60} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[
          styles.textContainer,
          { opacity: textFadeAnim, transform: [{ translateY: textFadeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          }) }] }
        ]}>
          <Text style={styles.brandName}>VELTO</Text>
          <Text style={styles.tagline}>PREMIUM MARKETPLACE</Text>
        </Animated.View>

        {/* Minimalist Loader */}
        <View style={styles.loaderContainer}>
          <Animated.View
            style={[
              styles.loaderBar,
              {
                width: loaderAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambienceContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 4,
    marginTop: 8,
    fontWeight: '600',
  },
  loaderContainer: {
    marginTop: 60,
    height: 2,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  loaderBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
});
