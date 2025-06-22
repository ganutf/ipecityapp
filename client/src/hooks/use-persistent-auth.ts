import { useEffect, useRef } from "react";
import { useProfile, useSignInMessage, useAuthStore, AppClient } from "@farcaster/auth-kit";

const STORAGE_KEY = "ipe.auth";

export function PersistLogin() {
  /**
   * 1. Capture the message + signature the *first* time the user logs
   *    in and drop them in localStorage.
   */
  const { isAuthenticated } = useProfile();
  const { message, signature } = useSignInMessage();

  useEffect(() => {
    if (isAuthenticated && message && signature) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ message, signature })
      );
      console.log("Session cached successfully");
    }
  }, [isAuthenticated, message, signature]);

  /**
   * 2. When the component mounts *for the very first time*, try to
   *    verify the cached signature and push it back into AuthKit's
   *    internal store. That re-hydrates `useProfile()` everywhere.
   */
  const setAuthState = useAuthStore((s) => s.setAuthState);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return; // guard against React-StrictMode
    once.current = true;

    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) {
      console.log("No cached session found");
      return;
    }

    (async () => {
      try {
        const { message, signature } = JSON.parse(cached);
        const appClient = new AppClient({ relay: "https://relay.farcaster.xyz" });

        const { success, fid } = await appClient.verifySignInMessage({
          message,
          signature,
          nonce: JSON.parse(message).nonce, // must match!
          domain: window.location.hostname,
          acceptAuthAddress: true
        });

        if (success) {
          // 👇 this is the missing piece – put the user back in memory
          setAuthState({ fid, message, signature });
          console.log("Session restored successfully:", { fid });
        } else {
          console.log("Session verification failed");
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error("Session restore error:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [setAuthState]);

  return null;
}