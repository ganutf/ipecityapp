import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Member } from '@shared/schema';

interface AuthUser {
  id: string;
  email?: string;
  wallet?: string;
}

interface AuthContextValue {
  // Privy state
  privyUser: AuthUser | null;
  isPrivyAuthenticated: boolean;
  isPrivyLoading: boolean;

  // Member state
  member: Member | null;
  isMember: boolean;
  memberStatus: string | null;
  isMemberLoading: boolean;

  // Combined state
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: () => void;
  logout: () => Promise<void>;
  refreshMember: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get access token when authenticated
  useEffect(() => {
    if (privyAuthenticated && privyReady) {
      getAccessToken().then(token => {
        setAccessToken(token);
      }).catch(err => {
        console.error('Failed to get Privy access token:', err);
        setAccessToken(null);
      });
    } else {
      setAccessToken(null);
    }
  }, [privyAuthenticated, privyReady, getAccessToken]);

  // Query member status from backend when we have a token
  const {
    data: memberData,
    isLoading: memberLoading,
    refetch: refetchMember,
  } = useQuery({
    queryKey: ['/api/v2/auth/me', accessToken],
    queryFn: async () => {
      if (!accessToken) return null;

      const response = await fetch('/api/v2/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch member data');
      }

      return response.json();
    },
    enabled: !!accessToken,
    retry: false,
    staleTime: 30000, // 30 seconds
  });

  // Build auth user from Privy data
  const authUser: AuthUser | null = privyUser ? {
    id: privyUser.id,
    email: privyUser.email?.address,
    wallet: privyUser.wallet?.address,
  } : null;

  const handleLogout = async () => {
    await privyLogout();
    setAccessToken(null);
    queryClient.clear();
  };

  const value: AuthContextValue = {
    // Privy state
    privyUser: authUser,
    isPrivyAuthenticated: privyAuthenticated,
    isPrivyLoading: !privyReady,

    // Member state
    member: memberData?.member || null,
    isMember: !!memberData?.isMember,
    memberStatus: memberData?.status || null,
    isMemberLoading: memberLoading,

    // Combined state
    isAuthenticated: privyAuthenticated && !!authUser,
    isLoading: !privyReady || (privyAuthenticated && memberLoading),

    // Actions
    login: privyLogin,
    logout: handleLogout,
    refreshMember: refetchMember,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
