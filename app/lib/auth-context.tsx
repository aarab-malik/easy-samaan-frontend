'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from './api-client';

export interface User {
  id: string;
  email: string;
  role: 'customer' | 'shop_owner' | 'rider';
  full_name?: string;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, full_name: string, password: string, role: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearCart = () => {
    localStorage.removeItem('cart');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('cart:update'));
    }
  };

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (accessToken: string) => {
    try {
      const userData = await apiClient.get('/auth/me', accessToken) as {
        user_id?: string;
        id?: string;
        email: string;
        role: 'customer' | 'shop_owner' | 'rider';
        full_name?: string;
        phone?: string | null;
      };
      setUser({
        id: userData.user_id ?? userData.id ?? '',
        email: userData.email,
        role: userData.role,
        full_name: userData.full_name,
        phone: userData.phone,
      });
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      localStorage.removeItem('access_token');
      setToken(null);
      clearCart();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const accessToken = response.access_token;
      setToken(accessToken);
      localStorage.setItem('access_token', accessToken);
      await fetchUser(accessToken);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (email: string, full_name: string, password: string, role: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/register', {
        email,
        full_name,
        password,
        role,
      });
      const accessToken = response.access_token;
      setToken(accessToken);
      localStorage.setItem('access_token', accessToken);
      await fetchUser(accessToken);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('access_token');
    clearCart();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
