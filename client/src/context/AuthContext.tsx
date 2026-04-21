import React, {createContext, useState, useEffect, useCallback} from 'react';
import * as Keychain from 'react-native-keychain';
import {axiosInstance} from '../api/axiosInstance';
import {tokenStore} from '../api/tokenStore';
import {IUser} from '@shared/types';

interface AuthContextType {
  user: IUser | null;
  isLoading: boolean;
  login: (token: string, userData: IUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<IUser>) => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  // Load token from Keychain ONCE on startup, then keep it in memory
  useEffect(() => {
    const loadUser = async () => {
      try {
        const credentials = await Keychain.getGenericPassword();
        if (credentials) {
          tokenStore.set(credentials.password);
          const res = await axiosInstance.get('/api/auth/me');
          if (res.data.success) {
            setUser(res.data.data);
          } else {
            await performLogout();
          }
        }
      } catch {
        await performLogout();
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const performLogout = async () => {
    tokenStore.clear();
    await Keychain.resetGenericPassword();
    setUser(null);
  };

  const logout = useCallback(async () => {
    await performLogout();
  }, []);

  const login = useCallback(async (token: string, userData: IUser) => {
    tokenStore.set(token);
    await Keychain.setGenericPassword('token', token);
    setUser(userData);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/api/auth/me');
      if (res.data.success) setUser(res.data.data);
    } catch {
      // silent — keep existing user state
    }
  }, []);

  const updateUser = useCallback((data: Partial<IUser>) => {
    setUser(prev => (prev ? {...prev, ...data} : null));
  }, []);

  return (
    <AuthContext.Provider value={{user, isLoading, login, logout, updateUser, refreshUser}}>
      {children}
    </AuthContext.Provider>
  );
};