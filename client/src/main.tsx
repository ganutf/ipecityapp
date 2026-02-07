import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@farcaster/auth-kit/styles.css";
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
      console.log('Suppressed WebSocket connection error:', error.message);
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
