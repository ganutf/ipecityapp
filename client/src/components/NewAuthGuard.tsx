import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Member } from "@shared/Member";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function NewAuthGuard({ children, requireAuth = false }: AuthGuardProps) {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();
  const [member, setMember] = useState<Member | null>(null);

  // Check signer status
  const { data: signerData, isLoading: signerLoading } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Check/create member status
  const { data: memberData, isLoading: memberLoading } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Create Member instance when data is available
  useEffect(() => {
    if (memberData?.member) {
      setMember(new Member(memberData.member));
    } else {
      setMember(null);
    }
  }, [memberData]);

  const isLoading = signerLoading || memberLoading;

  useEffect(() => {
    // 1. Not authenticated - stay on current page
    if (requireAuth && !profile) {
      return;
    }

    // 2. Don't route while loading
    if (isLoading) {
      return;
    }

    // 3. Check authentication flow
    if (profile?.fid) {
      // Step 1: Check signer approval
      if (signerData?.status === 'pending_approval') {
        setLocation("/signer-approval");
        return;
      }

      // Step 2: Signer approved, check member status
      if (signerData?.status === 'approved') {
        if (!member) {
          // No member record - will be created automatically by API
          return;
        }

        // Step 3: Route based on member state
        const currentPath = window.location.pathname;
        const requiredRoute = member.getRequiredRoute();
        
        // Only redirect if we're not already on the required route
        if (currentPath !== requiredRoute && requiredRoute !== '/') {
          setLocation(requiredRoute);
          return;
        }

        // Allow access to current page if requirements are met
        return;
      }
    }
  }, [profile, signerData, member, isLoading, requireAuth, setLocation]);

  // Show loading state
  if (isLoading && profile?.fid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}

// Convenience wrapper for auth-required pages
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <NewAuthGuard requireAuth={true}>
      {children}
    </NewAuthGuard>
  );
}