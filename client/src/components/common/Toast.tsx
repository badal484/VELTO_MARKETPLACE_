import React, {useEffect} from 'react';
import {StyleSheet, Text, View, Dimensions} from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';

const {width} = Dimensions.get('window');

export const Toast = () => {
  const {visible, toast, hideToast} = useToast();

  if (!visible || !toast) return null;

  const getTypeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          backgroundColor: '#ECFDF5',
          borderColor: '#10B981',
          icon: 'checkmark-circle',
          iconColor: '#10B981',
          textColor: '#065F46',
        };
      case 'error':
        return {
          backgroundColor: '#FEF2F2',
          borderColor: '#EF4444',
          icon: 'alert-circle',
          iconColor: '#EF4444',
          textColor: '#991B1B',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#EFF6FF',
          borderColor: '#3B82F6',
          icon: 'information-circle',
          iconColor: '#3B82F6',
          textColor: '#1E40AF',
        };
    }
  };

  const styles_config = getTypeStyles();

  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[
        styles.container,
        {
          backgroundColor: styles_config.backgroundColor,
          borderColor: styles_config.borderColor,
        },
      ]}>
      <Icon name={styles_config.icon} size={20} color={styles_config.iconColor} />
      <Text style={[styles.text, {color: styles_config.textColor}]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 9999,
    ...theme.shadow.md,
  },
  text: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
});
