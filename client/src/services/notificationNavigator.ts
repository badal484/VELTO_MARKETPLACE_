import { navigationRef } from '../navigation/navigationRef';

/**
 * Maps FCM/notifee notification data payloads to in-app navigation.
 * Called from three places:
 *   1. getInitialNotification()  — app was killed, user tapped notification
 *   2. onNotificationOpenedApp() — app was in background, user tapped notification
 *   3. notifee onForegroundEvent — user tapped an in-app banner
 *
 * The `type` field in data corresponds to:
 *   - NotificationType enum values from the server ('ORDER', 'SHOP', 'PAYOUT', 'INFO', 'SYSTEM')
 *   - Custom types from direct FCMService.sendToUser calls ('CHAT', 'PHARMACY_BROADCAST')
 */
export function handleNotificationData(data?: Record<string, string> | null) {
  if (!navigationRef.isReady()) return;

  switch (data?.type) {
    case 'CHAT':
      // We have conversationId + senderId but ChatRoom requires a full otherUser object.
      // Navigate to Conversations list so the user taps the right thread.
      navigationRef.navigate('Conversations' as never);
      break;

    case 'PHARMACY_BROADCAST':
      (navigationRef as any).navigate('MainTabs', {
        screen: 'DashboardTab',
        params: { screen: 'PharmacyBroadcasts' },
      });
      break;

    case 'ORDER':
      (navigationRef as any).navigate('MainTabs', {
        screen: 'ProfileTab',
        params: { screen: 'OrderHistory' },
      });
      break;

    case 'PAYOUT':
      // Riders/sellers → their order history shows payout status
      (navigationRef as any).navigate('MainTabs', {
        screen: 'ProfileTab',
        params: { screen: 'OrderHistory' },
      });
      break;

    case 'SHOP':
      // Shop verification updates → profile to see shop status
      (navigationRef as any).navigate('MainTabs', {
        screen: 'ProfileTab',
      });
      break;

    default:
      // INFO, SYSTEM, or missing type → Notifications screen
      navigationRef.navigate('Notifications' as never);
      break;
  }
}
