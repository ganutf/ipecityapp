import React from "react";
import { createRoot } from "react-dom/client";
// Using App with Privy authentication (RainbowKit removed)
import App from "./App";
import "./index.css";

// Suppress WebSocket/WalletConnect errors that cause popup overlays
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error && typeof error === 'object') {
    if (error.message && (
      error.message.includes('WebSocket connection closed') ||
      error.message.includes('Unauthorized: invalid key') ||
      error.message.includes('Connection interrupted while trying to subscribe')
    )) {
      event.preventDefault();
      if (import.meta.env.DEV) {
        console.debug('[Suppressed WalletConnect error]', error.message);
      }
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
