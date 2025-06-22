import { useEffect, useRef, useState } from "react";
import { useProfile, useSignInMessage } from "@farcaster/auth-kit";

const STORAGE_KEY = "ipe.auth";

export function PersistLogin() {
  const { isAuthenticated, profile } = useProfile();
  const { message, signature } = useSignInMessage();

  // Store auth data when user signs in
  useEffect(() => {
    if (isAuthenticated && profile && message && signature) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ 
          profile, 
          message, 
          signature,
          timestamp: Date.now()
        })
      );
    }
  }, [isAuthenticated, profile, message, signature]);

  return null;
}

/* Enhanced hook with session restoration */
export function usePersistentAuth() {
  const { isAuthenticated, profile } = useProfile();
  const [restoredProfile, setRestoredProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const once = useRef(false);

  // Try to restore session on first load
  useEffect(() => {
    if (once.current) return;
    once.current = true;

    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const { profile: cachedProfile, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000; // 24 hours
        
        if (!isExpired && cachedProfile) {
          setRestoredProfile(cachedProfile);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear cache when logged out
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      localStorage.removeItem(STORAGE_KEY);
      setRestoredProfile(null);
    }
  }, [isAuthenticated, isLoading]);

  // Use live auth state if available, otherwise use restored state
  const effectiveProfile = profile || restoredProfile;
  const effectiveAuth = isAuthenticated || (restoredProfile && !isLoading);

  return {
    isAuthenticated: effectiveAuth,
    profile: effectiveProfile,
    isLoading: isLoading && !isAuthenticated
  };
}