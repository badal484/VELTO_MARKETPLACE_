import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../../theme';
import { axiosInstance } from '../../api/axiosInstance';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '@shared/types';

export default function SupportScreen({ navigation }: any) {
  const { user } = useAuth();

  const handleStartChat = async () => {
    try {
      // Find or create a conversation with the support team
      const res = await axiosInstance.post('/api/chat/support');
      if (res.data.success) {
        const conversation = res.data.data;
        
        // Find the admin participant
        const admin = (conversation.participants as any[]).find(p => p.role === Role.ADMIN || p.role === 'admin');
        
        const supportUser = admin || { 
          _id: (conversation.participants as any[]).find(p => p._id !== user?._id)?._id || 'support_admin', 
          name: 'Velto Support Team', 
          role: Role.ADMIN 
        };

        navigation.navigate('ChatRoom', {
          conversationId: conversation._id,
          otherUser: supportUser,
          shopName: 'Velto Support Hub',
        });
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Unable to connect to support team at the moment.';
      Alert.alert('Support Unavailable', msg);
    }
  };

  const handleCall = () => {
    const phoneNumber = 'tel:+919876543210'; // Support number
    Linking.openURL(phoneNumber).catch(() => 
      Alert.alert('Error', 'Unable to open dialer. Please call +91 98765 43210')
    );
  };

  const handleEmail = () => {
    const email = 'mailto:support@velto.in?subject=Support Request - ' + user?.name;
    Linking.openURL(email).catch(() => 
      Alert.alert('Error', 'Unable to open email app. Please email support@velto.in')
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconBox}>
            <Icon name="headset-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.heroTitle}>How can we help you today?</Text>
          <Text style={styles.heroSub}>Our dedicated team is here to assist you with any issues or queries.</Text>
        </View>

        <View style={styles.optionsGrid}>
          {/* 1. Chat with Support */}
          <TouchableOpacity style={styles.optionCard} onPress={handleStartChat}>
            <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
              <Icon name="chatbubbles-outline" size={28} color="#4F46E5" />
            </View>
            <Text style={styles.optionTitle}>Chat</Text>
            <Text style={styles.optionDesc}>Instant messaging for quick support and tracking help.</Text>
            <Icon name="chevron-forward" size={16} color={theme.colors.muted} style={styles.arrow} />
          </TouchableOpacity>

          {/* 2. Call Support */}
          <TouchableOpacity style={styles.optionCard} onPress={handleCall}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Icon name="call-outline" size={28} color="#059669" />
            </View>
            <Text style={styles.optionTitle}>Call Support</Text>
            <Text style={styles.optionDesc}>Speak directly with our support specialists for urgent issues.</Text>
            <Icon name="chevron-forward" size={16} color={theme.colors.muted} style={styles.arrow} />
          </TouchableOpacity>

          {/* 3. Email Support */}
          <TouchableOpacity style={styles.optionCard} onPress={handleEmail}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
              <Icon name="mail-outline" size={28} color="#EA580C" />
            </View>
            <Text style={styles.optionTitle}>Email Support</Text>
            <Text style={styles.optionDesc}>Send us a detailed email. We usually respond within 2 hours.</Text>
            <Icon name="chevron-forward" size={16} color={theme.colors.muted} style={styles.arrow} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.workingHours}>Support Working Hours</Text>
          <Text style={styles.hoursValue}>9:00 AM - 10:00 PM (Monday - Sunday)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: theme.colors.white,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  backBtn: {
    padding: 4,
  },
  content: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: theme.colors.white,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroIconBox: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  optionsGrid: {
    padding: 20,
    gap: 16,
  },
  optionCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  optionDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
    paddingRight: 40,
  },
  arrow: {
    position: 'absolute',
    right: 24,
    top: '50%',
    marginTop: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  workingHours: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  hoursValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
