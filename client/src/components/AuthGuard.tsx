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
   */
  const { data: signerData, isLoading: signerLoading } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  /**
   * QUERY 2: Member Status Check
   * Retrieves comprehensive member information including:
   * - isMember: Whether user has a member record
   * - status: Current registration state (pending_signer, signer_approved, email_verified, pending_claim, member)
   * - approved: Admin approval status
   * - member: Full member object with verification flags
   */
  const { data: memberStatus, isLoading: memberLoading } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Prevent routing decisions while either query is loading
  const isLoading = signerLoading || memberLoading;

  useEffect(() => {
    /**
     * ROUTING EFFECT - Main authentication flow logic
     * 
     * This effect runs whenever authentication state changes and determines
     * where the user should be redirected based on their current status.
     * 
     * PRIORITY ORDER:
     * 1. Authentication check
     * 2. Loading state handling  
     * 3. Signer approval status
     * 4. Member registration status
     * 5. Verification completion status
     */

    // STEP 1: Handle unauthenticated users
    if (requireAuth && !profile) {
      // User not logged in but auth required - stay on current page to show sign-in
      return;
    }

    // STEP 2: Wait for API responses before making routing decisions
    if (isLoading) {
      return;
    }

    if (profile && profile.fid) {
      // STEP 3: Check Farcaster signer approval status (highest priority)
      if (signerData) {
        console.log("AuthGuard - Signer status:", (signerData as any).status);
        if ((signerData as any).status === 'pending_approval') {
          console.log("AuthGuard - Redirecting to signer approval");
          // Signer pending approval - redirect to QR code approval page
          setLocation("/signer-approval");
          return;
        }
      }

      // STEP 4: Process member status (only after signer is approved)
      if (signerData && (signerData as any).status === 'approved') {
        // Wait for member status API response
        if (!memberStatus) {
          return; // Still loading member status
        }

        const { isMember, status } = memberStatus as any;
        
        // STEP 5: Handle member registration and verification states
        if (isMember) {
          const currentStatus = status;
          
          // STATUS: 'member' - Full access granted
          if (currentStatus === 'member') {
            // User completed all verifications, allow access to all pages
            return;
          }
          
          // STATUS: 'signer_approved' or 'pending_signer' - Needs email/passport verification
          if (currentStatus === 'signer_approved' || currentStatus === 'pending_signer') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/id-verification') {
              setLocation("/id-verification");
              return;
            }
            return; // Already on verification page
          }
          
          // STATUS: 'email_verified', 'pending_claim', or 'pending_acceptance' - Partial verification complete
          if (currentStatus === 'email_verified' || currentStatus === 'pending_claim' || currentStatus === 'pending_acceptance') {
            // Check if both email and passport verifications are complete
            const { member } = memberStatus as any;
            if (member && member.emailVerified && member.ipePassport) {
              // Both verifications complete - grant full member access
              return;
            }
            
            // Partial verification - allow limited access (home/profile only)
            const currentPath = window.location.pathname;
            if (requireApproval && currentPath !== '/' && currentPath !== '/profile' && currentPath !== '/id-verification') {
              setLocation("/id-verification");
              return;
            }
            // Allow access to home page and profile
            return;
          }

          // STATUS: 'pending' - Awaiting admin approval
          if (status === "pending") {
            // Registration pending admin approval - show on profile page
            setLocation("/profile");
            return;
          }

          // STATUS: 'denied' - Application rejected
          if (status === "denied") {
            // Registration denied - show denial message on profile page
            setLocation("/profile");
            return;
          }

          // FALLBACK: For any other status requiring approval
          if (requireApproval && status !== 'member') {
            setLocation("/profile");
            return;
          }
        } else {
          // User has no member record - needs to complete registration
          const currentPath = window.location.pathname;
          if (currentPath !== '/id-verification') {
            setLocation("/id-verification");
            return;
          }
        }
      }
    }
  }, [profile, signerData, memberStatus, isLoading, requireAuth, requireApproval, setLocation]);

  /**
   * LOADING STATE COMPONENT
   * 
   * Shows a spinner while authentication queries are in progress.
   * Only displays for authenticated users to prevent flash of loading
   * state for unauthenticated visitors.
   */
  if (isLoading && profile?.fid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Render protected content when all checks pass
  return <>{children}</>;
}

/**
 * RequireAuth Component - Basic Authentication Guard
 * 
 * Convenience wrapper for AuthGuard that requires Farcaster authentication.
 * Users must be logged in via AuthKit to access the wrapped content.
 * 
 * USAGE:
 * Wrap components that need basic authentication:
 * ```jsx
 * <RequireAuth>
 *   <ProfilePage />
 * </RequireAuth>
 * ```
 * 
 * BEHAVIOR:
 * - Unauthenticated users see sign-in interface
 * - Authenticated users proceed through verification flow as needed
 * - No additional approval requirements beyond basic auth
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={true}>
      {children}
    </AuthGuard>
  );
}

/**
 * RequireApproval Component - Strict Access Control Guard
 * 
 * Convenience wrapper for AuthGuard that requires both authentication 
 * and full member approval. This is the highest level of access control.
 * 
 * USAGE:
 * Wrap components that need full member access:
 * ```jsx
 * <RequireApproval>
 *   <AdminDashboard />
 * </RequireApproval>
 * ```
 * 
 * BEHAVIOR:
 * - Enforces complete authentication flow
 * - Requires email verification AND passport verification
 * - May require admin approval depending on member status
 * - Blocks access until all requirements are met
 * 
 * TYPICAL USE CASES:
 * - Admin pages
 * - Protected member content
 * - Features requiring verified identity
 */
export function RequireApproval({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth={true} requireApproval={true}>
      {children}
    </AuthGuard>
  );
}