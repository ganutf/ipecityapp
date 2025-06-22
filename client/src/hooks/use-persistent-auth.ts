import { useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  profile: any;
}

export function usePersistentAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    profile: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simple check for existing data
    const checkAuth = () => {
      try {
        // Check if there's any stored auth data
        const stored = localStorage.getItem('farcaster_auth_data');
        if (stored) {
          const data = JSON.parse(stored);
          setAuthState({
            isAuthenticated: true,
            profile: data.profile || data
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for auth events from window
    const handleAuthSuccess = (event: any) => {
      if (event.detail?.userData) {
        const userData = event.detail.userData;
        localStorage.setItem('farcaster_auth_data', JSON.stringify({
          profile: userData,
          timestamp: Date.now()
        }));
        setAuthState({
          isAuthenticated: true,
          profile: userData
        });
      }
    };

    // Listen for multiple auth event types
    window.addEventListener('authkit:createAccount.success', handleAuthSuccess);
    window.addEventListener('authkit:signIn.success', handleAuthSuccess);
    
    return () => {
      window.removeEventListener('authkit:createAccount.success', handleAuthSuccess);
      window.removeEventListener('authkit:signIn.success', handleAuthSuccess);
    };
  }, []);

  return {
    isAuthenticated: authState.isAuthenticated,
    profile: authState.profile,
    isLoading
  };
}