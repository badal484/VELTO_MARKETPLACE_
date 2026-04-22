import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';
import {Button} from './Button';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';

interface ReviewModalProps {
  isVisible: boolean;
  onClose: () => void;
  productId: string;
  orderId: string;
  productTitle: string;
  onSuccess: () => void;
}

export const ReviewModal = ({
  isVisible,
  onClose,
  productId,
  orderId,
  productTitle,
  onSuccess,
}: ReviewModalProps) => {
  const {showToast} = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      showToast({message: 'Please enter a comment', type: 'info'});
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post('/api/reviews', {
        productId,
        orderId,
        rating,
        comment,
      });
      showToast({message: 'Thank you for your review!', type: 'success'});
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast({message: error.response?.data?.message || 'Could not submit review', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}>
          <Animated.View entering={FadeInUp} style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Review Product</Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.productTitle} numberOfLines={1}>
              {productTitle}
            </Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starBtn}>
                  <Icon
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? '#FFD700' : theme.colors.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="What did you like or dislike?"
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
            />

            <Button
              title={loading ? 'Submitting...' : 'Submit Review'}
              onPress={handleSubmit}
              isLoading={loading}
              style={styles.submitBtn}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    ...theme.shadow.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  productTitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 24,
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  starBtn: {
    padding: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    height: 120,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  submitBtn: {
    borderRadius: 14,
  },
});