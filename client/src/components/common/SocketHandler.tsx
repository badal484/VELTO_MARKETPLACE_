import React, {useEffect, useRef} from 'react';
import {useSocket} from '../../hooks/useSocket';
import {useAuth} from '../../hooks/useAuth';
import {useToast} from '../../hooks/useToast';
import {useNotifications} from '../../context/NotificationContext';
import {Role} from '@shared/types';
import {SocketEvent} from '@shared/constants/socketEvents';

export const SocketHandler: React.FC = () => {
  const {socket, activeConversationId} = useSocket();
  const {refreshUser, user} = useAuth();
  const {showToast} = useToast();
  const {incrementUnreadCount, incrementUnreadChatCount} = useNotifications();

  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (data: { conversationId: string; message: any }) => {
      if (data.conversationId !== activeConversationIdRef.current) {
        incrementUnreadChatCount();
        showToast({
          title: 'New Message',
          message: `From ${data.message.sender?.name || 'User'}`,
          type: 'info',
          duration: 3000,
        });
      }
    };

    const onShopStatus = (data: { isVerified: boolean; message: string; rejectionReason?: string }) => {
      refreshUser();
      showToast({
        title: data.isVerified ? 'Verification Success' : 'Shop Update',
        message: data.isVerified
          ? 'Your shop is now live on Velto!'
          : (data.rejectionReason ? data.rejectionReason : data.message),
        type: data.isVerified ? 'success' : 'info',
        duration: 5000,
      });
    };

    const onNewNotification = (notification: { title: string; message: string }) => {
      incrementUnreadCount();
      showToast({
        title: notification.title,
        message: notification.message,
        type: 'info',
        duration: 4000,
      });
    };

    const onWalletUpdated = () => refreshUser();
    const onUserStateUpdated = () => refreshUser();

    const isSeller = user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER;
    const onPharmacyBroadcast = (_data: {orderId: string}) => {
      if (!isSeller) return;
      showToast({
        title: 'New Pharmacy Order!',
        message: 'A customer needs medicines delivered. Open Broadcasts to accept.',
        type: 'success',
        duration: 6000,
      });
    };

    socket.on('new_message_notification', onNewMessage);
    socket.on('shop_status_update', onShopStatus);
    socket.on('new_notification', onNewNotification);
    socket.on('wallet_updated', onWalletUpdated);
    socket.on('user_state_updated', onUserStateUpdated);
    socket.on(SocketEvent.PHARMACY_ORDER_BROADCAST, onPharmacyBroadcast);

    return () => {
      socket.off('new_message_notification', onNewMessage);
      socket.off('shop_status_update', onShopStatus);
      socket.off('new_notification', onNewNotification);
      socket.off('wallet_updated', onWalletUpdated);
      socket.off('user_state_updated', onUserStateUpdated);
      socket.off(SocketEvent.PHARMACY_ORDER_BROADCAST, onPharmacyBroadcast);
    };
  }, [socket, user?.role]);

  return null;
};
