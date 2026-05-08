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
      console.log('FCMService: Registering device...');
      const apps = getApps();
      if (!apps.length) {
        console.log('FCM Service: Firebase app not initialized yet, skipping.');
        return;
      }

      const m = getMessaging(getApp());

      let enabled = false;

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS',
        );
        enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const authStatus = await requestPermission(m);
        enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
      }

      if (enabled) {
        console.log('Notification permission granted.');

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

  static async displayNotification(
    title: string,
    body: string,
    data: any = {},
  ) {
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
      console.log('FCM Token synced with server.');
    } catch {
      console.warn(
        'Failed to sync FCM token (User might be logged out or Offline)',
      );
    }
  }

  static listenForMessages(callback: (message: any) => void) {
    try {
      if (!getApps().length) return () => {};
      return onMessage(getMessaging(getApp()), async remoteMessage => {
        console.log('Foreground Notification:', remoteMessage);

        if (remoteMessage.notification) {
          await FCMService.displayNotification(
            remoteMessage.notification.title || 'New Notification',
            remoteMessage.notification.body || '',
            remoteMessage.data,
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
      setBackgroundMessageHandler(
        getMessaging(getApp()),
        async remoteMessage => {
          console.log('Background Notification Received:', remoteMessage);

          if (!remoteMessage.notification && remoteMessage.data) {
            const title = remoteMessage.data.title as string | undefined;
            const body = remoteMessage.data.body as string | undefined;
            if (title || body) {
              await FCMService.displayNotification(
                title || 'New Notification',
                body || '',
                remoteMessage.data,
              );
            }
          }
        },
      );
    } catch {
      console.log('FCM Background Skip: Native module unavailable');
    }
  }
}
