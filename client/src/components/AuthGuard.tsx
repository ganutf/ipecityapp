import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireApproval?: boolean;
}

export function AuthGuard({ children, requireAuth = false, requireApproval = false }: AuthGuardProps) {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();

  // Check signer status
  const { data: signerData } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Check member status
  const { data: memberStatus } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
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
        console.log("AuthGuard - Signer status:", (signerData as any).status);
        if ((signerData as any).status === 'pending_approval') {
          console.log("AuthGuard - Redirecting to signer approval");
          // Signer needs approval, redirect to signer approval page
          setLocation("/signer-approval");
          return;
        }
      }

      // Second priority: Check member status (only after signer is approved)
      if (signerData && (signerData as any).status === 'approved' && memberStatus) {
        const { isMember, status, approved } = memberStatus as any;
        
        // Handle new registration flow states
        if (isMember) {
          const currentStatus = status;
          
          // Redirect based on member status
          if (currentStatus === 'signer_approved' || currentStatus === 'pending_signer') {
            setLocation("/email-verification");
            return;
          }
          
          if (currentStatus === 'email_verified') {
            setLocation("/passport-validation");
            return;
          }
          
          if (currentStatus === 'pending_claim') {
            setLocation("/passport-validation"); // Will show "under review" state
            return;
          }
          
          // Member status - allow full access
          if (currentStatus === 'member') {
            // User is a full member, allow access to all pages
            return;
          }
        }

        if (!isMember) {
          // User not registered, redirect to email verification to start registration
          setLocation("/email-verification");
          return;
        }

        if (status === "pending") {
          // Registration pending, redirect to profile page for inline approval
          setLocation("/profile");
          return;
        }

        if (status === "denied") {
          // Registration denied, redirect to profile page (shows denial message)
          setLocation("/profile");
          return;
        }

        if (requireApproval && !approved) {
          // Approval required but user not approved
          setLocation("/profile");
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