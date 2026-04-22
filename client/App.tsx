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
import {SplashScreen} from './src/components/common/SplashScreen';

const NavigationWrapper = () => {
  const {user, isLoading} = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <NavigationWrapper />
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
