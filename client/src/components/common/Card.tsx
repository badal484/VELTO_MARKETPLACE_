import React, {useEffect, useRef} from 'react';
import {StyleSheet, ViewProps, Animated} from 'react-native';
import {theme} from '../../theme';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'outline' | 'flat';
  delay?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'elevated',
  delay = 0,
  ...props
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[styles.card, styles[variant], style, { opacity: fadeAnim }]}
      {...props}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    overflow: 'hidden',
  },
  elevated: {
    ...theme.shadow.md,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  flat: {
    backgroundColor: theme.colors.background,
  },
});
