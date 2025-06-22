import { useEffect, useState } from 'react';
import { useProfile } from '@farcaster/auth-kit';

interface StoredAuthData {
  profile: any;
  isAuthenticated: boolean;
  timestamp: number;
}

const AUTH_STORAGE_KEY = 'farcaster_auth_data';
const AUTH_EXPIRY_HOURS = 24;

export function usePersistentAuth() {
  const { isAuthenticated, profile } = useProfile();
  const [isLoading, setIsLoading] = useState(true);
  const [restoredAuth, setRestoredAuth] = useState<StoredAuthData | null>(null);

  // Save auth data to localStorage when authenticated
  useEffect(() => {
    if (isAuthenticated && profile) {
      const authData: StoredAuthData = {
        profile,
        isAuthenticated: true,
        timestamp: Date.now()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setRestoredAuth(authData);
    }
  }, [isAuthenticated, profile]);

  // Restore auth data on app load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const authData: StoredAuthData = JSON.parse(stored);
        const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        if (!isExpired) {
          setRestoredAuth(authData);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to restore auth data:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear stored data when logged out
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setRestoredAuth(null);
    }
  }, [isAuthenticated, isLoading]);

  const effectiveAuth = {
    isAuthenticated: isAuthenticated || (restoredAuth?.isAuthenticated && !isLoading),
    profile: profile || restoredAuth?.profile,
    isLoading
  };

  return effectiveAuth;
}