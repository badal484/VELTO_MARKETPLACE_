declare module 'react-native-toast-message' {
  import React from 'react';
  import { ViewStyle } from 'react-native';

  export interface ToastShowParams {
    type?: string;
    text1?: string;
    text2?: string;
    position?: 'top' | 'bottom';
    visibilityTime?: number;
    autoHide?: boolean;
    topOffset?: number;
    bottomOffset?: number;
    onShow?: () => void;
    onHide?: () => void;
    onPress?: () => void;
    props?: any;
  }

  const Toast: React.FC<{ config?: any; style?: ViewStyle }> & {
    show: (params: ToastShowParams) => void;
    hide: () => void;
  };

  export default Toast;
}
