import { useEffect, useState } from 'react';
import { useProfile } from '@farcaster/auth-kit';

interface StoredAuthData {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  custodyAddress?: string;
  timestamp: number;
  memberStatus?: {
    isMember: boolean;
    status: string;
    approved: boolean;
    member?: any;
  };
  signerStatus?: string;
}

const AUTH_STORAGE_KEY = 'farcaster_auth_data';
const AUTH_EXPIRY_HOURS = 24 * 7; // 7 days

// Helper functions to update cached member status
export function updateCachedMemberStatus(memberStatus: any) {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const authData = JSON.parse(stored);
      authData.memberStatus = memberStatus;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    }
  } catch (error) {
    console.error('Failed to update cached member status:', error);
  }
}

export function updateCachedSignerStatus(signerStatus: string) {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const authData = JSON.parse(stored);
      authData.signerStatus = signerStatus;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    }
  } catch (error) {
    console.error('Failed to update cached signer status:', error);
  }
}

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
        custodyAddress: (kitProfile as any).custodyAddress,
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

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  // Use restoredProfile if kitProfile is empty or if we have valid restored data
  const profile = (kitProfile && kitProfile.fid) ? kitProfile : restoredProfile;
  


  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized,
    cachedMemberStatus: restoredProfile?.memberStatus,
    cachedSignerStatus: restoredProfile?.signerStatus
  };
}

// Export logout function to be used in components
export function logout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.location.href = window.location.origin;
}