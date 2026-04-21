/**
 * @format
 */

import 'react-native-gesture-handler';
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {FCMService} from './src/services/FCMService';

// Phase 4: Handle background push notifications (Temporarily disabled for stability - Re-enable after native rebuild)
// FCMService.setBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('NexBuy', () => App);