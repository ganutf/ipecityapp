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

  // Check signer status
  const { data: signerData } = useQuery({
    queryKey: ["/api/neynar/signer", profile?.fid],
    enabled: !!profile?.fid,
  });

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

    if (profile && profile.fid) {
      // First priority: Check signer status
      if (signerData) {
        if (signerData.status === 'pending_approval') {
          // Signer needs approval, redirect to signer approval page
          setLocation("/signer-approval");
          return;
        }
      }

      // Second priority: Check member status (only after signer is approved)
      if (signerData && signerData.status === 'approved' && memberStatus) {
        const { isMember, status, approved } = memberStatus;

        if (!isMember) {
          // User not registered, redirect to registration
          setLocation("/register");
          return;
        }

        if (status === "pending") {
          // Registration pending, redirect to registration page for inline approval
          setLocation("/register");
          return;
        }

        if (status === "denied") {
          // Registration denied, redirect to registration page (shows denial message)
          setLocation("/register");
          return;
        }

        if (requireApproval && !approved) {
          // Approval required but user not approved
          setLocation("/register");
          return;
        }
      }
    }
  }, [profile, signerData, memberStatus, requireAuth, requireApproval, setLocation]);

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