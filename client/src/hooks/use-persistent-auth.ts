import { useEffect, useState } from 'react';

interface StoredAuthData {
  profile: any;
  isAuthenticated: boolean;
  timestamp: number;
}

const AUTH_STORAGE_KEY = 'farcaster_auth_data';
const AUTH_EXPIRY_HOURS = 24;

export function usePersistentAuth() {
  // Since useProfile is causing issues, we'll rely entirely on localStorage for now
  const [authState, setAuthState] = useState<{ isAuthenticated: boolean; profile: any }>({
    isAuthenticated: false,
    profile: null
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing auth data and listen for auth events
  useEffect(() => {
    const checkAuthState = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const authData: StoredAuthData = JSON.parse(stored);
          const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (!isExpired) {
            setAuthState({
              isAuthenticated: authData.isAuthenticated,
              profile: authData.profile
            });
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setAuthState({ isAuthenticated: false, profile: null });
          }
        }
      } catch (error) {
        console.error('Failed to restore auth data:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState({ isAuthenticated: false, profile: null });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthState();

    // Listen for auth events from AuthKit (simplified approach)
    const handleStorageChange = () => {
      checkAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    isAuthenticated: authState.isAuthenticated,
    profile: authState.profile,
    isLoading
  };
}