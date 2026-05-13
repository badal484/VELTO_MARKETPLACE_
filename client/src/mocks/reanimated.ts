import { Animated, View } from 'react-native';

const dummy: any = (...args: any[]) => ({
  delay: (...args: any[]) => dummy(),
  duration: (...args: any[]) => dummy(),
  springify: (...args: any[]) => dummy(),
  damping: (...args: any[]) => dummy(),
  stiffness: (...args: any[]) => dummy(),
  withCallback: (...args: any[]) => dummy(),
  value: 0,
});

export const FadeIn = dummy();
export const FadeInDown = dummy();
export const FadeInUp = dummy();
export const FadeInRight = dummy();
export const FadeInLeft = dummy();
export const FadeOut = dummy();
export const FadeOutDown = dummy();
export const FadeOutUp = dummy();
export const FadeOutRight = dummy();
export const FadeOutLeft = dummy();
export const ZoomIn = dummy();
export const ZoomOut = dummy();
export const Layout = dummy();

export const useSharedValue = (val: any) => ({ value: val });
export const useAnimatedStyle = (fn: any) => ({});
export const useDerivedValue = (fn: any) => ({ value: fn() });
export const withSpring = (...args: any[]) => args[0];
export const withTiming = (...args: any[]) => args[0];
export const withRepeat = (...args: any[]) => args[0];
export const withSequence = (...args: any[]) => args[0];
export const withDelay = (...args: any[]) => args[1];
export const runOnJS = (...args: any[]) => args[0];
export const runOnUI = (...args: any[]) => args[0];
export const interpolateColor = (...args: any[]) => args[2]?.[0];
export const interpolate = (...args: any[]) => args[2]?.[0];
export const Extrapolate = { CLAMP: 'clamp' };

export const Easing = {
  bezier: () => ({}),
  out: () => ({}),
  in: () => ({}),
  inOut: () => ({}),
  linear: () => ({}),
  quad: () => ({}),
  cubic: () => ({}),
};

export default {
  View: (Animated.View || View) as any,
  Text: (Animated.Text || View) as any,
  Image: (Animated.Image || View) as any,
  ScrollView: (Animated.ScrollView || View) as any,
  Value: Animated.Value,
  timing: Animated.timing,
  spring: Animated.spring,
  event: Animated.event,
  sequence: Animated.sequence,
  parallel: Animated.parallel,
  delay: Animated.delay,
  loop: Animated.loop,
  createAnimatedComponent: (comp: any) => comp as any,
  interpolate: (v: any, i: any, o: any) => o[0],
  interpolateColor: (v: any, i: any, o: any) => o[0],
};
