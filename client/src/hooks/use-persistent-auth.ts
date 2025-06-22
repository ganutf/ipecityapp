import { useEffect, useState } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";

interface CachedSession {
  message: string;
  signature: string;
  fid: number;
  profile: any;
  timestamp: number;
}

export function usePersistentAuth() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();
  const [restoredSession, setRestoredSession] = useState<CachedSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // 1. Capture credentials right after sign-in
  useEffect(() => {
    if (isAuthenticated && message && signature && profile?.fid) {
      const sessionData: CachedSession = {
        message,
        signature,
        fid: profile.fid,
        profile,
        timestamp: Date.now()
      };
      
      localStorage.setItem("fcAuth", JSON.stringify(sessionData));
      setRestoredSession(sessionData);
      console.log("Session cached:", { fid: profile.fid });
    }
  }, [isAuthenticated, message, signature, profile]);

  // 2. Restore session on app load
  useEffect(() => {
    const restoreSession = () => {
      try {
        const cached = localStorage.getItem("fcAuth");
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
          localStorage.removeItem("fcAuth");
          setIsRestoring(false);
          return;
        }

        // For now, trust the cached session
        // In production, you'd verify with AppClient.verifySignInMessage
        setRestoredSession(sessionData);
        console.log("Session restored:", { fid: sessionData.fid });
      } catch (error) {
        console.error("Failed to restore session:", error);
        localStorage.removeItem("fcAuth");
      } finally {
        setIsRestoring(false);
      }
    };

    // Small delay to ensure localStorage is available
    const timer = setTimeout(restoreSession, 100);
    return () => clearTimeout(timer);
  }, []);

  // 3. Clear session when logged out
  useEffect(() => {
    if (!isAuthenticated && !isRestoring && restoredSession) {
      localStorage.removeItem("fcAuth");
      setRestoredSession(null);
      console.log("Session cleared");
    }
  }, [isAuthenticated, isRestoring, restoredSession]);

  // Return effective authentication state
  const effectiveAuth = {
    isAuthenticated: isAuthenticated || Boolean(restoredSession),
    profile: profile || restoredSession?.profile,
    isLoading: isRestoring
  };

  return effectiveAuth;
}

// Separate component to handle session persistence
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
      
      localStorage.setItem("fcAuth", JSON.stringify(sessionData));
      console.log("Session persisted:", { fid: profile.fid });
    }
  }, [isAuthenticated, message, signature, profile]);

  return null; // This component doesn't render anything
}