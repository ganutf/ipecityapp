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
import {
  AuthGuard
} from "@/components/AuthGuard";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import ProfileMockupPage from "@/pages/profile-mockup";
import ProfileOldPage from "@/pages/profile-old";
import SignerApprovalPage from "@/pages/signer-approval";
import VerifyPassportPage from "@/pages/verify-passport";

import IdVerificationPage from "@/pages/id-verification";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import "@rainbow-me/rainbowkit/styles.css";

const authKitConfig = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://optimism.publicnode.com",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo";

const wagmiConfig = getDefaultConfig({
  appName: "Ipê City Pulse",
  projectId,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const justaNameConfig = {
  networks: [
    {
      chainId: mainnet.id,
      providerUrl: "https://eth.blockrazor.xyz",
    },
  ],
  ensDomains: [
    {
      apiKey: import.meta.env.VITE_JUSTANAME_API_KEY,
      chainId: mainnet.id,
      ensDomain: "ipecity.eth",
    },
  ],
  config: {
    domain: window.location.origin,
    origin: window.location.origin,
    subnameChallengeTtl: 600000,
  },
};

function Router() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route
            path="/"
            component={FarcasterEmbed}
          />
          <Route path="/admin" component={AdminPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/profile-mockup" component={ProfileMockupPage} />
          <Route path="/profile-old" component={ProfileOldPage} />
          <Route path="/signer-approval" component={SignerApprovalPage} />

          <Route path="/id-verification" component={IdVerificationPage} />
          <Route
            path="/verify-passport/:token"
            component={VerifyPassportPage}
          />
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
