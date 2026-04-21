import React, {createContext, useEffect, useState} from 'react';
import {io, Socket} from 'socket.io-client';
import {Platform} from 'react-native';
import {useAuth} from '../hooks/useAuth';

interface SocketContextData {
  socket: Socket | null;
  isConnected: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

export const SocketContext = createContext<SocketContextData>({
  socket: null,
  isConnected: false,
  activeConversationId: null,
  setActiveConversationId: () => {},
});

export const SocketProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const {user, refreshUser, logout} = useAuth();

  useEffect(() => {
    const DEV_IP = '10.20.16.181';
    const BASE_URL = `http://${DEV_IP}:5001`;
    // Using hardcoded URL to rule out react-native-config issues
    const newSocket = io(BASE_URL);

    newSocket.on('connect', () => {
      setIsConnected(true);
      if (user?._id) {
        newSocket.emit('join_user', user._id);
      }
    });

    newSocket.on('force_logout', (data: { message: string }) => {
       require('react-native').Alert.alert('Session Terminated', data.message || 'Account restricted.');
       logout();
    });

    // Real-time Status Syncing
    newSocket.on('shop_status_update', (data) => {
      console.log('--- Real-time Shop Status Update ---', data);
      refreshUser();
    });

    newSocket.on('rider_status_update', (data) => {
      console.log('--- Real-time Rider Status Update ---', data);
      refreshUser();
    });

    newSocket.on('user_state_updated', (data) => {
      console.log('--- Global User State Update ---', data);
      refreshUser();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?._id]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeConversationId,
        setActiveConversationId,
      }}>
      {children}
    </SocketContext.Provider>
  );
};