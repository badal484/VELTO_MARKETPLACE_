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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {axiosInstance} from '../../api/axiosInstance';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeIn} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {loginSchema} from '@shared/validation';

type LoginScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'Login'
>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({navigation}: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {login} = useAuth();

  const handleLogin = async () => {
    if (loading) return;
    
    // Zod Validation
    const validation = loginSchema.safeParse({email, password});
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await axiosInstance.post('/api/auth/login', {
        email,
        password,
      });
      if (res.data.success) {
        // Correcting data mapping: backend returns 'user', not 'data'
        await login(res.data.token, res.data.user);
      }
    } catch (err: any) {
      if (err?.response) {
        // The request was made and the server responded with a status code
        setError(err.response.data?.message || 'Login failed. Please check your credentials.');
      } else if (err?.request) {
        // The request was made but no response was received
        setError('Could not reach the server. Please check your internet connection and ensure the backend is running.');
      } else {
        // Something happened in setting up the request that triggered an Error
        setError('An error occurred while signing in. Please try again.');
      }
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
            { paddingTop: Math.max(insets.top, 24) }
          ]}
          keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Animated.View entering={FadeIn.delay(200)} style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue exploring Karnataka's best local marketplace.
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
              label="Email Address"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Input
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              isLoading={loading}
              style={styles.loginButton}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.linkText}>Create One</Text>
              </TouchableOpacity>
            </View>
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.xl,
  },
  forgotText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  loginButton: {
    marginTop: theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.xxl,
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  linkText: {
    color: theme.colors.accent,
    fontWeight: '800',
    fontSize: 15,
  },
});
