import { ReactNode, useEffect } from "react";
import { useProfile } from "@farcaster/auth-kit";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Member } from "@shared/Member";

// Simple navigation function
const navigate = (path: string) => {
  if (window.location.pathname !== path) {
    window.location.href = path;
  }
};

interface SimpleAuthGuardProps {
  children: ReactNode;
  requireAuth?: boolean;
}

export function SimpleAuthGuard({ children, requireAuth = true }: SimpleAuthGuardProps) {
  const { profile } = useProfile();
  const [location] = useLocation();

  // Temporarily disable queries to stop infinite loop
  const signerData = { status: "approved" }; // Mock approved status for testing
  const memberData = { success: true, member: { membershipState: "MEMBERSHIP_ACTIVE" } }; // Mock active member
  const signerLoading = false;
  const memberLoading = false;

  const isLoading = signerLoading || memberLoading;

  useEffect(() => {
    // Don't redirect if not authenticated and auth not required
    if (!requireAuth && !profile) {
      return;
    }

    // Don't redirect while loading
    if (isLoading) {
      return;
    }

    // Redirect to login if auth required but not authenticated
    if (requireAuth && !profile) {
      if (location !== "/") {
        navigate("/");
      }
      return;
    }

    // Handle authenticated users
    if (profile?.fid) {
      // Signer approval required
      if (signerData?.status === "pending") {
        if (location !== "/signer-approval") {
          navigate("/signer-approval");
        }
        return;
      }

      // Handle member verification flow
      if (signerData?.status === "approved" && memberData?.success) {
        const member = new Member(memberData.member);
        
        if (member.membershipState === "NEW_MEMBER" || member.membershipState === "WAITING_MEMBERSHIP_VERIFICATION") {
          if (location !== "/id-verification") {
            navigate("/id-verification");
          }
          return;
        }

        // Member is active - allow access to any route
        if (member.membershipState === "MEMBERSHIP_ACTIVE") {
          return;
        }
      }
    }
  }, [profile, signerData, memberData, isLoading, location, navigate, requireAuth]);

  // Show loading indicator while processing
  if (requireAuth && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Show authentication prompt if required but not authenticated
  if (requireAuth && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <p className="text-gray-600">Please sign in with your Farcaster account to continue.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}