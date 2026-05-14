import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {Button} from './Button';
import Animated, {FadeInDown, FadeInUp} from '../../mocks/reanimated';

const {width} = Dimensions.get('window');

interface SuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText: string;
  onButtonPress: () => void;
}

export const SuccessModal = ({
  isVisible,
  onClose,
  title,
  message,
  buttonText,
  onButtonPress,
}: SuccessModalProps) => {
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View 
          entering={FadeInDown.duration(600)} 
          style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Animated.View entering={FadeInUp.delay(200).springify()}>
                <Icon name="checkmark-circle" size={80} color={theme.colors.success} />
              </Animated.View>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <Button
              title={buttonText}
              onPress={onButtonPress}
              type="primary"
              style={styles.button}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    ...theme.shadow.lg,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  button: {
    width: '100%',
    borderRadius: 16,
  },
});
