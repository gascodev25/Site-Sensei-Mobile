import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser, login as apiLogin, logout as apiLogout, clearSession } from '../api/client';

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string;
  linkedTeamId: number | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const USER_STORAGE_KEY = 'acgworks_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const cached = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
      }
      const fresh = await getCurrentUser();
      setUser(fresh);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      setUser(null);
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    await apiLogin(email, password);
    const userData = await getCurrentUser();
    setUser(userData);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
  }

  async function logout() {
    try {
      await apiLogout();
    } catch {
    }
    setUser(null);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await clearSession();
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
