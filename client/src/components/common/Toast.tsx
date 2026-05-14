import React, {useEffect} from 'react';
import {StyleSheet, Text, View, Dimensions} from 'react-native';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import Animated from '../../mocks/reanimated';

const {width} = Dimensions.get('window');

export const Toast = () => {
  const {visible, toast} = useToast();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

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
      style={[
        styles.container,
        {
          backgroundColor: styles_config.backgroundColor,
          borderColor: styles_config.borderColor,
          opacity,
          transform: [{
            translateY: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            })
          }]
        },
      ]}>
      <Icon name={styles_config.icon} size={20} color={styles_config.iconColor} />
      <View style={styles.textContainer}>
        {toast.title && (
          <Text style={[styles.title, {color: styles_config.textColor}]}>
            {toast.title}
          </Text>
        )}
        <Text style={[styles.message, {color: styles_config.textColor}]}>
          {toast.message}
        </Text>
      </View>
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
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
});
