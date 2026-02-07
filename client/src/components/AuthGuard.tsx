import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

/**
 * AuthGuard Component - Authentication and Authorization Router
 * 
 * This component manages the complete user authentication flow for the Ipê City Pulse application.
 * It handles multi-step verification including Farcaster authentication, signer approval, 
 * email verification, and passport validation.
 * 
 * AUTHENTICATION FLOW:
 * 1. Farcaster Login (via AuthKit)
 * 2. Signer Approval (QR code approval on mobile)
 * 3. Email Verification (6-digit code)
 * 4. Passport Verification (ENS domain ownership or claiming)
 * 5. Full Member Access (can interact with pulses)
 * 
 * ROUTING LOGIC:
 * - Unauthenticated users: Stay on current page (shows sign-in)
 * - Pending signer approval: Redirect to /signer-approval
 * - Need verification: Redirect to /id-verification
 * - Partial verification: Allow home/profile access, restrict other pages
 * - Full members: Allow access to all pages
 * 
 * @param children - React components to render when access is granted
 * @param requireAuth - Whether authentication is required to view content
 * @param requireApproval - Whether full member approval is required (stricter access)
 */
interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireApproval?: boolean;
}

export function AuthGuard({ children, requireAuth = false, requireApproval = false }: AuthGuardProps) {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();

  /**
   * QUERY 1: Signer Status Check
   * Verifies whether the user's Farcaster signer has been approved via QR code.
   * Status can be: 'pending_approval' | 'approved' | 'revoked'
   * Note: This query might fail for users with pending_signer status (no signer created yet)
   */
  const { data: signerData, isLoading: signerLoading, error: signerError } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: Boolean(profile?.fid),
    retry: false, // Don't retry failed signer requests
    refetchOnWindowFocus: false, // Don't auto-refetch signer data
  });

  /**
   * QUERY 2: Member Status Check
   * Checks if the user is a member and their current verification status.
   * Possible statuses: pending_signer, pending_id_verification, email_verified, 
   * pending_application_review, approved_application, denied_application, active_member
   */
  const { data: memberStatus, isLoading: memberLoading, error: memberError } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(profile?.fid),
    retry: 2,
  });

  // Log member status API results
  useEffect(() => {
    if (memberError) {
      console.error("AuthGuard - Member status API error:", memberError);
    }
    if (memberStatus) {
      console.log("AuthGuard - Member status API success:", memberStatus);
    }
  }, [memberStatus, memberError]);

  // Overall loading state - wait for member status, but don't wait for signer if it errors
  // (signer API fails for users with pending_signer status, which is expected)
  const isLoading = memberLoading || (signerLoading && !signerError);

  /**
   * MAIN ROUTING LOGIC
   * Processes authentication state and redirects users appropriately.
   * Order matters: Check highest priority states first.
   */
  useEffect(() => {
    const currentPath = window.location.pathname;
    
    // STEP 1: Protect authenticated-only pages - always require authentication
    const protectedPaths = ['/id-verification', '/profile', '/signer-approval'];
    if (protectedPaths.includes(currentPath) && !profile?.fid) {
      console.log(`AuthGuard - ${currentPath} requires authentication, redirecting to home`);
      setLocation("/");
      return;
    }
    
    // STEP 2: Handle unauthenticated users for other pages
    if (requireAuth && !profile) {
      // User not logged in but auth required - redirect to home page
      setLocation("/");
      return;
    }

    // STEP 3: Wait for API responses before making routing decisions
    if (isLoading) {
      return;
    }

    if (profile && profile.fid) {
      // STEP 4: Check if member has pending_signer status first (highest priority)
      // This handles users who don't have a signer created yet
      if (memberStatus && (memberStatus as any).isMember) {
        const { status } = memberStatus as any;
        if (status === 'pending_signer') {
          console.log("AuthGuard - Member has pending_signer status, redirecting to signer approval");
          setLocation("/signer-approval");
          return;
        }
      }

      // STEP 5: Check Farcaster signer approval status (for users with existing signers)
      if (signerData) {
        console.log("AuthGuard - Signer status:", (signerData as any).status);
        if ((signerData as any).status === 'pending_approval') {
          console.log("AuthGuard - Redirecting to signer approval");
          // Signer pending approval - redirect to QR code approval page
          setLocation("/signer-approval");
          return;
        }
      }

      // STEP 6: Process member status (only after signer is approved)
      if (signerData && (signerData as any).status === 'approved') {
        // Handle member status API errors
        if (memberError) {
          console.error("AuthGuard - Member status API failed, redirecting to home:", memberError);
          setLocation("/");
          return;
        }
        
        // Wait for member status API response
        if (!memberStatus) {
          return; // Still loading member status
        }

        const { isMember, status } = memberStatus as any;
        
        // STEP 7: Handle member registration and verification states
        if (isMember) {
          const currentStatus = status;
          console.log("AuthGuard - Member status:", currentStatus);
          
          // STATUS: 'active_member' - User completed all verifications
          if (currentStatus === 'active_member') {
            // User completed all verifications, allow access to all pages
            return;
          }
          
          // STATUS: Incomplete verification states - restrict to id-verification only
          if (currentStatus === 'pending_id_verification' || 
              currentStatus === 'email_verified' || 
              currentStatus === 'pending_application_review' ||
              currentStatus === 'pending_application_review' ||
              currentStatus === 'approved_application') {
            console.log("AuthGuard - Incomplete verification, only allowing id-verification access. Status:", currentStatus);
            const currentPath = window.location.pathname;
            if (currentPath !== '/id-verification') {
              setLocation("/id-verification");
              return;
            }
            return; // Already on id-verification page
          }
          
          // STATUS: 'denied_application' - Application rejected
          if (currentStatus === 'denied_application') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/profile' && currentPath !== '/id-verification') {
              setLocation("/profile");
              return;
            }
            return; // Already on allowed page
          }
          
          // STATUS: Fallback for any other status
          console.log("AuthGuard - Unhandled status, defaulting to verification:", currentStatus);
          const currentPath = window.location.pathname;
          if (currentPath !== '/id-verification' && currentPath !== '/profile') {
            setLocation("/id-verification");
            return;
          }
          return;
        }

        // Not a member - handle non-member states
        const currentPath = window.location.pathname;
        
        // Allow non-members to access home page (sign-in) and profile (for error messages)
        if (currentPath === '/' || currentPath === '/profile') {
          return;
        }
        
        // Redirect non-members to home page for all other routes
        setLocation("/");
        return;
      }
    }

    // Allow access for unauthenticated users if authentication is not required
  }, [profile, signerData, memberStatus, isLoading, requireAuth, setLocation]);

  // Show loading state while determining authentication status
  if (isLoading && profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Render children if all checks pass
  return <>{children}</>;
}