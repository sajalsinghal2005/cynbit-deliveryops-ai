import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, ApiError, setCsrfToken } from '../lib/api';
import type { SafeUserProfile, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<SafeUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Refreshes or validates current session with the backend.
   * Handles 401 Unauthorized gracefully by clearing user state without throwing.
   */
  const refreshUser = useCallback(async (): Promise<SafeUserProfile | null> => {
    try {
      const data = await api.get<{ success: boolean; user?: SafeUserProfile }>('/api/auth/me');
      if (data && data.success && data.user) {
        setUser(data.user);
        return data.user;
      } else {
        setUser(null);
        setCsrfToken(null);
        return null;
      }
    } catch {
      setUser(null);
      setCsrfToken(null);
      return null;
    }
  }, []);

  /**
   * Initializes auth state on startup.
   */
  useEffect(() => {
    let active = true;

    async function initAuth() {
      try {
        const data = await api.get<{ success: boolean; user?: SafeUserProfile }>('/api/auth/me');
        if (active) {
          if (data && data.success && data.user) {
            setUser(data.user);
          } else {
            setUser(null);
            setCsrfToken(null);
          }
        }
      } catch {
        if (active) {
          setUser(null);
          setCsrfToken(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Listen for expired session notifications on application requests.
   */
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setCsrfToken(null);
    };

    window.addEventListener('bizops:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('bizops:session-expired', handleSessionExpired);
    };
  }, []);

  /**
   * Logs in a user with email and password via HTTP-only cookie session.
   * Never stores credentials, tokens, or passwords in localStorage/sessionStorage.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const data = await api.post<{
          success: boolean;
          user: SafeUserProfile;
          csrfToken?: string;
          message?: string;
        }>('/api/auth/login', { email, password });

        if (data.success && data.user) {
          if (data.csrfToken) {
            setCsrfToken(data.csrfToken);
          }
          setUser(data.user);
          setLoading(false);
          return { success: true, message: data.message || 'Login successful' };
        } else {
          return {
            success: false,
            message: data.message || 'Unable to log in. Please check your credentials.',
          };
        }
      } catch (err: any) {
        const message =
          err instanceof ApiError
            ? err.message
            : err?.message || 'Unable to connect to login server. Please try again.';
        return { success: false, message };
      }
    },
    []
  );

  /**
   * Logs out the user by invalidating the server session.
   * Handles already-expired sessions gracefully and ensures real logout failures
   * are not falsely claimed as successful.
   */
  const logout = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      setCsrfToken(null);
      return { success: true, message: 'Logged out successfully.' };
    } catch (err: any) {
      // If the session was already expired on the server (401), invalidation is already complete
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setCsrfToken(null);
        return { success: true, message: 'Session already expired.' };
      }
      // For genuine errors (e.g. CSRF 403, 500, network loss), do not falsely claim success
      const message =
        err instanceof ApiError
          ? err.message
          : err?.message || 'Server logout failed. Please try again.';
      return { success: false, message };
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
