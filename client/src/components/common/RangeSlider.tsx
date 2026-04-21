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
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  initialMin = min,
  initialMax = max,
  onValueChange,
}) => {
  const xLeft = useSharedValue(
    interpolate(initialMin, [min, max], [0, SLIDER_WIDTH - THUMB_SIZE]),
  );
  const xRight = useSharedValue(
    interpolate(initialMax, [min, max], [0, SLIDER_WIDTH - THUMB_SIZE]),
  );

  const leftGestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    {startX: number}
  >({
    onStart: (_, ctx) => {
      ctx.startX = xLeft.value;
    },
    onActive: (event, ctx) => {
      const nextX = ctx.startX + event.translationX;
      if (nextX >= 0 && nextX <= xRight.value - THUMB_SIZE) {
        xLeft.value = nextX;
        const minVal = interpolate(
          nextX,
          [0, SLIDER_WIDTH - THUMB_SIZE],
          [min, max],
        );
        const maxVal = interpolate(
          xRight.value,
          [0, SLIDER_WIDTH - THUMB_SIZE],
          [min, max],
        );
        runOnJS(onValueChange)(Math.round(minVal), Math.round(maxVal));
      }
    },
    onEnd: () => {
      // Final update on end to ensure precision
      const minVal = interpolate(
        xLeft.value,
        [0, SLIDER_WIDTH - THUMB_SIZE],
        [min, max],
      );
      const maxVal = interpolate(
        xRight.value,
        [0, SLIDER_WIDTH - THUMB_SIZE],
        [min, max],
      );
      runOnJS(onValueChange)(Math.round(minVal), Math.round(maxVal));
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
      if (nextX <= SLIDER_WIDTH - THUMB_SIZE && nextX >= xLeft.value + THUMB_SIZE) {
        xRight.value = nextX;
        const minVal = interpolate(
          xLeft.value,
          [0, SLIDER_WIDTH - THUMB_SIZE],
          [min, max],
        );
        const maxVal = interpolate(
          nextX,
          [0, SLIDER_WIDTH - THUMB_SIZE],
          [min, max],
        );
        runOnJS(onValueChange)(Math.round(minVal), Math.round(maxVal));
      }
    },
    onEnd: () => {
      // Final update on end
      const minVal = interpolate(
        xLeft.value,
        [0, SLIDER_WIDTH - THUMB_SIZE],
        [min, max],
      );
      const maxVal = interpolate(
        xRight.value,
        [0, SLIDER_WIDTH - THUMB_SIZE],
        [min, max],
      );
      runOnJS(onValueChange)(Math.round(minVal), Math.round(maxVal));
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
