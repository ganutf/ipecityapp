import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { NeynarContextProvider, Theme } from "@neynar/react";
import "@farcaster/auth-kit/styles.css";
import "@neynar/react/dist/style.css";
import "./index.css";

const authConfig = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

const neynarClientId = import.meta.env.VITE_NEYNAR_CLIENT_ID || "";

createRoot(document.getElementById("root")!).render(
  <NeynarContextProvider
    settings={{
      clientId: neynarClientId,
      defaultTheme: Theme.Light,
    }}
  >
    <AuthKitProvider config={authConfig}>
      <App />
    </AuthKitProvider>
  </NeynarContextProvider>
);
