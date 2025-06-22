import { useEffect, useRef, useState } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";
import { useAuthStore } from "@farcaster/auth-kit";
import { AppClient } from "@farcaster/auth-kit/client";

const STORAGE_KEY = "ipe.auth";
const SIGNER_KEY  = "ipe.signer";     // <- if you create signer_uuid’s

/* ------------------------------------------------------------------ */
/*  A.  COMPONENT THAT SAVES AUTH DATA RIGHT AFTER FIRST LOGIN        */
/* ------------------------------------------------------------------ */
export function PersistLogin() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();

  useEffect(() => {
    if (isAuthenticated && profile && message && signature) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, message, signature, timestamp: Date.now() })
      );
    }
  }, [isAuthenticated, profile, message, signature]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  B.  HOOK YOUR PAGES SHOULD USE                                    */
/* ------------------------------------------------------------------ */
export function usePersistentAuth() {
  const { isAuthenticated, profile } = useProfile();
  const [restoredProfile, setRestoredProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const once = useRef(false);
  const setAuthState = useAuthStore((s) => s.setAuthState);

  /* -- Restore on first mount -------------------------------------- */
  useEffect(() => {
    if (once.current) return;
    once.current = true;

    (async () => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (!cached) return setIsLoading(false);

        const { profile: cachedProfile, message, signature, timestamp } =
          JSON.parse(cached);

        const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 h
        if (expired || !message || !signature) {
          localStorage.removeItem(STORAGE_KEY);
          return setIsLoading(false);
        }

        /* Verify SIWF message — optional but recommended */
        const client = new AppClient({ relay: "https://relay.farcaster.xyz" });
        const { success, fid } = await client.verifySignInMessage({
          message,
          signature,
          nonce: JSON.parse(message).nonce,
          domain: window.location.hostname,
          acceptAuthAddress: true,
        });

        if (success) {
          setAuthState({ fid, message, signature });      // 👈 re-hydrate
          setRestoredProfile(cachedProfile);

          /* Restore signer_uuid if you saved one ---------------------------------- */
          const savedSigner = localStorage.getItem(SIGNER_KEY);
          if (savedSigner) {
            const { setSignerUuid } = await import("@neynar/nodejs-sdk");
            setSignerUuid(savedSigner);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setAuthState]);

  /* -- Clear cache when user actually logs out --------------------- */
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      localStorage.removeItem(STORAGE_KEY);
      setRestoredProfile(null);
    }
  }, [isAuthenticated, isLoading]);

  const effectiveProfile = profile ?? restoredProfile;
  const effectiveAuth    = isAuthenticated || (!!restoredProfile && !isLoading);

  return {
    isAuthenticated: effectiveAuth,
    profile: effectiveProfile,
    isLoading: isLoading && !isAuthenticated,
  };
}
