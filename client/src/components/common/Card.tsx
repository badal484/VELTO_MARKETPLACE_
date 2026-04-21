import React from 'react';
import {StyleSheet, ViewProps} from 'react-native';
import {theme} from '../../theme';
import Animated, {FadeInDown} from 'react-native-reanimated';

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
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(600)}
      style={[styles.card, styles[variant], style]}
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
