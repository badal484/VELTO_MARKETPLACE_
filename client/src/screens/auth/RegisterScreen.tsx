import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import {useAuth} from '../../hooks/useAuth';
import {useToast} from '../../hooks/useToast';
import {axiosInstance} from '../../api/axiosInstance';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInUp, FadeIn} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {AuthStackParamList} from '../../navigation/AuthNavigator';
import {registerSchema} from '@shared/validation';

type RegisterScreenNavigationProp = StackNavigationProp<
  AuthStackParamList,
  'Register'
>;

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({navigation}: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const {login} = useAuth();
  const {showToast} = useToast();

  const handleRegister = async () => {
    if (loading) return;
    
    // Zod Validation
    const validation = registerSchema.safeParse({name, email, password});
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await axiosInstance.post('/api/auth/register', {
        name,
        email,
        password,
      });
      if (res.data.success) {
        showToast({
          message: 'Welcome to Velto! Account created successfully.',
          type: 'success',
        });
        // Note: backend returns 'user' object, not 'data'
        await login(res.data.token, res.data.user);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as {response: {data: {message: string}}};
        setError(
          axiosErr.response?.data?.message ||
            'Registration failed. Try a different email.',
        );
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Animated.View
            entering={FadeInUp.delay(200).duration(600)}
            style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join Velto and start discovering the finest local shops in
              Karnataka.
            </Text>
          </Animated.View>

          <View style={styles.form}>
            {error ? (
              <Animated.View entering={FadeIn} style={styles.errorContainer}>
                <Icon
                  name="alert-circle"
                  size={18}
                  color={theme.colors.danger}
                />
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            <Input
              label="Full Name"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={setName}
            />

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
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <View style={styles.termsRow}>
              <Text style={styles.termsText}>
                By signing up, you agree to our{' '}
              </Text>
              <TouchableOpacity>
                <Text style={styles.linkTextSmall}>Terms & Conditions</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Get Started"
              onPress={handleRegister}
              isLoading={loading}
              style={styles.registerButton}
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Found your way back? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  flex: {flex: 1},
  scrollContent: {padding: 24, flexGrow: 1},
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    fontWeight: '500',
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  termsText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  linkTextSmall: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  registerButton: {
    height: 56,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
    paddingBottom: 24,
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