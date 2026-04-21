import messaging from '@react-native-firebase/messaging';
import { axiosInstance } from '../api/axiosInstance';
import { Platform } from 'react-native';

/**
 * FCM Service - Systematic Device Handshake
 * 
 * Handles the registration of the mobile device for system-level 
 * push notifications (app-closed support).
 */
export class FCMService {
  /**
   * Internal check for native module presence
   */
  private static async isSupported() {
    try {
      return !!messaging();
    } catch (e) {
      console.warn('⚠️ FCM Native Module not found. Push notifications disabled (Native Rebuild Required).');
      return false;
    }
  }

  /**
   * Request notification permission and register token with the server.
   */
  static async registerDevice() {
    try {
      if (!(await this.isSupported())) return;

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('🔔 Notification permission granted.');
        
        if (Platform.OS === 'ios') {
          await messaging().registerDeviceForRemoteMessages();
        }

        const token = await messaging().getToken();
        if (token) {
          await this.updateTokenOnServer(token);
        }
      }
    } catch (error) {
      console.log('FCM Service Skip:', error);
    }
  }

  /**
   * Send the device token to our centralized notification foundation.
   */
  private static async updateTokenOnServer(token: string) {
    try {
      await axiosInstance.post('/api/notifications/fcm-token', { token });
      console.log('✅ FCM Token synced with server.');
    } catch (error) {
      console.warn('❌ Failed to sync FCM token (User might be logged out or Offline)');
    }
  }

  /**
   * Set up message listeners for foreground alerts.
   */
  static listenForMessages(callback: (message: any) => void) {
    try {
      return messaging().onMessage(async remoteMessage => {
        if (callback) callback(remoteMessage);
      });
    } catch (e) {
      return () => {}; // No-op unsubscribe
    }
  }

  /**
   * Handler for notifications that arrive when the app is in the background.
   */
  static setBackgroundHandler() {
    try {
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('🌙 Background Notification Received:', remoteMessage);
      });
    } catch (e) {
      console.log('FCM Background Skip: Native module unavailable');
    }
  }
}
