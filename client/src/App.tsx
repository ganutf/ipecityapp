import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { AuthGuard, RequireAuth, RequireApproval } from "@/components/AuthGuard";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import RegisterPage from "@/pages/register";
import SignerApprovalPage from "@/pages/signer-approval";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";

const config = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

function Router() {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={() => <RequireApproval><FarcasterEmbed /></RequireApproval>} />
          <Route path="/admin" component={() => <RequireApproval><AdminPage /></RequireApproval>} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/signer-approval" component={SignerApprovalPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
}

function App() {
  return (
    <AuthKitProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthKitProvider>
  );
}

export default App;
