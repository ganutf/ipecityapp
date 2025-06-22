import { useEffect, useState } from 'react';
import { useProfile } from '@farcaster/auth-kit';

interface StoredAuthData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  custodyAddress?: string;
  timestamp: number;
}

interface AuthState {
  isAuthenticated: boolean;
  profile: StoredAuthData | null;
  isLoading: boolean;
}

const AUTH_STORAGE_KEY = 'farcaster_auth_data';
const AUTH_EXPIRY_HOURS = 24 * 7; // 7 days

export function usePersistentAuth(): AuthState {
  const { isAuthenticated: kitAuth, profile: kitProfile } = useProfile();
  const [storedAuth, setStoredAuth] = useState<StoredAuthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth data from localStorage on app load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const authData: StoredAuthData = JSON.parse(stored);
        const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        if (!isExpired && authData.fid) {
          console.log('Restored auth from localStorage:', authData.fid);
          setStoredAuth(authData);
        } else {
          console.log('Stored auth expired, clearing');
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to restore auth data:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    
    // Always set loading false after checking storage
    setIsLoading(false);
  }, []);

  // Save AuthKit data to localStorage when authenticated
  useEffect(() => {
    if (kitAuth && kitProfile?.fid) {
      const authData: StoredAuthData = {
        fid: kitProfile.fid,
        username: kitProfile.username,
        displayName: kitProfile.displayName,
        pfpUrl: kitProfile.pfpUrl,
        custodyAddress: kitProfile.custodyAddress,
        timestamp: Date.now()
      };
      
      console.log('Saving auth to localStorage:', authData.fid);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setStoredAuth(authData);
    }
  }, [kitAuth, kitProfile]);

  // Clear stored data when AuthKit logs out
  useEffect(() => {
    if (kitAuth === false) {
      console.log('AuthKit logged out, clearing localStorage');
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setStoredAuth(null);
    }
  }, [kitAuth]);

  // Determine effective auth state
  const effectiveAuth = {
    isAuthenticated: kitAuth || (!!storedAuth && !isLoading),
    profile: kitProfile || storedAuth,
    isLoading: isLoading
  };

  return effectiveAuth;
}