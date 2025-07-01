import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { http } from "wagmi";
import { JustaNameProvider } from "@justaname.id/react";
import { AuthGuard, RequireAuth, RequireApproval } from "@/components/AuthGuard";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import SignerApprovalPage from "@/pages/signer-approval";
import VerifyPassportPage from "@/pages/verify-passport";

import IdVerificationPage from "@/pages/id-verification";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import "@rainbow-me/rainbowkit/styles.css";

const authKitConfig = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

const wagmiConfig = getDefaultConfig({
  appName: 'Ipê City Pulse',
  projectId: 'demo', // Simplified for development
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const justaNameConfig = {
  apiKey: import.meta.env.VITE_JUSTANAME_API_KEY || '',
  networks: [
    {
      chainId: mainnet.id,
      providerUrl: 'https://eth.blockrazor.xyz',
    },
  ],
  ensDomains: [
    {
      chainId: mainnet.id,
      ensDomain: 'ipecity.eth',
    },
  ],
  config: {
    domain: window.location.hostname,
    origin: window.location.origin,
    subnameChallengeTtl: 10 * 60 * 1000, // 10 minutes
  },
};

// Debug: Log API key availability (without exposing the actual key)
console.log('JustaName API Key configured:', !!import.meta.env.VITE_JUSTANAME_API_KEY);
console.log('JustaName config:', { 
  ...justaNameConfig, 
  apiKey: justaNameConfig.apiKey ? '[CONFIGURED]' : '[MISSING]' 
});

function Router() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={() => <RequireApproval><FarcasterEmbed /></RequireApproval>} />
          <Route path="/admin" component={() => <RequireApproval><AdminPage /></RequireApproval>} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/signer-approval" component={SignerApprovalPage} />

          <Route path="/id-verification" component={() => <RequireAuth><IdVerificationPage /></RequireAuth>} />
          <Route path="/verify-passport/:token" component={VerifyPassportPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function App() {
  return (
    <AuthKitProvider config={authKitConfig}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <JustaNameProvider config={justaNameConfig}>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </JustaNameProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

export default App;
