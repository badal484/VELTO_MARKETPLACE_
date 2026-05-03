import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeIn} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {useAuth} from '../../hooks/useAuth';

type VerifyOTPScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'VerifyOTP'
>;

type VerifyOTPScreenRouteProp = RouteProp<
  AuthStackParamList,
  'VerifyOTP'
>;

interface VerifyOTPScreenProps {
  navigation: VerifyOTPScreenNavigationProp;
  route: VerifyOTPScreenRouteProp;
}

export default function VerifyOTPScreen({navigation, route}: VerifyOTPScreenProps) {
  const {email, type} = route.params;
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {login} = useAuth();

  const handleVerify = async () => {
    if (!otp) {
      setError('Please enter the 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const endpoint = type === 'register' ? '/api/auth/verify-otp' : '/api/auth/reset-password';
      const res = await axiosInstance.post(endpoint, {
        email,
        otp,
      });

      if (res.data.success) {
        if (type === 'register') {
          await login(res.data.token, res.data.user);
        } else {
          navigation.navigate('ResetPassword', {email});
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {paddingTop: Math.max(insets.top, 24)},
          ]}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Animated.View entering={FadeIn.delay(200)} style={styles.header}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to {email}. Please enter it to continue.
            </Text>
          </Animated.View>

          <View style={styles.form}>
            {error ? (
              <Animated.View entering={FadeIn} style={styles.errorContainer}>
                <Icon
                  name="alert-circle"
                  size={20}
                  color={theme.colors.danger}
                />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            <Input
              label="6-Digit Code"
              placeholder="000000"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button
              title="Verify & Continue"
              onPress={handleVerify}
              isLoading={loading}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  flex: {flex: 1},
  scrollContent: {padding: theme.spacing.xl, flexGrow: 1},
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    fontWeight: '500',
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: theme.spacing.md,
    borderRadius: 12,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    marginLeft: theme.spacing.sm,
    flex: 1,
    fontWeight: '600',
  },
  button: {
    marginTop: theme.spacing.md,
  },
});
