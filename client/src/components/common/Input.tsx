import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
import {theme} from '../../theme';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  useDerivedValue,
} from 'react-native-reanimated';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  disabled,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusedAnim = useDerivedValue(() => {
    return withTiming(isFocused ? 1 : 0, {duration: 200});
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focusedAnim.value,
      [0, 1],
      [theme.colors.border, theme.colors.primary],
    );
    return {
      borderColor: disabled ? theme.colors.border : borderColor,
      backgroundColor: disabled ? '#F8FAFC' : theme.colors.white,
      borderWidth: 1.5,
    };
  });

  const handleFocus = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    if (disabled) {
      return;
    }
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View
        style={[
          styles.inputWrapper,
          animatedContainerStyle,
          error ? styles.errorBorder : null,
        ]}>
        <TextInput
          style={[styles.input, disabled && {color: theme.colors.muted}]}
          placeholderTextColor={theme.colors.muted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          {...props}
        />
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginLeft: 2,
  },
  inputWrapper: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    ...theme.shadow.sm,
  },
  input: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    height: '100%',
  },
  errorBorder: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: theme.spacing.xs,
    marginLeft: 2,
  },
});