import React from "react";
import { createRoot } from "react-dom/client";
// Using App with Privy authentication (RainbowKit removed)
import App from "./App";
import "./index.css";

// Suppress WebSocket connection errors that cause popup overlays
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error && typeof error === 'object') {
    // Suppress WebSocket and WalletConnect connection errors
    if (error.message && (
      error.message.includes('WebSocket connection closed') ||
      error.message.includes('Unauthorized: invalid key') ||
      error.message.includes('Connection interrupted while trying to subscribe')
    )) {
      event.preventDefault();
      // Silently suppress known WebSocket/WalletConnect errors
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
