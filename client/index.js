/**
 * @format
 */

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import { getApps, initializeApp } from '@react-native-firebase/app';

console.log('🔥 [DEBUG] index.js: Initializing Firebase...');

// Initialize Firebase as early as possible
if (!getApps().length) {
  try {
    initializeApp();
    console.log('✅ [DEBUG] Firebase Initialized successfully in index.js');
  } catch (err) {
    console.log('❌ [DEBUG] Firebase Init Error:', err);
  }
} else {
  console.log('ℹ️ [DEBUG] Firebase already initialized (apps length:', getApps().length, ')');
}

// Phase 4: Handle background push notifications (Temporarily disabled for stability - Re-enable after native rebuild)
// FCMService.setBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('NexBuy', () => App);
AppRegistry.registerComponent('Velto', () => App);