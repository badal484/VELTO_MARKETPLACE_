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

const NavigationWrapper = () => {
  const {user, isLoading} = useAuth();
  const [isSplashVisible, setIsSplashVisible] = React.useState(true);

  useEffect(() => {
    // Force splash screen to stay for exactly 5 seconds
    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading || isSplashVisible) {
    return <SplashScreenV2 />;
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
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
