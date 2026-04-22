import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Image,
  ImageBackground,
  ActionSheetIOS,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useSocket} from '../../hooks/useSocket';
import {useAuth} from '../../hooks/useAuth';
import {useNotifications} from '../../context/NotificationContext';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeIn, FadeInDown, Layout} from 'react-native-reanimated';
import { IMessage, IOrder, IUser, OrderStatus, Role } from '@shared/types';
import { getStatusDisplay } from '@shared/constants/orderStatus';
import { SocketEvent } from '@shared/constants/socketEvents';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {ChatStackParamList} from '../../navigation/types';
import OrderProgressStepper from '../../components/chat/OrderProgressStepper';

const {width} = Dimensions.get('window');

type ChatNavigationProp = StackNavigationProp<ChatStackParamList, 'ChatRoom'>;
type ChatRouteProp = RouteProp<ChatStackParamList, 'ChatRoom'>;

interface ChatScreenProps {
  route: ChatRouteProp;
  navigation: ChatNavigationProp;
}

export default function ChatScreen({route, navigation}: ChatScreenProps) {
  const {conversationId, otherUser, productTitle, shopName, shopLogo, orderId} = route.params;
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [order, setOrder] = useState<any>(null);
  const [text, setText] = useState('');
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [playbackPos, setPlaybackPos] = useState<Record<string, number>>({});
  const [playbackDur, setPlaybackDur] = useState<Record<string, number>>({});
  const recordTimer = useRef<NodeJS.Timeout | null>(null);
  const audioPlayer = useRef(new AudioRecorderPlayer()).current;
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {socket, isConnected, setActiveConversationId} = useSocket();
  const {user} = useAuth();
  const {markConversationAsRead} = useNotifications();
  const flatlistRef = useRef<FlatList>(null);

  const fetchMessages = React.useCallback(async (pageNum = 1) => {
    try {
      const res = await axiosInstance.get(
        `/api/chat/messages/${conversationId}?page=${pageNum}&limit=30`,
      );
      const { data, pagination } = res.data;
      setMessages(prev => pageNum === 1 ? data : [...data, ...prev]);
      setHasMore(pagination.hasMore);
      setPage(pageNum);

      if (orderId && pageNum === 1) {
        const orderRes = await axiosInstance.get(`/api/orders/${orderId}`);
        if (orderRes.data.success) setOrder(orderRes.data.data);
      }
    } catch (err: unknown) {
      console.log('Fetch Messages Error:', err);
    } finally {
      setFetching(false);
      setLoadingMore(false);
    }
  }, [conversationId, orderId]);

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await fetchMessages(page + 1);
  };

  useEffect(() => {
    fetchMessages();
    setActiveConversationId(conversationId);
    markConversationAsRead(conversationId);

    if (socket && isConnected) {
      socket.emit(SocketEvent.JOIN_CONVERSATION, conversationId);

      socket.on(SocketEvent.RECEIVE_MESSAGE, (message: IMessage) => {
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
        markConversationAsRead(conversationId);
      });

      socket.on(SocketEvent.ORDER_STATUS_UPDATED, (updatedOrder: any) => {
        if (orderId && updatedOrder._id === orderId) {
          setOrder(updatedOrder);
        }
      });

      socket.on(SocketEvent.TYPING, (data: { conversationId: string; userId: string }) => {
        if (data.conversationId === conversationId && data.userId !== user?._id) {
          setIsTyping(true);
          setTypingUser(otherUser?.role === Role.ADMIN ? 'Support Team' : otherUser?.name || 'Someone');
          
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      });
    }

    return () => {
      setActiveConversationId(null);
      if (socket) {
        socket.off(SocketEvent.RECEIVE_MESSAGE);
        socket.off(SocketEvent.TYPING);
        socket.off(SocketEvent.ORDER_STATUS_UPDATED);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, isConnected, conversationId, fetchMessages, setActiveConversationId, markConversationAsRead, user?._id, orderId]);

  const sendMessage = async () => {
    if (!text.trim()) {
      return;
    }
    if (!conversationId || !otherUser?._id) {
      require('react-native').Alert.alert('Session Error', 'Chat session is missing valid identifiers. Please go back and try again.');
      return;
    }

    const messageText = text.trim();
    setText('');

    try {
      const res = await axiosInstance.post('/api/chat/message', {
        conversationId,
        receiverId: otherUser._id,
        text: messageText,
      });

      const sentMessage: IMessage = res.data.data;
      setMessages(prev => {
        const exists = prev.some(m => m._id === sentMessage._id);
        if (exists) return prev;
        return [...prev, sentMessage];
      });

      if (socket && isConnected) {
        socket.emit(SocketEvent.SEND_MESSAGE, {
          conversationId,
          receiverId: otherUser._id,
          text: messageText,
          message: sentMessage,
        });
      }
    } catch (err: any) {
      console.log('Error sending message', err.response?.data?.message || err.message);
    }
  };

  const sendImageMessage = async (uri: string, type: string, name: string) => {
    try {
      const form = new FormData();
      form.append('image', {uri, type, name} as any);
      const uploadRes = await axiosInstance.post('/api/upload/image', form);
      const imageUrl = uploadRes.data.data?.url || uploadRes.data.url;
      if (!imageUrl) return;

      const res = await axiosInstance.post('/api/chat/message', {
        conversationId,
        receiverId: otherUser._id,
        text: `__img__${imageUrl}`,
      });
      const sentMessage: IMessage = res.data.data;
      setMessages(prev =>
        prev.some(m => m._id === sentMessage._id) ? prev : [...prev, sentMessage],
      );
      if (socket && isConnected) {
        socket.emit(SocketEvent.SEND_MESSAGE, {
          conversationId,
          receiverId: otherUser._id,
          text: `__img__${imageUrl}`,
          message: sentMessage,
        });
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Could not send image');
    }
  };

  const handleAttachment = () => {
    const pick = (fromCamera: boolean) => {
      const launch = fromCamera ? launchCamera : launchImageLibrary;
      launch(
        {mediaType: 'photo', quality: 0.7, includeBase64: false},
        response => {
          if (response.didCancel || response.errorCode) return;
          const asset = response.assets?.[0];
          if (asset?.uri) {
            sendImageMessage(
              asset.uri,
              asset.type || 'image/jpeg',
              asset.fileName || 'photo.jpg',
            );
          }
        },
      );
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0},
        idx => {
          if (idx === 1) pick(true);
          if (idx === 2) pick(false);
        },
      );
    } else {
      Alert.alert('Send Image', 'Choose source', [
        {text: 'Camera', onPress: () => pick(true)},
        {text: 'Gallery', onPress: () => pick(false)},
        {text: 'Cancel', style: 'cancel'},
      ]);
    }
  };

  const requestMicPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {title: 'Microphone', message: 'Velto needs mic access to send voice messages.', buttonPositive: 'Allow'},
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS handled via Info.plist at install time
  };

  const startRecording = async () => {
    const allowed = await requestMicPermission();
    if (!allowed) {
      Alert.alert('Permission Denied', 'Microphone permission is required to send voice messages.');
      return;
    }
    try {
      await audioPlayer.startRecorder(undefined, {
        OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
      });
      setRecording(true);
      setRecordSecs(0);
      recordTimer.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('permission') || msg.includes('Permission')) {
        Alert.alert('Microphone Permission', 'Please grant microphone permission in Settings and try again.');
      } else if (msg.includes('emulator') || msg.includes('stub') || msg.includes('ENOENT')) {
        Alert.alert('Not Supported', 'Audio recording is not available on this emulator. Test on a physical device.');
      } else {
        Alert.alert('Recording Error', msg || 'Could not start recording. Make sure microphone permission is granted.');
      }
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording) return;
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecording(false);
    try {
      const uri = await audioPlayer.stopRecorder();
      audioPlayer.removeRecordBackListener();
      if (recordSecs < 1) return; // ignore tap
      await sendAudioMessage(uri);
    } catch {
      // ignore
    }
  };

  const sendAudioMessage = async (uri: string) => {
    try {
      // Android recorder returns an absolute path without file:// prefix
      const fileUri = Platform.OS === 'android' && !uri.startsWith('file://')
        ? `file://${uri}`
        : uri;

      const ext = Platform.OS === 'android' ? 'mp4' : 'm4a';
      const mime = Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a';

      const form = new FormData();
      form.append('audio', {uri: fileUri, type: mime, name: `voice_${Date.now()}.${ext}`} as any);
      const uploadRes = await axiosInstance.post('/api/upload/audio', form);
      const audioUrl = uploadRes.data.url;
      if (!audioUrl) return;

      const res = await axiosInstance.post('/api/chat/message', {
        conversationId,
        receiverId: otherUser._id,
        text: `__audio__${audioUrl}`,
      });
      const sentMessage: IMessage = res.data.data;
      setMessages(prev =>
        prev.some(m => m._id === sentMessage._id) ? prev : [...prev, sentMessage],
      );
      if (socket && isConnected) {
        socket.emit(SocketEvent.SEND_MESSAGE, {
          conversationId,
          receiverId: otherUser._id,
          text: `__audio__${audioUrl}`,
          message: sentMessage,
        });
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.response?.data?.message || 'Could not send voice message.');
    }
  };

  const toggleAudioPlayback = async (msgId: string, uri: string) => {
    // Tapped the currently playing message → pause/stop
    if (playingMsgId === msgId) {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
      setPlayingMsgId(null);
      return;
    }
    // Stop anything already playing
    if (playingMsgId) {
      await audioPlayer.stopPlayer();
      audioPlayer.removePlayBackListener();
    }
    setPlayingMsgId(msgId);
    await audioPlayer.startPlayer(uri);
    audioPlayer.addPlayBackListener(e => {
      setPlaybackPos(prev => ({...prev, [msgId]: e.currentPosition}));
      setPlaybackDur(prev => ({...prev, [msgId]: e.duration}));
      if (e.currentPosition >= e.duration && e.duration > 0) {
        audioPlayer.stopPlayer();
        audioPlayer.removePlayBackListener();
        setPlayingMsgId(null);
      }
    });
  };

  const fmtMs = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const renderMessage = ({item}: {item: IMessage}) => {
    if (item.isSystem) {
      return (
        <Animated.View entering={FadeIn} style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBadge}>
            <Icon name="information-circle" size={12} color={theme.colors.muted} />
            <Text style={styles.systemMessageText}>{item.text}</Text>
          </View>
        </Animated.View>
      );
    }

    const senderId = typeof item.sender === 'object' && item.sender !== null
      ? (item.sender as any)._id
      : item.sender;
    const isMe = String(senderId) === user?._id;
    const updatedAt = new Date(item.createdAt ?? Date.now());
    const time = updatedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <Animated.View
        entering={FadeInDown.delay(50)}
        layout={Layout.springify()}
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
        ]}>
        <View
          style={[styles.messageCard, isMe ? styles.myCard : styles.theirCard]}>
          {item.text.startsWith('__img__') ? (
            <Image
              source={{uri: item.text.replace('__img__', '')}}
              style={styles.msgImage}
              resizeMode="cover"
            />
          ) : item.text.startsWith('__audio__') ? (
            (() => {
              const uri = item.text.replace('__audio__', '');
              const msgId = String(item._id ?? '');
              const isPlaying = playingMsgId === msgId;
              const pos = playbackPos[msgId] ?? 0;
              const dur = playbackDur[msgId] ?? 0;
              const progress = dur > 0 ? pos / dur : 0;
              return (
                <TouchableOpacity
                  style={styles.audioPlayer}
                  onPress={() => toggleAudioPlayback(msgId, uri)}
                  activeOpacity={0.8}>
                  <Icon
                    name={isPlaying ? 'pause-circle' : 'play-circle'}
                    size={32}
                    color={isMe ? '#fff' : theme.colors.primary}
                  />
                  <View style={styles.audioTrack}>
                    <View style={styles.audioBarBg}>
                      <View style={[styles.audioBarFill, {width: `${progress * 100}%`, backgroundColor: isMe ? 'rgba(255,255,255,0.8)' : theme.colors.primary}]} />
                    </View>
                    <Text style={[styles.audioDuration, {color: isMe ? 'rgba(255,255,255,0.7)' : theme.colors.muted}]}>
                      {isPlaying && dur > 0 ? fmtMs(pos) : fmtMs(dur)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })()
          ) : (
            <Text
              style={[
                styles.chatText,
                isMe ? styles.myChatText : styles.theirChatText,
              ]}>
              {item.text}
            </Text>
          )}
          <View style={styles.chatFooter}>
            <Text
              style={[
                styles.timeTag,
                isMe ? styles.myTimeTag : styles.theirTimeTag,
              ]}>
              {time}
            </Text>
            {isMe && (
              <Icon
                name="checkmark-done"
                size={14}
                color="rgba(255,255,255,0.6)"
                style={{marginLeft: 4}}
              />
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        
        <ImageBackground 
          source={require('../../assets/images/chat_bg.png')} 
          style={StyleSheet.absoluteFill}
          imageStyle={styles.wallpaperImage}
          resizeMode="repeat"
        >
          <View style={styles.wallpaperOverlay} />
        </ImageBackground>

        <SafeAreaView style={styles.headerGlass}>
          <View style={styles.headerContent}>
            {/* BACK BUTTON */}
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Conversations')}
              style={styles.backBtn}
              activeOpacity={0.7}>
              <Icon name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>

            {/* PROFILE INFO */}
            <View style={styles.headerProfile}>
              <View style={styles.headerAvatar}>
                {shopLogo ? (
                  <Image source={{uri: shopLogo}} style={styles.headerAvatarImg} />
                ) : otherUser?.avatar ? (
                  <Image source={{uri: otherUser.avatar}} style={styles.headerAvatarImg} />
                ) : (
                  <Text style={styles.headerAvatarTxt}>
                    {(shopName || otherUser?.name)?.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              
              <View style={styles.headerTitleContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName} numberOfLines={1} ellipsizeMode="tail">
                    {otherUser?.role === Role.ADMIN ? 'Velto Support Team' : (shopName || otherUser?.name)}
                  </Text>
                  {otherUser?.role && otherUser.role !== Role.ADMIN && (
                    <View style={[
                      styles.roleBadge,
                      {backgroundColor: (otherUser?.role === Role.SELLER || otherUser?.role === Role.SHOP_OWNER) ? '#3B82F6' : '#10B981'}
                    ]}>
                      <Text style={styles.roleText}>
                        {otherUser?.role === Role.RIDER ? 'DELIVERY PARTNER' :
                         (otherUser?.role === Role.SELLER || otherUser?.role === Role.SHOP_OWNER) ? 'MERCHANT' : 'BUYER'}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.productStatus}>
                  <View style={styles.indicatorPulse} />
                  <Text style={styles.productLink} numberOfLines={1}>
                    Discussing: {productTitle}
                  </Text>
                </View>
              </View>
            </View>

            {/* ACTION BUTTON — only shown when chat is about a product */}
            {route.params.productId ? (
              <TouchableOpacity
                style={styles.headerAction}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ProductDetail', {id: route.params.productId!})}>
                <Icon name="information-circle" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{width: 44}} />
            )}
          </View>
        </SafeAreaView>

        {order && (
          <Animated.View entering={FadeInDown} style={styles.premiumOrderBanner}>
            <View style={styles.bannerMain}>
              <View style={styles.bannerIconBox}>
                <Icon name="receipt" size={20} color={theme.colors.primary} />
              </View>
               <View style={styles.orderBannerText}>
                  <Text style={styles.orderBannerTitle}>
                    Order #{order._id.slice(-6).toUpperCase()} • {getStatusDisplay(order.status).label.toUpperCase()}
                  </Text>
                  <Text style={styles.orderBannerSub}>
                    {order.status === OrderStatus.IN_TRANSIT && "Express delivery is on its way to you!"}
                    {order.status === OrderStatus.DELIVERED && "Arrived! Please share the OTP with the rider."}
                    {order.status === OrderStatus.COMPLETED && "Order successfully delivered. Enjoy!"}
                    {order.status === OrderStatus.CANCELLED && "This order was cancelled."}
                  </Text>
               </View>
               
               {/* CONTEXTUAL ACTION HUB */}
               <View style={styles.orderActions}>
                 {user?.role === Role.ADMIN && order.status === 'payment_under_review' && (
                   <TouchableOpacity 
                     style={[styles.actionBtn, {backgroundColor: theme.colors.success}]}
                     onPress={async () => {
                       try {
                          await axiosInstance.patch(`/api/orders/${order._id}/status`, { status: 'confirmed' });
                       } catch (err) { console.log(err); }
                     }}>
                     <Text style={styles.actionBtnText}>APPROVE</Text>
                   </TouchableOpacity>
                 )}

                 {user?.role === Role.RIDER && order.status === 'confirmed' && (
                   <TouchableOpacity 
                     style={[styles.actionBtn, {backgroundColor: theme.colors.primary}]}
                     onPress={async () => {
                       try {
                          await axiosInstance.patch(`/api/orders/${order._id}/status`, { status: 'picked_up' });
                       } catch (err) { console.log(err); }
                     }}>
                     <Text style={styles.actionBtnText}>PICKED UP</Text>
                   </TouchableOpacity>
                 )}

                 {user?.role === Role.BUYER && order.status === 'ready_for_pickup' && (
                   <TouchableOpacity 
                     style={[styles.actionBtn, {backgroundColor: theme.colors.accent}]}
                     onPress={() => {
                       require('react-native').Alert.alert('Pickup Handshake', `Your pickup code is: ${order.pickupCode}. Show this to the seller to collect your items.`);
                     }}>
                     <Text style={styles.actionBtnText}>CODE</Text>
                   </TouchableOpacity>
                 )}

                 <TouchableOpacity 
                    style={styles.orderViewBtn}
                    onPress={() => {
                       if (user?.role === Role.RIDER) (navigation as any).navigate('RiderTab');
                       else if (user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) (navigation as any).navigate('DashboardTab', { screen: 'SellerOrders' });
                       else (navigation as any).navigate('ProfileTab', { screen: 'OrderHistory' });
                    }}>
                    <Icon name="eye-outline" size={14} color={theme.colors.white} />
                 </TouchableOpacity>
               </View>
            </View>

            {/* VISUAL PROGRESS STEPPER */}
            <OrderProgressStepper 
              status={order.status} 
              fulfillmentMethod={order.fulfillmentMethod} 
            />
          </Animated.View>
        )}

        {fetching ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatlistRef}
            data={messages}
            keyExtractor={item => item._id || ''}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatlistRef.current?.scrollToEnd({animated: true})
            }
            onEndReached={loadMoreMessages}
            onEndReachedThreshold={0.1}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {loadingMore && (
                  <ActivityIndicator
                    color={theme.colors.primary}
                    style={{marginVertical: 8}}
                  />
                )}
                <View style={styles.auditInfo}>
                  <Icon name="shield-checkmark" size={14} color={theme.colors.success} />
                  <Text style={styles.auditText}>End-to-End Encrypted Session</Text>
                </View>
              </>
            }
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingIndicator}>
                  <View style={styles.typingPulse} />
                  <Text style={styles.typingText}>{typingUser} is typing...</Text>
                </View>
              ) : null
            }
          />
        )}

        {recording && (
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording… {recordSecs}s</Text>
            <Text style={styles.recordingHint}>Release to send</Text>
          </View>
        )}

        <View style={styles.composerWrapper}>
          <View style={styles.composerInner}>
            <TouchableOpacity style={styles.composerAdd} activeOpacity={0.7} onPress={handleAttachment}>
              <Icon name="add-circle" size={26} color={theme.colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              value={text}
              onChangeText={(val) => {
                setText(val);
                if (socket && isConnected) {
                  socket.emit(SocketEvent.TYPING, {conversationId, userId: user?._id});
                }
              }}
              placeholder="Type your message..."
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            {text.trim() ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <TouchableOpacity
                  style={styles.composerSend}
                  onPress={sendMessage}
                  activeOpacity={0.8}>
                  <Icon name="paper-plane" size={18} color={theme.colors.white} />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <TouchableOpacity
                style={[styles.composerMic, recording && styles.composerMicActive]}
                onPressIn={startRecording}
                onPressOut={stopAndSendRecording}
                activeOpacity={0.8}>
                <Icon name="mic" size={22} color={recording ? theme.colors.white : theme.colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 8,
    marginRight: 4,
  },
  wallpaperOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F1F5F9', 
    opacity: 0.85, // More subtle overlay to let the pattern breathe
  },
  wallpaperImage: {
    opacity: 0.1, // Very subtle pattern
  },
  headerGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    zIndex: 10,
    ...theme.shadow.sm,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarTxt: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  headerAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  headerTitleContainer: {flex: 1},
  displayName: {fontSize: 16, fontWeight: '900', color: theme.colors.text, marginRight: 6},
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  productStatus: {flexDirection: 'row', alignItems: 'center', marginTop: 2},
  indicatorPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  productLink: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '700',
    maxWidth: width * 0.4,
  },
  loaderContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  messageList: {paddingHorizontal: 20, paddingBottom: 32},
  auditInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 24,
    backgroundColor: '#F0FDF4',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  auditText: {
    fontSize: 10,
    color: '#166534',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  messageWrapper: {marginBottom: 12, maxWidth: '82%'},
  myMessageWrapper: {alignSelf: 'flex-end'},
  theirMessageWrapper: {alignSelf: 'flex-start'},
  messageCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    ...theme.shadow.sm,
  },
  myCard: {
    backgroundColor: '#0F172A', // Using theme primary directly for depth
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 4,
    ...theme.shadow.md,
  },
  theirCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Glass effect
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    ...theme.shadow.sm,
  },
  msgImage: {width: 220, height: 160, borderRadius: 14},
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    minWidth: 180,
  },
  audioTrack: {flex: 1, gap: 4},
  audioBarBg: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioBarFill: {height: '100%', borderRadius: 2},
  audioDuration: {fontSize: 10, fontWeight: '700'},
  composerMic: {padding: 8, borderRadius: 14},
  composerMicActive: {backgroundColor: '#EF4444', padding: 8, borderRadius: 14},
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {fontSize: 13, fontWeight: '700', color: '#EF4444', flex: 1},
  recordingHint: {fontSize: 11, color: '#9CA3AF', fontWeight: '600'},
  chatText: {fontSize: 15, lineHeight: 22, fontWeight: '600'},
  myChatText: {color: theme.colors.white},
  theirChatText: {color: theme.colors.text},
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  timeTag: {fontSize: 10, fontWeight: '700'},
  myTimeTag: {color: 'rgba(255,255,255,0.6)'},
  theirTimeTag: {color: theme.colors.muted},
  composerWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  composerAdd: {padding: 8},
  composerInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    maxHeight: 120,
    paddingHorizontal: 10,
    fontWeight: '600',
  },
  composerSend: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    ...theme.shadow.sm,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    opacity: 0.6,
  },
  typingText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  premiumOrderBanner: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    ...theme.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.1)',
  },
  bannerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  orderBannerText: {
    flex: 1,
  },
  orderBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E1B4B',
  },
  orderBannerSub: {
    fontSize: 10,
    color: '#6366F1',
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepActive: {
    backgroundColor: theme.colors.primary,
    transform: [{scale: 1.2}],
  },
  stepInactive: {
    backgroundColor: '#CBD5E1',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  lineActive: {
    backgroundColor: theme.colors.primary,
  },
  lineInactive: {
    backgroundColor: '#E2E8F0',
  },
  orderViewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderViewTxt: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.white,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  systemMessageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1.2,
    borderColor: '#F1F5F9',
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  orderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
});