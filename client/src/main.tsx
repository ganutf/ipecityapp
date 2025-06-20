import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthKitProvider } from "@farcaster/auth-kit";
import "@farcaster/auth-kit/styles.css";
import "./index.css";

const authConfig = {
  relay: "https://relay.farcaster.xyz",
  rpcUrl: "https://mainnet.optimism.io",
  domain: window.location.hostname,
  siweUri: window.location.origin,
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthKitProvider config={authConfig}>
      <App />
    </AuthKitProvider>
  </React.StrictMode>
);
