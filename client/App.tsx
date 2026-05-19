import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import './src/i18n';
import {StatusBar, ActivityIndicator, View, StyleSheet} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/context/AuthContext';
import {SocketProvider} from './src/context/SocketContext';
import {NotificationProvider} from './src/context/NotificationContext';
import {ToastProvider} from './src/context/ToastContext';
import {AuthNavigator} from './src/navigation/AuthNavigator';
import {MainNavigator} from './src/navigation/MainNavigator';
import {useAuth} from './src/hooks/useAuth';
import {theme} from './src/theme';
import {SplashScreenV2} from './src/components/common/SplashScreenV2';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {navigationRef} from './src/navigation/navigationRef';
import {handleNotificationData} from './src/services/notificationNavigator';
import notifee, {EventType} from '@notifee/react-native';

// Lazily import firebase/messaging so it doesn't crash if native module isn't available
const getFirebaseMessaging = () => {
  try {
    const { getMessaging } = require('@react-native-firebase/messaging');
    const { getApp, getApps } = require('@react-native-firebase/app');
    if (!getApps().length) return null;
    return getMessaging(getApp());
  } catch {
    return null;
  }
};

const NavigationWrapper = () => {
  const {user, isLoading} = useAuth();
  const [isSplashVisible, setIsSplashVisible] = React.useState(true);

  useEffect(() => {
    // Minimum splash duration for branding (5.0s)
    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // ── Notification tap handlers ─────────────────────────────────────
  // Set up once on mount regardless of login state.
  useEffect(() => {
    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const { onNotificationOpenedApp } = require('@react-native-firebase/messaging');

    // 1. Background state tap: app was backgrounded, user taps notification
    const unsubBg = onNotificationOpenedApp(messaging, (remoteMessage: any) => {
      if (remoteMessage?.data) {
        handleNotificationData(remoteMessage.data as Record<string, string>);
      }
    });

    // 2. Foreground tap: user presses a notifee banner while app is open
    const unsubFg = notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS && detail.notification?.data) {
        handleNotificationData(detail.notification.data as Record<string, string>);
      }
    });

    return () => {
      unsubBg();
      unsubFg();
    };
  }, []);

  // ── Killed state: handle when app was opened from a tapped notification ──
  const handleNavigatorReady = async () => {
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return;
      const { getInitialNotification } = require('@react-native-firebase/messaging');
      const remoteMessage = await getInitialNotification(messaging);
      if (remoteMessage?.data) {
        handleNotificationData(remoteMessage.data as Record<string, string>);
      }
    } catch {}
  };

  return (
    <View style={{flex: 1}}>
      {/*
        Background Loading: We render the NavigationContainer as soon as isLoading is false.
        While isSplashVisible is true, the user sees the splash screen, but the
        navigator (and its screens) are already mounting and fetching data.
      */}
      {!isLoading && (
        <NavigationContainer ref={navigationRef} onReady={handleNavigatorReady}>
          {user ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      )}

      {(isLoading || isSplashVisible) && (
        <View style={StyleSheet.absoluteFill}>
          <SplashScreenV2 />
        </View>
      )}
    </View>
  );
};

import {Toast} from './src/components/common/Toast';

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <NavigationWrapper />
              <Toast />
            </ToastProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default App;
