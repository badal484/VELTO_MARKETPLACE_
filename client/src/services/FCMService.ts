import {
  getMessaging,
  getToken,
  onMessage,
  setBackgroundMessageHandler,
  requestPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
} from '@react-native-firebase/messaging/lib/modular';
import { axiosInstance } from '../api/axiosInstance';
import { Platform } from 'react-native';

export class FCMService {
  static async registerDevice() {
    try {
      const m = getMessaging();

      const authStatus = await requestPermission(m);
      const enabled =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

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
      return onMessage(getMessaging(), async remoteMessage => {
        if (callback) callback(remoteMessage);
      });
    } catch {
      return () => {};
    }
  }

  static setBackgroundHandler() {
    try {
      setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
        console.log('🌙 Background Notification Received:', remoteMessage);
      });
    } catch {
      console.log('FCM Background Skip: Native module unavailable');
    }
  }
}
