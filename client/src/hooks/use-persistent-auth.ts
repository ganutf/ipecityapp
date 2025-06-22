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
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      console.log('Checking localStorage:', stored);
      
      if (stored) {
        const authData = JSON.parse(stored);
        const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        
        console.log('Parsed auth data:', { authData, isExpired });
        
        if (!isExpired && authData.fid) {
          console.log('Restoring profile from localStorage:', authData.fid);
          setRestoredProfile(authData);
        } else {
          console.log('Auth data expired, removing');
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } else {
        console.log('No stored auth data found');
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
      
      console.log('Saving to localStorage:', authData);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      setRestoredProfile(authData);
    }
  }, [kitAuth, kitProfile]);

  // Don't clear localStorage on page refresh - only on explicit logout
  useEffect(() => {
    // Only clear if we explicitly detect a logout action
    // We'll handle this in the logout button instead
  }, []);

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  const profile = kitProfile || restoredProfile;

  // Debug logging
  console.log('Auth Debug:', {
    kitAuth,
    kitProfile: !!kitProfile,
    restoredProfile: !!restoredProfile,
    isInitialized,
    finalAuth: isAuthenticated,
    profileFid: profile?.fid
  });

  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized
  };
}