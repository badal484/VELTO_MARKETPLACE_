import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  TextInput,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {useAuth} from '../../hooks/useAuth';
import {useNotifications} from '../../context/NotificationContext';
import {useSocket} from '../../hooks/useSocket';
import {SocketEvent} from '@shared/constants/socketEvents';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInUp, FadeInRight} from 'react-native-reanimated';
import {IConversation, IUser, IProduct, Role} from '@shared/types';
import {StackNavigationProp} from '@react-navigation/stack';
import {ChatStackParamList} from '../../navigation/types';

type ConversationsNavigationProp = StackNavigationProp<
  ChatStackParamList,
  'Conversations'
>;

interface ConversationsProps {
  navigation: ConversationsNavigationProp;
}

export default function ConversationsScreen({navigation}: ConversationsProps) {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
   const [search, setSearch] = useState('');
  const {user} = useAuth();
  const {resetUnreadChatCount} = useNotifications();
  const {socket} = useSocket();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
      resetUnreadChatCount();
    });
    fetchConversations();
    
    if (socket) {
      socket.on(SocketEvent.NEW_MESSAGE_NOTIFICATION, (data: { conversationId: string, message: any }) => {
        setConversations(prev => {
          const index = prev.findIndex(c => c._id === data.conversationId);
          if (index === -1) {
            fetchConversations();
            return prev;
          }
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            lastMessage: data.message.text,
            updatedAt: new Date(),
            unreadCount: (updated[index] as any).unreadCount + 1
          } as any;
          // Move to top
          const conv = updated.splice(index, 1)[0];
          return [conv, ...updated];
        });
      });
    }

    return () => {
      unsubscribe();
      if (socket) {
        socket.off(SocketEvent.NEW_MESSAGE_NOTIFICATION);
      }
    };
  }, [navigation, socket]);

  const fetchConversations = async () => {
    try {
      const res = await axiosInstance.get('/api/chat/conversations');
      setConversations(res.data.data);
    } catch (err: unknown) {
      console.log('Fetch Conversations Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const filteredConversations = conversations.filter(conv => {
    const participants = conv.participants.filter(p => typeof p === 'object') as IUser[];
    const otherParticipant = participants.find(p => p._id !== user?._id);
    const product = (typeof conv.product === 'object' ? conv.product : null) as any;
    
    // Search filtering
    const matchesSearch = search === '' || 
      otherParticipant?.name.toLowerCase().includes(search.toLowerCase()) ||
      product?.title.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  const renderItem = ({item, index}: {item: IConversation; index: number}) => {
    const participants = item.participants.filter(p => typeof p !== 'string') as IUser[];
    const otherParticipant = participants.find(p => p._id !== user?._id);
    const order = (typeof item.order === 'object' ? item.order : null) as any;
    
    const isSupport = otherParticipant?.role === Role.ADMIN;
    const isRider = otherParticipant?.role === Role.RIDER;
    const isSeller = otherParticipant?.role === Role.SELLER || otherParticipant?.role === Role.SHOP_OWNER;
    const isBuyer = otherParticipant?.role === Role.BUYER;

    const updatedAt = new Date(item.updatedAt ?? Date.now());
    const time = updatedAt.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });

    return (
      <Animated.View entering={FadeInRight.delay(index * 50).duration(600)}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('ChatRoom', {
              conversationId: item._id,
              otherUser: otherParticipant!,
              orderId: order?._id || (typeof item.order === 'string' ? item.order : undefined),
            })
          }>
          <View style={styles.avatarBox}>
            <View style={[
              styles.initialsCircle, 
              isSupport && {backgroundColor: '#FEF3C7'},
              isRider && {backgroundColor: '#EEF2FF'},
              isSeller && {backgroundColor: '#ECFDF5'},
            ]}>
              {otherParticipant?.avatar ? (
                <Image source={{uri: otherParticipant.avatar}} style={styles.avatarImg} />
              ) : (
                <Icon 
                  name={isSupport ? "shield-checkmark" : isRider ? "bicycle" : isBuyer ? "person" : "storefront"} 
                  size={24} 
                  color={isSupport ? "#D97706" : isRider ? "#4F46E5" : isBuyer ? "#10B981" : "#059669"} 
                />
              )}
            </View>
          </View>

          <View style={styles.chatContent}>
            <View style={styles.metaRow}>
              <View style={styles.nameRow}>
                <Text style={styles.participantName} numberOfLines={1}>
                  {isSupport ? "Official Support" : otherParticipant?.name}
                </Text>
                 <View style={[
                   styles.roleBadge,
                   {backgroundColor: isSupport ? '#FEF3C7' : isRider ? '#EEF2FF' : isBuyer ? '#ECFDF5' : '#ECFDF5'}
                 ]}>
                   <Text style={[
                     styles.roleBadgeText,
                     {color: isSupport ? '#D97706' : isRider ? '#4F46E5' : isBuyer ? '#059669' : '#059669'}
                   ]}>
                     {isSupport ? 'SUPPORT' : isRider ? 'RIDER' : isBuyer ? 'CUSTOMER' : 'MERCHANT'}
                   </Text>
                 </View>
              </View>
              <Text style={styles.timestamp}>{time}</Text>
            </View>

            {order && (
              <View style={styles.orderBadgeRow}>
                <View style={[styles.statusBadgeSmall, {backgroundColor: theme.colors.primary + '10'}]}>
                  <Text style={styles.statusBadgeText}>#{order._id.slice(-6).toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadgeSmall, {backgroundColor: '#F1F5F9'}]}>
                  <Text style={styles.statusBadgeText}>{(order.status || 'Active').replace('_', ' ').toUpperCase()}</Text>
                </View>
              </View>
            )}

            <Text style={styles.snippet} numberOfLines={1}>
              {item.lastMessage || 'Open to view conversation'}
            </Text>
          </View>
          
          {(item as any).unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{(item as any).unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Image 
              source={require('../../../assets/velto_logo.png')} 
              style={styles.headerLogo} 
            />
            <Text style={styles.headerTitle}>Inbox</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Icon
              name="ellipsis-horizontal"
              size={20}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.searchPanel}>
          <View style={styles.inputWrapper}>
            <Icon name="search-outline" size={18} color={theme.colors.muted} />
            <TextInput
              placeholder="Search by name, item or order..."
              style={styles.boxInput}
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={theme.colors.muted}
            />
          </View>
        </View>

        <FlatList
          data={filteredConversations}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchConversations();
              }}
              tintColor={theme.colors.primary}
            />
          }
          ListEmptyComponent={
            <Animated.View
              entering={FadeInUp.duration(600)}
              style={styles.emptyState}>
              <View style={styles.glassCircle}>
                <Icon
                  name="chatbubbles-outline"
                  size={32}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>Your inbox is empty</Text>
              <Text style={styles.emptySub}>
                Start a conversation from any product page. Your connected chats
                will appear here.
              </Text>
            </Animated.View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: theme.colors.white,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerTitle: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: theme.colors.white,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  activeTab: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.muted,
  },
  activeTabText: {
    color: theme.colors.white,
  },
  searchPanel: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  boxInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  listContent: {paddingVertical: 8},
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 20,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  avatarBox: {width: 56, height: 56},
  initialsCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {width: '100%', height: '100%', borderRadius: 18},
  chatContent: {marginLeft: 16, flex: 1},
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  verifiedText: {
    fontSize: 8,
    fontWeight: '900',
    color: theme.colors.success,
  },
  timestamp: {fontSize: 11, color: theme.colors.muted, fontWeight: '700'},
  orderBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
    marginTop: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  snippet: {fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600'},
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 48,
  },
  glassCircle: {
    width: 80,
    height: 80,
    borderRadius: 30,
    backgroundColor: theme.colors.primary + '08',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {fontSize: 18, fontWeight: '900', color: theme.colors.text},
  emptySub: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});
