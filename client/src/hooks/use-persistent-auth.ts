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

const AUTH_STORAGE_KEY = 'farcaster_auth_data';
const AUTH_EXPIRY_HOURS = 24 * 7; // 7 days

export function usePersistentAuth() {
  const { isAuthenticated: kitAuth, profile: kitProfile } = useProfile();
  const [restoredProfile, setRestoredProfile] = useState<StoredAuthData | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize and restore from localStorage once on mount
  useEffect(() => {
    let storedAuth: StoredAuthData | null = null;
    
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const authData = JSON.parse(stored);
        const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        if (!isExpired && authData.fid) {
          storedAuth = authData;
          setRestoredProfile(authData);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to restore auth data:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    
    setIsInitialized(true);
  }, []);

  // Save to localStorage when AuthKit authentication succeeds
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
      
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setRestoredProfile(authData);
    }
  }, [kitAuth, kitProfile]);

  // Handle logout - only clear if we know the user actively logged out
  useEffect(() => {
    if (isInitialized && kitAuth === false && !kitProfile && restoredProfile) {
      // Only clear if AuthKit was previously authenticated and now is not
      const hasStoredData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (hasStoredData) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setRestoredProfile(null);
      }
    }
  }, [kitAuth, kitProfile, isInitialized, restoredProfile]);

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  const profile = kitProfile || restoredProfile;

  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized
  };
}