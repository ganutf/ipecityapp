import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { mainnet } from "wagmi/chains";
import { AuthGuard, RequireAuth, RequireApproval } from "@/components/AuthGuard";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import SignerApprovalPage from "@/pages/signer-approval";
import VerifyPassportPage from "@/pages/verify-passport";
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
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // We'll use a placeholder for now
  chains: [mainnet],
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
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </AuthKitProvider>
  );
}

export default App;
