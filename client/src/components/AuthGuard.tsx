import { useProfile } from "@farcaster/auth-kit";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireApproval?: boolean;
}

export function AuthGuard({ children, requireAuth = false, requireApproval = false }: AuthGuardProps) {
  const { profile } = useProfile();
  const [, setLocation] = useLocation();

  // Check member status
  const { data: memberStatus } = useQuery({
    queryKey: ["/api/members/check", profile?.fid],
    enabled: !!profile?.fid,
  });

  useEffect(() => {
    if (requireAuth && !profile) {
      // Not authenticated, stay on current page (should show sign in)
      return;
    }

    if (profile && memberStatus) {
      const { isMember, status, approved } = memberStatus;

      if (!isMember) {
        // User not registered, redirect to registration
        setLocation("/register");
        return;
      }

      if (status === "pending") {
        // Registration pending, redirect to pending page
        setLocation("/pending");
        return;
      }

      if (status === "denied") {
        // Registration denied, redirect to pending page (shows denial message)
        setLocation("/pending");
        return;
      }

      if (requireApproval && !approved) {
        // Approval required but user not approved
        setLocation("/pending");
        return;
      }
    }
  }, [profile, memberStatus, requireAuth, requireApproval, setLocation]);

  return <>{children}</>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={true}>
      {children}
    </AuthGuard>
  );
}

export function RequireApproval({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={true} requireApproval={true}>
      {children}
    </AuthGuard>
  );
}