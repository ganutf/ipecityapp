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
    console.log("usePersistentAuth: Initializing, checking localStorage...");
    const restoreAuth = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        console.log("usePersistentAuth: Stored data found:", !!stored);
        
        if (stored) {
          const authData = JSON.parse(stored);
          const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
          console.log("usePersistentAuth: Parsed data:", { fid: authData.fid, age: (Date.now() - authData.timestamp) / 1000 / 60, maxMinutes: AUTH_EXPIRY_HOURS * 60 });
          
          if (!isExpired && authData.fid) {
            console.log("usePersistentAuth: Restoring valid session data");
            setRestoredProfile(authData);
            return true;
          } else {
            console.log("usePersistentAuth: Session expired, removing");
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("usePersistentAuth: Error restoring auth:", error);
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

  // More conservative logout detection - only clear on explicit logout
  useEffect(() => {
    // Don't auto-clear on navigation - only manual logout should clear storage
    // This prevents premature logout during page refreshes and navigation
    if (isInitialized && !kitAuth && !kitProfile?.fid && restoredProfile) {
      console.log("usePersistentAuth: AuthKit has no data but we have restored profile, maintaining session");
      // Keep the restored profile - don't clear automatically
    }
  }, [kitAuth, kitProfile?.fid, restoredProfile, isInitialized]);

  // Determine effective authentication state - prioritize restored data for stability
  const hasValidRestoredProfile = restoredProfile && restoredProfile.fid && isInitialized;
  const hasValidKitProfile = kitProfile && kitProfile.fid;
  
  const isAuthenticated = kitAuth || hasValidRestoredProfile;
  
  // Always prefer restored profile if available, as it's more stable during navigation
  const profile = hasValidRestoredProfile ? restoredProfile : (hasValidKitProfile ? kitProfile : null);
  
  // Debug logging to understand state changes
  console.log("usePersistentAuth state:", {
    kitAuth,
    kitProfileFid: kitProfile?.fid,
    restoredProfileFid: restoredProfile?.fid,
    isInitialized,
    finalProfile: profile?.fid,
    isAuthenticated,
    hasValidRestoredProfile,
    hasValidKitProfile
  });
  


  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized
  };
}

// Export logout function to be used in components
export function logout() {
  console.log("logout: Explicitly clearing all auth data");
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Force full page reload to reset all React state and AuthKit
  window.location.href = "/";
}