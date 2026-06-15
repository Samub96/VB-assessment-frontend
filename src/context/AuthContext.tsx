import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createApiClient, parseAuthUser } from '../lib/api';
import type { AuthUser, LoginRequest, Role } from '../types';
import type { ReactNode } from 'react';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (role: Role) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const logout = () => {
    setUser(null);
  };

  const apiClient = useMemo(
    () =>
      createApiClient({
        getToken: () => user?.token ?? null,
        onUnauthorized: () => {
          logout();
        }
      }),
    [user]
  );

  const login = async ({ email, password }: LoginRequest) => {
    const response = await apiClient.login({ email, password });
    const nextUser = parseAuthUser(email, response);
    setUser(nextUser);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      hasRole: (role) => user?.role === role
    }),
    [isLoading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}