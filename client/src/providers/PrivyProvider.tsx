import { PrivyProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';

interface AppPrivyProviderProps {
  children: React.ReactNode;
}

export function AppPrivyProvider({ children }: AppPrivyProviderProps) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;

  if (!appId) {
    console.warn('VITE_PRIVY_APP_ID not set - Privy auth disabled');
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#A2D729', // IpêCity green
          logo: '/logo.png',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        loginMethods: ['email', 'wallet'], // Google OAuth disabled in Privy app settings
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
