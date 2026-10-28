'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setClientToken, getClientToken } from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'project_manager' | 'analyst' | 'viewer';
  organizationId?: string | null;
  organizationName?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and verify authentication on mount (NO auto-login, NO demo data)
  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const token = getClientToken();

      if (!token) {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
          // Redirect to login if on protected route
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/forgot-password')) {
            window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
          }
        }
        return;
      }

      try {
        const userData = await apiFetch<User>('/auth/me');
        if (isMounted) {
          setUser(userData);
        }
      } catch (err) {
        console.warn('[Session Verification Failed]', err);
        if (isMounted) {
          setClientToken(null);
          setUser(null);
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setClientToken(res.accessToken);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network failure on logout
    } finally {
      setClientToken(null);
      setUser(null);
      setIsLoading(false);
      // Immediately redirect to login and prevent back-navigation to cached state
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    }
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
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
