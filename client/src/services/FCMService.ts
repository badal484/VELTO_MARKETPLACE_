import {
  getMessaging,
  getToken,
  onMessage,
  setBackgroundMessageHandler,
  requestPermission,
  registerDeviceForRemoteMessages,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
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

        // Create the default channel for Android
        if (Platform.OS === 'android') {
          await notifee.createChannel({
            id: 'default',
            name: 'Default Channel',
            importance: AndroidImportance.HIGH,
          });
        }

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

  static async displayNotification(title: string, body: string, data: any = {}) {
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
      data,
    });
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
        console.log('📱 Foreground Notification:', remoteMessage);
        
        // Show system tray notification even in foreground
        if (remoteMessage.notification) {
          await FCMService.displayNotification(
            remoteMessage.notification.title || 'New Notification',
            remoteMessage.notification.body || '',
            remoteMessage.data
          );
        }

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
        
        // Android handles 'notification' messages automatically in background,
        // but we can manually handle 'data' only messages here if needed.
        if (!remoteMessage.notification && remoteMessage.data) {
           // example for manual trigger if needed:
           // await FCMService.displayNotification(remoteMessage.data.title, remoteMessage.data.body);
        }
      });
    } catch {
      console.log('FCM Background Skip: Native module unavailable');
    }
  }
}
