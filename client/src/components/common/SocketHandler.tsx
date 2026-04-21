import React, {useEffect} from 'react';
import {Alert} from 'react-native';
import {useSocket} from '../../hooks/useSocket';
import {useAuth} from '../../hooks/useAuth';
import {useToast} from '../../hooks/useToast';
import {useNotifications} from '../../context/NotificationContext';

/**
 * SocketHandler is a global listener for server-emitted events.
 * It remains mounted throughout the app session to handle real-time notifications.
 */
export const SocketHandler: React.FC = () => {
  const {socket, activeConversationId} = useSocket();
  const {refreshUser} = useAuth();
  const {showToast} = useToast();
  const {incrementUnreadCount, incrementUnreadChatCount} = useNotifications();

  useEffect(() => {
    if (!socket) return;

    // Listen for new chat messages
    socket.on('new_message_notification', (data: { conversationId: string; message: any }) => {
      // Logic: Only increment badge if NOT currently viewing this specific chat
      if (data.conversationId !== activeConversationId) {
        incrementUnreadChatCount();
        
        showToast({
          message: `New message from ${data.message.sender?.name || 'User'}`,
          type: 'info',
          duration: 3000,
        });
      }
    });

    // Listen for shop approval/rejection events
    socket.on('shop_status_update', (data: { 
      isVerified: boolean; 
      message: string; 
      rejectionReason?: string 
    }) => {
      refreshUser();
      
      showToast({
        message: data.isVerified 
          ? '🎉 Shop Approved! You are now live.' 
          : (data.rejectionReason ? `Shop Update: ${data.rejectionReason}` : data.message),
        type: data.isVerified ? 'success' : 'info',
        duration: 5000,
      });
    });

    // Listen for new general notifications
    socket.on('new_notification', (notification: {
      title: string;
      message: string;
    }) => {
      incrementUnreadCount();
      
      showToast({
        message: `${notification.title}: ${notification.message}`,
        type: 'info',
        duration: 4000,
      });
    });

    // Utility updates
    socket.on('wallet_updated', () => refreshUser());
    socket.on('user_state_updated', () => refreshUser());

    return () => {
      socket.off('new_message_notification');
      socket.off('shop_status_update');
      socket.off('new_notification');
      socket.off('wallet_updated');
      socket.off('user_state_updated');
    };
  }, [socket, refreshUser, activeConversationId]);

  return null; // This component doesn't render any UI itself
};
