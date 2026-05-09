import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Dimensions,
  ImageBackground,
} from 'react-native';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import Animated, {FadeInDown, FadeInUp} from '../../mocks/reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '../../navigation/types';
import Icon from 'react-native-vector-icons/Ionicons';

const {height, width} = Dimensions.get('window');

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
      
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1000' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlayTop} />
        <View style={styles.overlayBottom} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <Animated.View
              entering={FadeInDown.delay(200).duration(1000)}
              style={styles.headerContainer}>
              <View style={styles.logoBadge}>
                <Text style={styles.brandTitle}>VELTO</Text>
                <View style={styles.accentDot} />
              </View>
              <Text style={styles.heroTitle}>
                The Soul of{'\n'}Local Shopping
              </Text>
              <View style={styles.titleUnderline} />
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(600).duration(1000)}
              style={styles.footer}>
              
              <View style={styles.infoCard}>
                <Text style={styles.description}>
                  Join thousands discovering unique treasures from India's finest 
                  local merchants. Experience commerce, redefined.
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                <Button
                  title="Register Now"
                  type="accent"
                  size="lg"
                  style={styles.primaryButton}
                  textStyle={styles.primaryButtonText}
                  icon={<Icon name="person-add-outline" size={20} color="#fff" />}
                  onPress={() => navigation.navigate('Register')}
                />
                <Button
                  title="Sign In"
                  type="outline"
                  size="lg"
                  style={styles.outlineButton}
                  textStyle={styles.outlineButtonText}
                  onPress={() => navigation.navigate('Login')}
                />
              </View>

              <View style={styles.trustBadge}>
                <Icon name="shield-checkmark" size={14} color="rgba(255,255,255,0.4)" />
                <Text style={styles.poweredText}>
                  Safe • Reliable • Nationwide
                </Text>
              </View>
            </Animated.View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1128',
  },
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  overlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 10, 25, 0.25)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.75,
    backgroundColor: 'rgba(5, 10, 25, 0.82)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: height * 0.08,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'flex-start',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 4,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
    marginLeft: 4,
  },
  heroTitle: {
    fontSize: 46,
    fontWeight: '800',
    color: theme.colors.white,
    marginTop: 20,
    lineHeight: 54,
    letterSpacing: -1.5,
  },
  titleUnderline: {
    width: 50,
    height: 4,
    backgroundColor: theme.colors.accent,
    marginTop: 12,
    borderRadius: 2,
  },
  footer: {
    width: '100%',
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 32,
  },
  description: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 26,
    fontWeight: '500',
    textAlign: 'left',
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginRight: 8,
  },
  outlineButton: {
    height: 64,
    borderRadius: 20,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    color: theme.colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 6,
  },
  poweredText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});
