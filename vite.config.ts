import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  optimizeDeps: {
    // Pre-bundle heavy Web3 dependencies to prevent esbuild crashes in WSL dev.
    // Previously `@justaname.id/react` pulled these in transitively — now listed explicitly.
    include: [
      '@privy-io/react-auth',
      '@privy-io/wagmi',
      'wagmi',
      'viem',
      'viem/chains',
      'viem/siwe',
      '@tanstack/react-query',
      'wouter',
      '@coinbase/wallet-sdk',
      '@walletconnect/ethereum-provider',
      '@walletconnect/universal-provider',
      '@base-org/account',
      '@simplewebauthn/browser',
      'siwe',
    ],
    // Increase esbuild workers for better stability
    esbuildOptions: {
      target: 'esnext',
    },
  },
});
