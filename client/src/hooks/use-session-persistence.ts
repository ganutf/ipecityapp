import { useEffect, useState } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";

interface CachedAuth {
  message: string;
  signature: string;
  fid: number;
}

export function useSessionPersistence() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [restoredFid, setRestoredFid] = useState<number | null>(null);

  // Capture credentials right after sign-in
  useEffect(() => {
    if (isAuthenticated && message && signature && profile?.fid) {
      localStorage.setItem(
        "fcAuth",
        JSON.stringify({ 
          message, 
          signature, 
          fid: profile.fid 
        })
      );
      setRestoredFid(profile.fid);
    }
  }, [isAuthenticated, message, signature, profile]);

  // Restore session on app load
  useEffect(() => {
    function restoreSession() {
      try {
        const cached = localStorage.getItem("fcAuth");
        if (!cached) {
          setIsRestoringSession(false);
          return;
        }

        const { fid }: CachedAuth = JSON.parse(cached);
        
        // For now, trust the cached session without server verification
        // In production, you'd want to verify with your backend
        setRestoredFid(fid);
      } catch (error) {
        console.error('Failed to restore session:', error);
        localStorage.removeItem("fcAuth");
        setRestoredFid(null);
      } finally {
        setIsRestoringSession(false);
      }
    }

    restoreSession();
  }, []);

  // Clear session when logged out
  useEffect(() => {
    if (!isAuthenticated && !isRestoringSession) {
      localStorage.removeItem("fcAuth");
      setRestoredFid(null);
    }
  }, [isAuthenticated, isRestoringSession]);

  const effectiveAuth = {
    isAuthenticated: isAuthenticated || (restoredFid !== null),
    profile: profile || (restoredFid ? { fid: restoredFid } : null),
    isLoading: isRestoringSession
  };

  return effectiveAuth;
}