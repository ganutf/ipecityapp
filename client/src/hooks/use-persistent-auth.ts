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

  // Initialize and check localStorage immediately on mount
  useEffect(() => {
    const restoreAuth = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        
        if (stored) {
          const authData = JSON.parse(stored);
          const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
          
          if (!isExpired && authData.fid) {
            setRestoredProfile(authData);
            return true;
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return false;
    };

    restoreAuth();
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
      
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        setRestoredProfile(authData);
      } catch (error) {
        console.error('localStorage save error:', error);
      }
    }
  }, [kitAuth, kitProfile]);

  // Clear stored data when AuthKit logs out - but be more careful about auto-logout
  useEffect(() => {
    if (isInitialized && !kitAuth && restoredProfile) {
      // Only clear if we're initialized and AuthKit has definitely logged out
      // and we're sure it's not just a temporary state
      const checkAuthKitLogout = () => {
        if (!kitAuth && !kitProfile?.fid) {
          console.log("usePersistentAuth: AuthKit logged out, clearing restored profile");
          setRestoredProfile(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      };
      
      // Longer delay to avoid clearing during page refreshes
      const timer = setTimeout(checkAuthKitLogout, 1000);
      return () => clearTimeout(timer);
    }
  }, [kitAuth, kitProfile?.fid, restoredProfile, isInitialized]);

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  // Use restoredProfile if kitProfile is empty or if we have valid restored data
  const profile = (kitProfile && kitProfile.fid) ? kitProfile : restoredProfile;
  


  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized
  };
}

// Export logout function to be used in components
export function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Instead of redirecting, just reload the page to reset React state
  window.location.reload();
}