import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthKitProvider } from "@farcaster/auth-kit";
import FarcasterEmbed from "@/pages/farcaster-embed";
import AdminPage from "@/pages/admin";
import PulseListPage from "@/pages/pulse-list";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";

const config = {
  rpcUrl: "https://mainnet.optimism.io",
  domain: "ipecity-pulse.replit.app",
  siweUri: "https://ipecity-pulse.replit.app/login",
};

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={FarcasterEmbed} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/pulses" component={PulseListPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
