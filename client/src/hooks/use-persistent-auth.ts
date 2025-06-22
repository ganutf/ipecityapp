import { useEffect, useState } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";

interface CachedSession {
  message: string;
  signature: string;
  fid: number;
  profile: any;
  timestamp: number;
}

const STORAGE_KEY = "ipe.auth";

export function usePersistentAuth() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();
  const [restoredSession, setRestoredSession] = useState<CachedSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Capture credentials after sign-in
  useEffect(() => {
    if (isAuthenticated && message && signature && profile?.fid) {
      const sessionData: CachedSession = {
        message,
        signature,
        fid: profile.fid,
        profile,
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      setRestoredSession(sessionData);
      console.log("Session cached:", { fid: profile.fid });
    }
  }, [isAuthenticated, message, signature, profile]);

  // Restore session on app load
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (!cached) {
          console.log("No cached session found");
          setIsRestoring(false);
          return;
        }

        const sessionData: CachedSession = JSON.parse(cached);
        
        // Check if session is expired (24 hours)
        const isExpired = Date.now() - sessionData.timestamp > 24 * 60 * 60 * 1000;
        
        if (isExpired) {
          console.log("Cached session expired");
          localStorage.removeItem(STORAGE_KEY);
          setIsRestoring(false);
          return;
        }

        setRestoredSession(sessionData);
        console.log("Session restored:", { fid: sessionData.fid });
      } catch (error) {
        console.error("Failed to restore session:", error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsRestoring(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Clear session when logged out
  useEffect(() => {
    if (!isAuthenticated && !isRestoring && restoredSession) {
      localStorage.removeItem(STORAGE_KEY);
      setRestoredSession(null);
      console.log("Session cleared");
    }
  }, [isAuthenticated, isRestoring, restoredSession]);

  return {
    isAuthenticated: isAuthenticated || Boolean(restoredSession),
    profile: profile || restoredSession?.profile,
    isLoading: isRestoring
  };
}

export function PersistLogin() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();

  useEffect(() => {
    if (isAuthenticated && message && signature && profile?.fid) {
      const sessionData = {
        message,
        signature,
        fid: profile.fid,
        profile,
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      console.log("Session persisted:", { fid: profile.fid });
    }
  }, [isAuthenticated, message, signature, profile]);

  return null;
}