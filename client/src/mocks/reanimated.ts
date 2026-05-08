import { Animated, View } from 'react-native';

const dummy = () => ({
  delay: () => dummy(),
  duration: () => dummy(),
  springify: () => dummy(),
  damping: () => dummy(),
  stiffness: () => dummy(),
  withCallback: () => dummy(),
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
export const withSpring = (val: any) => val;
export const withTiming = (val: any) => val;
export const withRepeat = (val: any) => val;
export const withSequence = (...args: any[]) => args[0];
export const withDelay = (d: number, val: any) => val;
export const runOnJS = (fn: any) => fn;
export const runOnUI = (fn: any) => fn;
export const interpolateColor = (v: any, i: any, o: any) => o[0];
export const interpolate = (v: any, i: any, o: any) => o[0];
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
  View: Animated.View || View,
  Text: Animated.Text || View,
  Image: Animated.Image || View,
  ScrollView: Animated.ScrollView || View,
  Value: Animated.Value,
  timing: Animated.timing,
  spring: Animated.spring,
  event: Animated.event,
  sequence: Animated.sequence,
  parallel: Animated.parallel,
  delay: Animated.delay,
  loop: Animated.loop,
  createAnimatedComponent: (comp: any) => comp,
  interpolate: (v: any, i: any, o: any) => o[0],
  interpolateColor: (v: any, i: any, o: any) => o[0],
};
