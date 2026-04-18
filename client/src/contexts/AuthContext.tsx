import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePrivy, useIdentityToken, useWallets } from '@privy-io/react-auth';
import { useDisconnect } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setApiAccessToken } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { AuthMeResponse, MemberWithStats } from '@shared/types';

// Check if Privy is configured
const PRIVY_ENABLED = !!import.meta.env.VITE_PRIVY_APP_ID;

interface AuthUser {
  id: string;
  email?: string;
  wallet?: string;
}

interface AccountConflict {
  message: string;
  conflictBy: 'email' | 'wallet';
}

interface AuthContextValue {
  // Privy state
  privyUser: AuthUser | null;
  isPrivyAuthenticated: boolean;
  isPrivyLoading: boolean;
  isPrivyEnabled: boolean;

  // Member state
  member: MemberWithStats | null;
  memberId: number | null;  // Primary identifier for all API calls
  isMember: boolean;
  memberStatus: string | null;
  isMemberLoading: boolean;

  // Conflict state (409 from /auth/me when email/wallet matches a different Privy account)
  accountConflict: AccountConflict | null;

  // Combined state
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: () => void;
  logout: () => Promise<void>;
  refreshMember: () => void;
  getAccessToken: () => Promise<string | null>;
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

// Provider when Privy is NOT enabled - just pass through
function AuthProviderWithoutPrivy({ children }: AuthProviderProps) {
  const value: AuthContextValue = {
    privyUser: null,
    isPrivyAuthenticated: false,
    isPrivyLoading: false,
    isPrivyEnabled: false,
    member: null,
    memberId: null,
    isMember: false,
    memberStatus: null,
    isMemberLoading: false,
    accountConflict: null,
    isAuthenticated: false,
    isLoading: false,
    login: () => console.warn('Privy not configured'),
    logout: async () => {},
    refreshMember: () => {},
    getAccessToken: async () => null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Provider when Privy IS enabled
function AuthProviderWithPrivy({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  // Get identity token (contains full user profile including email)
  const { identityToken } = useIdentityToken();
  const { wallets } = useWallets();
  const { disconnect: disconnectWagmi } = useDisconnect();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accountConflict, setAccountConflict] = useState<AccountConflict | null>(null);

  // Get access token when authenticated and sync to api.ts
  useEffect(() => {
    if (privyAuthenticated && privyReady) {
      getAccessToken().then((token: string | null) => {
        setAccessToken(token);
        setApiAccessToken(token);
      }).catch((err: Error) => {
        console.error('Failed to get Privy access token:', err);
        setAccessToken(null);
        setApiAccessToken(null);
      });
    } else {
      setAccessToken(null);
      setApiAccessToken(null);
    }
  }, [privyAuthenticated, privyReady, getAccessToken]);

  // Query member status from backend when we have a token
  const {
    data: memberData,
    isLoading: memberLoading,
    refetch: refetchMember,
  } = useQuery<AuthMeResponse | null>({
    queryKey: queryKeys.auth.me(accessToken, identityToken),
    queryFn: async () => {
      if (!accessToken) return null;

      const response = await fetch('/api/v2/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          // Include identity token so server can extract email/wallet
          ...(identityToken ? { 'privy-id-token': identityToken } : {}),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setAccountConflict(null);
          return null;
        }
        if (response.status === 409) {
          const body = await response.json().catch(() => ({}));
          if (body?.error === 'ACCOUNT_CONFLICT') {
            setAccountConflict({
              message: body.message || 'Account conflict',
              conflictBy: body.conflictBy === 'wallet' ? 'wallet' : 'email',
            });
            return null;
          }
        }
        throw new Error('Failed to fetch member data');
      }

      setAccountConflict(null);
      return response.json();
    },
    enabled: !!accessToken,
    retry: false,
    staleTime: 30000,
  });

  // Build auth user from Privy data
  const authUser: AuthUser | null = privyUser ? {
    id: privyUser.id,
    email: privyUser.email?.address,
    wallet: privyUser.wallet?.address,
  } : null;

  const handleLogout = async () => {
    // Disconnect all wallets from Privy before logout
    // Prevents stale wallet connections from persisting across sessions
    for (const wallet of wallets) {
      try {
        wallet.disconnect();
      } catch {
        // Some wallets don't support programmatic disconnect
      }
    }

    // Disconnect wagmi connectors as safety net
    try {
      disconnectWagmi();
    } catch {
      // Ignore if no active connection
    }

    await privyLogout();
    setAccessToken(null);
    setApiAccessToken(null);
    setAccountConflict(null);
    queryClient.clear();
  };

  const value: AuthContextValue = {
    privyUser: authUser,
    isPrivyAuthenticated: privyAuthenticated,
    isPrivyLoading: !privyReady,
    isPrivyEnabled: true,
    member: memberData?.member || null,
    memberId: memberData?.memberId || memberData?.member?.id || null,
    isMember: !!memberData?.isMember,
    memberStatus: memberData?.status || null,
    isMemberLoading: memberLoading,
    accountConflict,
    isAuthenticated: privyAuthenticated && !!authUser && !accountConflict,
    isLoading: !privyReady || (privyAuthenticated && memberLoading && !accountConflict),
    login: privyLogin,
    logout: handleLogout,
    refreshMember: refetchMember,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Export the appropriate provider based on Privy configuration
export function AuthProvider({ children }: AuthProviderProps) {
  if (!PRIVY_ENABLED) {
    return <AuthProviderWithoutPrivy>{children}</AuthProviderWithoutPrivy>;
  }
  return <AuthProviderWithPrivy>{children}</AuthProviderWithPrivy>;
}
