import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '../../navigation/types';

const {height} = Dimensions.get('window');

type WelcomeScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'Welcome'
>;

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

export default function WelcomeScreen({navigation}: WelcomeScreenProps) {
  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      {/* Background with a sophisticated gradient-like feel using multiple layers */}
      <View
        style={[styles.background, {backgroundColor: theme.colors.primary}]}>
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />

        <SafeAreaView style={styles.content}>
          <Animated.View
            entering={FadeInDown.delay(200).duration(1000)}
            style={styles.headerContainer}>
            <Text style={styles.brandTitle}>VELTO</Text>
            <View style={styles.accentBar} />
            <Text style={styles.tagline}>
              The Future of{'\n'}Local Commerce
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(600).duration(1000)}
            style={styles.footer}>
            <Text style={styles.description}>
              Discover unique finds from vibrant local merchants across India.
              Nationwide reach, community-driven quality.
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                title="Create Account"
                type="accent"
                size="lg"
                onPress={() => navigation.navigate('Register')}
              />
              <Button
                title="Sign In"
                type="outline"
                size="lg"
                style={styles.outlineButton}
                textStyle={{color: theme.colors.white}}
                onPress={() => navigation.navigate('Login')}
              />
            </View>

            <View style={styles.poweredBy}>
              <Text style={styles.poweredText}>
                Empowering India's Local Economy
              </Text>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: 200,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerContainer: {
    marginTop: height * 0.1,
  },
  brandTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 8,
    textAlign: 'left',
  },
  accentBar: {
    width: 50,
    height: 6,
    backgroundColor: theme.colors.white,
    marginTop: 12,
    borderRadius: 3,
  },

  tagline: {
    fontSize: 34,
    fontWeight: '800',
    color: theme.colors.white,
    marginTop: 32,
    lineHeight: 44,
  },
  footer: {
    marginBottom: 40,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 24,
    marginBottom: 32,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
  },
  outlineButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
  },
  poweredBy: {
    alignItems: 'center',
    marginTop: 40,
  },
  poweredText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
