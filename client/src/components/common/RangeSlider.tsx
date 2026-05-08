import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Text, Dimensions, Animated} from 'react-native';
import {theme} from '../../theme';
import {
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 88;
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
  const SLIDER_MAX_POS = SLIDER_WIDTH - THUMB_SIZE;
  const INTERMEDIATE_PRICE = 5000;
  const INTERMEDIATE_POS = SLIDER_MAX_POS / 2;

  const priceToPos = (price: number) => {
    if (price <= INTERMEDIATE_PRICE) {
      return ((price - min) / (INTERMEDIATE_PRICE - min)) * INTERMEDIATE_POS;
    }
    return INTERMEDIATE_POS + ((price - INTERMEDIATE_PRICE) / (max - INTERMEDIATE_PRICE)) * (SLIDER_MAX_POS - INTERMEDIATE_POS);
  };

  const posToPrice = (pos: number) => {
    let p;
    if (pos <= INTERMEDIATE_POS) {
      p = min + (pos / INTERMEDIATE_POS) * (INTERMEDIATE_PRICE - min);
    } else {
      p = INTERMEDIATE_PRICE + ((pos - INTERMEDIATE_POS) / (SLIDER_MAX_POS - INTERMEDIATE_POS)) * (max - INTERMEDIATE_PRICE);
    }
    return Math.round(p / step) * step;
  };

  const leftPos = useRef(new Animated.Value(priceToPos(initialMin))).current;
  const rightPos = useRef(new Animated.Value(priceToPos(initialMax))).current;
  
  const lastLeft = useRef(priceToPos(initialMin));
  const lastRight = useRef(priceToPos(initialMax));
  const lastPriceMin = useRef(initialMin);
  const lastPriceMax = useRef(initialMax);

  useEffect(() => {
    const lListener = leftPos.addListener(({value}) => {
      lastLeft.current = value;
      const newPrice = posToPrice(value);
      if (newPrice !== lastPriceMin.current) {
        lastPriceMin.current = newPrice;
        onValueChange(newPrice, lastPriceMax.current);
      }
    });
    const rListener = rightPos.addListener(({value}) => {
      lastRight.current = value;
      const newPrice = posToPrice(value);
      if (newPrice !== lastPriceMax.current) {
        lastPriceMax.current = newPrice;
        onValueChange(lastPriceMin.current, newPrice);
      }
    });
    return () => {
      leftPos.removeListener(lListener);
      rightPos.removeListener(rListener);
    };
  }, [min, max, onValueChange]);

  const onGestureLeft = Animated.event(
    [{nativeEvent: {translationX: leftPos}}],
    {useNativeDriver: false}
  );

  const onGestureRight = Animated.event(
    [{nativeEvent: {translationX: rightPos}}],
    {useNativeDriver: false}
  );

  // For standard Animated, we need to handle the offset manually to keep the thumb where it was
  const handleGestureLeft = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      leftPos.setOffset(lastLeft.current);
      leftPos.setValue(0);
    } else if (event.nativeEvent.state === State.END) {
      leftPos.flattenOffset();
      // Clamp values
      if (lastLeft.current < 0) leftPos.setValue(0);
      if (lastLeft.current > lastRight.current - THUMB_SIZE) leftPos.setValue(lastRight.current - THUMB_SIZE);
    }
  };

  const handleGestureRight = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      rightPos.setOffset(lastRight.current);
      rightPos.setValue(0);
    } else if (event.nativeEvent.state === State.END) {
      rightPos.flattenOffset();
      // Clamp values
      if (lastRight.current > SLIDER_MAX_POS) rightPos.setValue(SLIDER_MAX_POS);
      if (lastRight.current < lastLeft.current + THUMB_SIZE) rightPos.setValue(lastLeft.current + THUMB_SIZE);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <Animated.View 
          style={[
            styles.progress, 
            { 
              left: Animated.add(leftPos, THUMB_SIZE / 2),
              right: Animated.add(
                Animated.multiply(rightPos, -1),
                SLIDER_WIDTH - THUMB_SIZE / 2
              )
            }
          ]} 
        />
      </View>
      
      <PanGestureHandler
        onGestureEvent={onGestureLeft}
        onHandlerStateChange={handleGestureLeft}>
        <Animated.View style={[styles.thumb, { transform: [{translateX: leftPos}] }]}>
          <View style={styles.thumbInner} />
        </Animated.View>
      </PanGestureHandler>

      <PanGestureHandler
        onGestureEvent={onGestureRight}
        onHandlerStateChange={handleGestureRight}>
        <Animated.View style={[styles.thumb, { transform: [{translateX: rightPos}] }]}>
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
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.primary,
  },
});
