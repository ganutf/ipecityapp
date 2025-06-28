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
import { AuthGuard, RequireAuth, RequireApproval } from "@/components/AuthGuard";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import SignerApprovalPage from "@/pages/signer-approval";
import VerifyPassportPage from "@/pages/verify-passport";
import EmailVerificationPage from "@/pages/email-verification";
import PassportValidationPage from "@/pages/passport-validation";
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

function Router() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={() => <RequireApproval><FarcasterEmbed /></RequireApproval>} />
          <Route path="/admin" component={() => <RequireApproval><AdminPage /></RequireApproval>} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/signer-approval" component={SignerApprovalPage} />
          <Route path="/email-verification" component={EmailVerificationPage} />
          <Route path="/passport-validation" component={PassportValidationPage} />
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
