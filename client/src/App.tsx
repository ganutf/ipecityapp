import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthKitProvider } from "@farcaster/auth-kit";
// Use @privy-io/wagmi for Privy-compatible wagmi integration (no RainbowKit needed)
import { createConfig, WagmiProvider } from "@privy-io/wagmi";
import { mainnet, base } from "viem/chains";
import { http } from "wagmi";
import {
  AuthGuard
} from "@/components/AuthGuard";
import { AuthProvider } from "@/contexts/AuthContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { AppPrivyProvider } from "@/providers/PrivyProvider";
import HomePage from "@/pages/home";
import PulseDashboard from "@/pages/pulse-dashboard";
import AdminPage from "@/pages/admin";
import PulseDetailPage from "@/pages/pulse-detail";
import ProfilePage from "@/pages/profile";
import CommunityPage from "@/pages/community";
import MemberDetailsPage from "@/pages/member-details";
import SignerApprovalPage from "@/pages/signer-approval";
import VerifyPassportPage from "@/pages/verify-passport";
import IdVerificationPage from "@/pages/id-verification";
import ProjectsPage from "@/pages/projects";
import ProjectsNewPage from "@/pages/projects-new";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectEditPage from "@/pages/project-edit";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const authKitConfig = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://optimism.publicnode.com",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

// Privy-compatible wagmi config (createConfig from @privy-io/wagmi)
const wagmiConfig = createConfig({
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
});


function Router() {
  return (
    <Switch>
      {/* Protected routes */}
      <Route>
        <AuthGuard>
          <Layout>
            <Switch>
              <Route
                path="/"
                component={HomePage}
              />
              <Route path="/pulses" component={PulseDashboard} />
              <Route path="/community" component={CommunityPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/pulse/:id" component={PulseDetailPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/member/:id" component={MemberDetailsPage} />
              <Route path="/projects/new" component={ProjectsNewPage} />
              <Route path="/projects/:id/edit" component={ProjectEditPage} />
              <Route path="/projects/:id" component={ProjectDetailPage} />
              <Route path="/projects" component={ProjectsPage} />
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
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <AppPrivyProvider>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <AuthProvider>
            <AuthKitProvider config={authKitConfig}>
              <TimezoneProvider>
                <TooltipProvider>
                  <Toaster />
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                </TooltipProvider>
              </TimezoneProvider>
            </AuthKitProvider>
          </AuthProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </AppPrivyProvider>
  );
}

export default App;
