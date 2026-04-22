declare module '@react-native-community/blur' {
  import { ViewProps } from 'react-native';
  import React from 'react';

  interface BlurViewProps extends ViewProps {
    blurType?: 'dark' | 'light' | 'xlight' | 'prominent' | 'regular' | 'extraDark' | 'chromeMaterial' | 'material' | 'thickMaterial' | 'thinMaterial' | 'ultraThinMaterial';
    blurAmount?: number;
    blurRadius?: number;
    reducedTransparencyFallbackColor?: string;
    overlayColor?: string;
  }

  export const BlurView: React.FC<BlurViewProps>;
}
