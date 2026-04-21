import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../models/User';

/**
 * FCM Service - Systematic Push Notification Dispatcher
 */
export class FCMService {
  private static isInitialized = false;

  private static initialize() {
    if (this.isInitialized) return;
    
    try {
      let serviceAccount;

      const safeParse = (str: string) => {
        try {
          return JSON.parse(str);
        } catch (e) {
          // Attempt to fix common escaping issues in private_key
          const fixed = str.replace(/\\n/g, '\n').replace(/\\"/g, '"');
          return JSON.parse(fixed);
        }
      };

      // Priority 1: Service Account JSON file in config
      const configPath = path.join(__dirname, '../config/firebase-service-account.json');
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        serviceAccount = safeParse(fileContent);
      } 
      // Priority 2: Environment Variable
      else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = safeParse(process.env.FIREBASE_SERVICE_ACCOUNT);
      }

      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        this.isInitialized = true;
        console.log('✅ FCM Service Initialized Successfully');
      } else {
        console.warn('⚠️ FCM Service not initialized: No service account credentials found.');
      }
    } catch (error) {
      console.error('❌ FCM Initialization Error:', error);
    }
  }

  /**
   * Broadcasts a notification to all devices registered to a specific user.
   */
  static async sendToUser(userId: string, title: string, body: string, data?: any) {
    this.initialize();
    if (!this.isInitialized) return;

    try {
      const user = await User.findById(userId).select('fcmTokens');
      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) return;

      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: data || {},
        tokens: user.fcmTokens,
        android: {
          priority: 'high',
          notification: { channelId: 'default' }
        },
        apns: {
          payload: { aps: { badge: 1, sound: 'default' } }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Cleanup stale tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: admin.messaging.SendResponse, idx: number) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              failedTokens.push(user.fcmTokens![idx]);
            }
          }
        });

        if (failedTokens.length > 0) {
          await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { $in: failedTokens } }
          });
        }
      }
    } catch (error) {
      console.error('FCM Send Error:', error);
    }
  }
}
