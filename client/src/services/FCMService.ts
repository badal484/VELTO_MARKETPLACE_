import {
  getMessaging,
  getToken,
  onMessage,
  setBackgroundMessageHandler,
  requestPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { axiosInstance } from '../api/axiosInstance';
import { Platform, PermissionsAndroid } from 'react-native';
import { getApps, getApp } from '@react-native-firebase/app';

export class FCMService {
  static async registerDevice() {
    try {
      console.log('📡 [DEBUG] FCMService: Attempting to register device...');
      const apps = getApps();
      if (!apps.length) {
        console.log('⚠️ [DEBUG] FCM Service Skip: Firebase app not initialized yet.');
        return;
      }
      console.log('🔗 [DEBUG] FCM Service: Using app:', apps[0].name);
      const m = getMessaging(getApp());
      
      let enabled = false;

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS'
        );
        enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const authStatus = await requestPermission(m);
        enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
      }

      if (enabled) {
        console.log('🔔 Notification permission granted.');

        if (Platform.OS === 'ios') {
          await registerDeviceForRemoteMessages(m);
        }

        const token = await getToken(m);
        if (token) {
          await FCMService.updateTokenOnServer(token);
        }
      }
    } catch (error) {
      console.log('FCM Service Skip:', error);
    }
  }

  private static async updateTokenOnServer(token: string) {
    try {
      await axiosInstance.post('/api/notifications/fcm-token', { token });
      console.log('✅ FCM Token synced with server.');
    } catch {
      console.warn('❌ Failed to sync FCM token (User might be logged out or Offline)');
    }
  }

  static listenForMessages(callback: (message: any) => void) {
    try {
      if (!getApps().length) return () => {};
      return onMessage(getMessaging(getApp()), async remoteMessage => {
        if (callback) callback(remoteMessage);
      });
    } catch {
      return () => {};
    }
  }

  static setBackgroundHandler() {
    try {
      setBackgroundMessageHandler(getMessaging(getApp()), async remoteMessage => {
        console.log('🌙 Background Notification Received:', remoteMessage);
      });
    } catch {
      console.log('FCM Background Skip: Native module unavailable');
    }
  }
}
