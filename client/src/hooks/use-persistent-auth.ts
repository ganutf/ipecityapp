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
    console.log('🚀 Running localStorage restoration effect');
    const restoreAuth = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        console.log('🔍 Checking localStorage on mount:', stored ? 'HAS DATA' : 'NULL');
        console.log('🔍 AUTH_STORAGE_KEY:', AUTH_STORAGE_KEY);
        if (stored) {
          console.log('📄 Raw localStorage data:', stored);
        }
        
        if (stored) {
          const authData = JSON.parse(stored);
          const isExpired = Date.now() - authData.timestamp > AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
          
          console.log('📋 Parsed auth data:', { 
            fid: authData.fid, 
            username: authData.username,
            displayName: authData.displayName,
            isExpired 
          });
          
          if (!isExpired && authData.fid) {
            console.log('✅ Restoring auth from localStorage:', {
              fid: authData.fid,
              username: authData.username,
              displayName: authData.displayName
            });
            setRestoredProfile(authData);
            return true;
          } else {
            console.log('❌ Auth data expired, removing');
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } else {
          console.log('🆕 No stored auth data found');
        }
      } catch (error) {
        console.error('💥 Failed to restore auth data:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
      return false;
    };

    restoreAuth();
    setIsInitialized(true);
  }, []);

  // Save to localStorage when AuthKit authentication succeeds  
  useEffect(() => {
    console.log('🎯 AuthKit effect running');
    console.log('🎯 AuthKit state changed:', { kitAuth, kitProfile: !!kitProfile, fid: kitProfile?.fid });
    
    if (kitAuth && kitProfile?.fid) {
      const authData: StoredAuthData = {
        fid: kitProfile.fid,
        username: kitProfile.username,
        displayName: kitProfile.displayName,
        pfpUrl: kitProfile.pfpUrl,
        custodyAddress: kitProfile.custodyAddress,
        timestamp: Date.now()
      };
      
      console.log('💾 Saving auth to localStorage:', {
        fid: authData.fid,
        username: authData.username,
        displayName: authData.displayName
      });
      
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        console.log('💾 Save successful');
        
        // Immediate verification
        const verify = localStorage.getItem(AUTH_STORAGE_KEY);
        if (verify) {
          console.log('✅ Verification successful');
          setRestoredProfile(authData);
        } else {
          console.error('❌ Verification failed');
        }
      } catch (error) {
        console.error('💥 localStorage save error:', error);
      }
    }
  }, [kitAuth, kitProfile]);

  // Determine effective authentication state
  const isAuthenticated = kitAuth || (!!restoredProfile && isInitialized);
  const profile = kitProfile || restoredProfile;

  // Debug logging
  const debugInfo = {
    kitAuth,
    kitProfile: !!kitProfile,
    restoredProfile: !!restoredProfile,
    isInitialized,
    finalAuth: isAuthenticated,
    profileFid: profile?.fid,
    profileName: profile?.displayName || profile?.username
  };
  console.log('🔐 Auth State:', debugInfo);

  return {
    isAuthenticated,
    profile,
    isLoading: !isInitialized
  };
}

// Export logout function to be used in components
export function logout() {
  console.log('🚪 Explicit logout triggered');
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Force a page reload to clear all state
  window.location.href = window.location.origin;
}