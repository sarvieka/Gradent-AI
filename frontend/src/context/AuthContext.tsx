import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../services/authApi';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const currentUser = await authApi.getMe();
        if (isMounted) {
          setUser(currentUser);
        }
      } catch {
        if (isMounted) {
          setUser(null);
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
    const res = await authApi.login({ email, password });
    setUser(res.user);
  };

  const signup = async (fullName: string, email: string, password: string) => {
    const res = await authApi.signup({ full_name: fullName, email, password });
    setUser(res.user);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateProfile = async (fullName: string) => {
    const updated = await authApi.updateProfile({ full_name: fullName });
    setUser(updated);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
