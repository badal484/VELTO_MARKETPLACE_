import React, {createContext, useState, useEffect, useContext, useCallback} from 'react';
import {axiosInstance} from '../api/axiosInstance';
import {useAuth} from '../hooks/useAuth';
import {useSocket} from '../hooks/useSocket';
import {SocketEvent} from '@shared/constants/socketEvents';
import {FCMService} from '../services/FCMService';

interface NotificationContextType {
  unreadCount: number;
  unreadChatCount: number;
  fetchUnreadCount: () => Promise<void>;
  fetchUnreadChatCount: () => Promise<void>;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  resetUnreadCount: () => void;
  resetUnreadChatCount: () => void;
  incrementUnreadChatCount: () => void;
  totalUnreadCount: number;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  unreadChatCount: 0,
  fetchUnreadCount: async () => {},
  fetchUnreadChatCount: async () => {},
  incrementUnreadCount: () => {},
  decrementUnreadCount: () => {},
  resetUnreadCount: () => {},
  resetUnreadChatCount: () => {},
  incrementUnreadChatCount: () => {},
  totalUnreadCount: 0,
  markConversationAsRead: async () => {},
});

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const {user} = useAuth();
  const {socket, isConnected, activeConversationId} = useSocket();

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get('/api/notifications/unread-count');
      if (res.data.success) {
        setUnreadCount(res.data.data);
      }
    } catch (error) {
      console.log('Error fetching unread count:', error);
    }
  }, [user]);

  const fetchUnreadChatCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get('/api/chat/unread-count');
      if (res.data.success) {
        setUnreadChatCount(res.data.data);
      }
    } catch (error) {
      console.log('Error fetching unread chat count:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      fetchUnreadChatCount();
      
      // Phase 4: Push Notification Handshake (Temporarily disabled for stability - Re-enable after native rebuild)
      // FCMService.registerDevice();

      // Listen for foreground push notifications
      /*
      const unsubscribe = FCMService.listenForMessages(() => {
        setUnreadCount(prev => prev + 1);
      });
      return () => unsubscribe();
      */
    } else {
      setUnreadCount(0);
      setUnreadChatCount(0);
    }
  }, [user, fetchUnreadCount, fetchUnreadChatCount]);

  useEffect(() => {
    if (socket && isConnected) {
      // 1. Real-time Message Badges
      socket.on(SocketEvent.NEW_MESSAGE_NOTIFICATION, (data: { conversationId: string }) => {
        // Only increment if we are NOT currently in this conversation
        if (activeConversationId !== data.conversationId) {
          setUnreadChatCount(prev => prev + 1);
        }
      });

      // 2. Real-time System/Order Notifications
      socket.on(SocketEvent.ORDER_STATUS_UPDATED, () => {
        setUnreadCount(prev => prev + 1);
      });
      
      socket.on(SocketEvent.NEW_ORDER_FOR_SELLER, () => {
        setUnreadCount(prev => prev + 1);
      });
    }

    return () => {
      if (socket) {
        socket.off(SocketEvent.NEW_MESSAGE_NOTIFICATION);
        socket.off(SocketEvent.ORDER_STATUS_UPDATED);
        socket.off(SocketEvent.NEW_ORDER_FOR_SELLER);
      }
    };
  }, [socket, isConnected, activeConversationId]);

  const incrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => prev + 1);
  }, []);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const resetUnreadCount = useCallback(async () => {
    try {
      await axiosInstance.patch('/api/notifications/mark-all-read');
      setUnreadCount(0);
    } catch (error) {
      console.log('Error resetting count:', error);
    }
  }, []);

  const resetUnreadChatCount = useCallback(async () => {
    try {
      await axiosInstance.put('/api/chat/read-all');
      setUnreadChatCount(0);
    } catch (error) {
      console.log('Error resetting chat count:', error);
    }
  }, []);

  const incrementUnreadChatCount = useCallback(() => {
    setUnreadChatCount(prev => prev + 1);
  }, []);

  const markConversationAsRead = useCallback(async (conversationId: string) => {
    try {
      await axiosInstance.put(`/api/chat/read/${conversationId}`);
      // Re-fetch counts immediately to ensure visual stability
      fetchUnreadChatCount();
      // Second fetch after a small delay to handle DB propagation lag
      setTimeout(fetchUnreadChatCount, 500);
    } catch (error) {
      console.log('Error marking conversation as read:', error);
    }
  }, [fetchUnreadChatCount]);

  return (
    <NotificationContext.Provider 
      value={{
        unreadCount, 
        unreadChatCount,
        fetchUnreadCount, 
        fetchUnreadChatCount,
        incrementUnreadCount, 
        decrementUnreadCount, 
        resetUnreadCount,
        resetUnreadChatCount,
        incrementUnreadChatCount,
        totalUnreadCount: unreadCount + unreadChatCount,
        markConversationAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
