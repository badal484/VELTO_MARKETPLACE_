import React from 'react';
import {View, StyleSheet, Text, Dimensions} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  useAnimatedProps,
  runOnJS,
  withSpring,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {theme} from '../../theme';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 88; // Accounting for modal padding
const THUMB_SIZE = 24;

interface RangeSliderProps {
  min: number;
  max: number;
  initialMin?: number;
  initialMax?: number;
  onValueChange: (min: number, max: number) => void;
  step?: number;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  initialMin = min,
  initialMax = max,
  onValueChange,
  step = 1,
}) => {
  const INTERMEDIATE_PRICE = 5000;
  const SLIDER_MAX_POS = SLIDER_WIDTH - THUMB_SIZE;
  const INTERMEDIATE_POS = SLIDER_MAX_POS / 2;

  const priceToPos = (price: number) => {
    'worklet';
    return interpolate(
      price,
      [min, INTERMEDIATE_PRICE, max],
      [0, INTERMEDIATE_POS, SLIDER_MAX_POS],
      Extrapolate.CLAMP
    );
  };

  const posToPrice = (pos: number) => {
    'worklet';
    return interpolate(
      pos,
      [0, INTERMEDIATE_POS, SLIDER_MAX_POS],
      [min, INTERMEDIATE_PRICE, max],
      Extrapolate.CLAMP
    );
  };

  const xLeft = useSharedValue(priceToPos(initialMin));
  const xRight = useSharedValue(priceToPos(initialMax));

  const leftGestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    {startX: number}
  >({
    onStart: (_, ctx) => {
      ctx.startX = xLeft.value;
    },
    onActive: (event, ctx) => {
      const nextX = ctx.startX + event.translationX;
      if (nextX >= 0 && nextX <= xRight.value) {
        xLeft.value = nextX;
        const minVal = posToPrice(nextX);
        const maxVal = posToPrice(xRight.value);
        const roundedMin = Math.round(minVal / step) * step;
        const roundedMax = Math.round(maxVal / step) * step;
        runOnJS(onValueChange)(roundedMin, roundedMax);
      }
    },
    onEnd: () => {
      const minVal = posToPrice(xLeft.value);
      const maxVal = posToPrice(xRight.value);
      runOnJS(onValueChange)(
        Math.round(minVal / step) * step,
        Math.round(maxVal / step) * step
      );
    },
  });

  const rightGestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    {startX: number}
  >({
    onStart: (_, ctx) => {
      ctx.startX = xRight.value;
    },
    onActive: (event, ctx) => {
      const nextX = ctx.startX + event.translationX;
      if (nextX <= SLIDER_MAX_POS && nextX >= xLeft.value) {
        xRight.value = nextX;
        const minVal = posToPrice(xLeft.value);
        const maxVal = posToPrice(nextX);
        const roundedMin = Math.round(minVal / step) * step;
        const roundedMax = Math.round(maxVal / step) * step;
        runOnJS(onValueChange)(roundedMin, roundedMax);
      }
    },
    onEnd: () => {
      const minVal = posToPrice(xLeft.value);
      const maxVal = posToPrice(xRight.value);
      runOnJS(onValueChange)(
        Math.round(minVal / step) * step,
        Math.round(maxVal / step) * step
      );
    },
  });

  const leftThumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: xLeft.value}],
  }));

  const rightThumbStyle = useAnimatedStyle(() => ({
    transform: [{translateX: xRight.value}],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    left: xLeft.value + THUMB_SIZE / 2,
    width: xRight.value - xLeft.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View style={[styles.progress, progressStyle]} />
      </View>
      
      <PanGestureHandler onGestureEvent={leftGestureHandler}>
        <Animated.View style={[styles.thumb, leftThumbStyle]}>
          <View style={styles.thumbInner} />
        </Animated.View>
      </PanGestureHandler>

      <PanGestureHandler onGestureEvent={rightGestureHandler}>
        <Animated.View style={[styles.thumb, rightThumbStyle]}>
          <View style={styles.thumbInner} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 48,
    width: SLIDER_WIDTH,
    justifyContent: 'center',
    marginVertical: 16,
  },
  track: {
    height: 6,
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
  },
  progress: {
    height: '100%',
    backgroundColor: '#0F172A',
    position: 'absolute',
    borderRadius: 3,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0F172A',
  },
});
