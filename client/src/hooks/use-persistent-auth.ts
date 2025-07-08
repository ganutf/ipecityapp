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

  // Clear stored data when AuthKit logs out
  useEffect(() => {
    if (isInitialized && !kitAuth && restoredProfile) {
      // Only clear if we're initialized and AuthKit has logged out
      // but we still have restored profile data
      const checkAuthKitLogout = () => {
        if (!kitAuth && !kitProfile?.fid) {
          setRestoredProfile(null);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      };
      
      // Small delay to ensure AuthKit state has settled
      const timer = setTimeout(checkAuthKitLogout, 100);
      return () => clearTimeout(timer);
    }
  }, [kitAuth, kitProfile?.fid, restoredProfile, isInitialized]);

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  // Use restoredProfile if kitProfile is empty or if we have valid restored data
  const profile = (kitProfile && kitProfile.fid) ? kitProfile : restoredProfile;
  
  // Debug logging
  console.log("usePersistentAuth DEBUG:", {
    isInitialized,
    kitAuth,
    kitProfile: kitProfile?.fid ? `FID: ${kitProfile.fid}` : "No kitProfile",
    restoredProfile: restoredProfile?.fid ? `FID: ${restoredProfile.fid}` : "No restoredProfile",
    isAuthenticated,
    isLoading: !isInitialized
  });

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