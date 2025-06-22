import { useEffect, useRef } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";
import { AppClient } from "@farcaster/auth-kit/client";
import { useAuthStore } from "@farcaster/auth-kit";

const STORAGE_KEY = "ipe.auth";

export function PersistLogin() {
  /* ----------  A.  WRITE to localStorage right after first login ---------- */
  const { isAuthenticated } = useProfile();
  const { message, signature } = useSignInMessage();

  useEffect(() => {
    if (isAuthenticated && message && signature) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ message, signature })
      );
    }
  }, [isAuthenticated, message, signature]);

  /* ----------  B.  READ & VERIFY once on first paint ---------------------- */
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;          // guards React-StrictMode double-mount
    once.current = true;

    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    (async () => {
      try {
        const { message, signature } = JSON.parse(cached);
        const appClient = new AppClient({ relay: "https://relay.farcaster.xyz" });

        const { success, fid } = await appClient.verifySignInMessage({
          message,
          signature,
          nonce : JSON.parse(message).nonce,
          domain: window.location.hostname,
          acceptAuthAddress: true
        });

        success
          ? setAuthState({ fid, message, signature })   // <- re-hydrate!
          : localStorage.removeItem(STORAGE_KEY);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [setAuthState]);

  return null; // this component renders nothing
}

/* Helper hook your pages can import */
export function usePersistentAuth() {
  return useProfile(); // returns { isAuthenticated, profile, isLoading }
}