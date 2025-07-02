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
  const { data: signerData, isLoading: signerLoading } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Check member status
  const { data: memberStatus, isLoading: memberLoading } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Wait for both queries to complete before making routing decisions
  const isLoading = signerLoading || memberLoading;

  useEffect(() => {

    if (requireAuth && !profile) {
      // Not authenticated, stay on current page (should show sign in)
      return;
    }

    // Don't make routing decisions while data is still loading
    if (isLoading) {
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
      if (signerData && (signerData as any).status === 'approved') {
        // Wait for member status to load after signer approval
        if (!memberStatus) {
          return; // Still loading member status
        }

        const { isMember, status, approved } = memberStatus as any;
        
        // Handle registration flow states
        if (isMember) {
          const currentStatus = status;
          
          // Member status - allow full access
          if (currentStatus === 'member') {
            // User is a full member, allow access to all pages
            return;
          }
          
          // Signer approved but still needs email/passport verification
          if (currentStatus === 'signer_approved' || currentStatus === 'pending_signer') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/id-verification') {
              setLocation("/id-verification");
              return;
            }
            return; // Already on verification page
          }
          
          // Email verified or pending claim users can access home page but need verification for other protected pages
          if (currentStatus === 'email_verified' || currentStatus === 'pending_claim') {
            // Check if both email and passport are verified - if so, they should have full access
            const { member } = memberStatus as any;
            if (member && member.emailVerified && member.ipePassport) {
              // Both verifications complete - allow full access like a member
              return;
            }
            
            // Still need some verification - allow access to home page and profile, but redirect to verification for other protected pages
            const currentPath = window.location.pathname;
            if (requireApproval && currentPath !== '/' && currentPath !== '/profile' && currentPath !== '/id-verification') {
              setLocation("/id-verification");
              return;
            }
            // Allow access to home page and profile
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
        } else {
          // User not registered, redirect to unified ID verification page
          const currentPath = window.location.pathname;
          if (currentPath !== '/id-verification') {
            setLocation("/id-verification");
            return;
          }
        }
      }
    }
  }, [profile, signerData, memberStatus, isLoading, requireAuth, requireApproval, setLocation]);

  // Show loading state while queries are in progress
  if (isLoading && profile?.fid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

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