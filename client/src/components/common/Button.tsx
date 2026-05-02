import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import {theme} from '../../theme';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface ButtonProps {
  title: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'warning' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
}

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  type = 'primary',
  size = 'md',
  isLoading = false,
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  leftIcon,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const getButtonStyles = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.button, styles[size] as ViewStyle];

    if (type === 'primary') {
      baseStyle.push(styles.primary as ViewStyle);
    }
    if (type === 'secondary') {
      baseStyle.push(styles.secondary as ViewStyle);
    }
    if (type === 'outline') {
      baseStyle.push(styles.outline as ViewStyle);
    }
    if (type === 'ghost') {
      baseStyle.push(styles.ghost as ViewStyle);
    }
    if (type === 'accent') {
      baseStyle.push(styles.accent as ViewStyle);
    }
    if (type === 'warning') {
      baseStyle.push(styles.warning as ViewStyle);
    }
    if (type === 'success') {
      baseStyle.push(styles.success as ViewStyle);
    }
    if (type === 'danger') {
      baseStyle.push(styles.danger as ViewStyle);
    }

    if (disabled || isLoading || loading) {
      baseStyle.push(styles.disabled as ViewStyle);
    }

    return baseStyle;
  };

  const getTextStyles = (): TextStyle[] => {
    const baseTextStyle: TextStyle[] = [
      styles.text,
      styles[`text_${size}` as keyof typeof styles] as TextStyle,
    ];

    if (type === 'outline') {
      baseTextStyle.push(styles.textOutline as TextStyle);
    }
    if (type === 'ghost') {
      baseTextStyle.push(styles.textGhost as TextStyle);
    }
    if (type === 'secondary') {
      baseTextStyle.push(styles.textSecondary as TextStyle);
    }
    if (type === 'accent') {
      baseTextStyle.push(styles.textAccent as TextStyle);
    }

    return baseTextStyle;
  };

  return (
    <AnimatedTouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isLoading || loading}
      style={[getButtonStyles(), animatedStyle, style]}>
      {(isLoading || loading) ? (
        <ActivityIndicator
          color={
            type === 'outline' || type === 'ghost'
              ? theme.colors.primary
              : theme.colors.white
          }
        />
      ) : (
        <>
          {leftIcon && <View style={{marginRight: 8}}>{leftIcon}</View>}
          <Text style={[getTextStyles(), textStyle]}>{title}</Text>
          {icon && <View style={{marginLeft: 8}}>{icon}</View>}
        </>
      )}
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    ...theme.shadow.sm,
  },
  // Sizes
  sm: {paddingVertical: 8, paddingHorizontal: 16},
  md: {paddingVertical: 14, paddingHorizontal: 24},
  lg: {paddingVertical: 18, paddingHorizontal: 32},

  // Types
  primary: {backgroundColor: theme.colors.primary},
  secondary: {backgroundColor: theme.colors.secondary},
  accent: {backgroundColor: theme.colors.accent},
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    elevation: 0,
  },
  ghost: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  warning: {
    backgroundColor: theme.colors.warning,
  },
  success: {
    backgroundColor: theme.colors.success,
  },
  danger: {
    backgroundColor: theme.colors.danger,
  },
  disabled: {
    opacity: 0.6,
  },

  // Text Styles
  input: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    height: '100%',
  },
  errorBorder: {
    borderColor: theme.colors.danger as string,
  },
  text: {
    fontWeight: '700',
    color: theme.colors.white,
    textAlign: 'center',
  },
  text_sm: {fontSize: theme.fontSize.xs},
  text_md: {fontSize: theme.fontSize.md},
  text_lg: {fontSize: theme.fontSize.lg},

  textOutline: {color: theme.colors.primary},
  textGhost: {color: theme.colors.primary},
  textSecondary: {color: theme.colors.white},
  textAccent: {color: theme.colors.primary},
});