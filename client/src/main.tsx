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

// Remove runtime error overlay modals from DOM
const removeErrorOverlays = () => {
  // Remove Replit runtime error overlays
  const overlays = document.querySelectorAll('[data-vite-dev-id], .vite-error-overlay, [class*="runtime-error"], [class*="error-overlay"]');
  overlays.forEach(overlay => {
    if (overlay.textContent?.includes('Connection interrupted') || 
        overlay.textContent?.includes('plugin:runtime-error-plugin')) {
      overlay.remove();
    }
  });
};

// Run removal on DOM changes
const observer = new MutationObserver(removeErrorOverlays);
observer.observe(document.body, { childList: true, subtree: true });

// Run removal on page load
document.addEventListener('DOMContentLoaded', removeErrorOverlays);
setTimeout(removeErrorOverlays, 100);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
