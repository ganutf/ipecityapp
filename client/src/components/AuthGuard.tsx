import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * AuthGuard Component - Authentication and Authorization Router
 *
 * This component manages the complete user authentication flow for the Ipê City Pulse application.
 * It uses Privy for authentication and handles multi-step verification.
 *
 * AUTHENTICATION FLOW (Privy):
 * 1. Email/Passkey Login (via Privy)
 * 2. Smart Wallet Creation (automatic)
 * 3. Subdomain Claim (optional)
 * 4. Full Member Access
 *
 * ROUTING LOGIC:
 * - Unauthenticated users: Stay on current page (shows sign-in)
 * - New users: Redirect to onboarding
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
  const { isAuthenticated, isLoading, isMember, memberStatus } = useAuth();
  const [, setLocation] = useLocation();

  /**
   * MAIN ROUTING LOGIC
   * Processes authentication state and redirects users appropriately.
   */
  useEffect(() => {
    const currentPath = window.location.pathname;

    // STEP 1: Wait for auth to be ready
    if (isLoading) {
      return;
    }

    // STEP 2: Protect authenticated-only pages
    const protectedPaths = ['/id-verification', '/profile', '/community', '/pulses', '/admin'];
    if (protectedPaths.some(path => currentPath.startsWith(path)) && !isAuthenticated) {
      console.log(`AuthGuard - ${currentPath} requires authentication, redirecting to home`);
      setLocation("/");
      return;
    }

    // STEP 3: Handle unauthenticated users for pages that require auth
    if (requireAuth && !isAuthenticated) {
      setLocation("/");
      return;
    }

    // STEP 4: Handle authenticated users
    if (isAuthenticated) {
      // If user is a member, check their status
      if (isMember) {
        console.log("AuthGuard - Member status:", memberStatus);

        // STATUS: 'active_member' - User completed all verifications (wallet + email + subdomain)
        if (memberStatus === 'active_member') {
          // Allow access to all pages
          return;
        }

        // STATUS: 'pending_id_verification' - Incomplete onboarding (missing wallet OR email OR subdomain)
        // Redirect to id-verification page to complete wallet connection, email, and subdomain
        if (memberStatus === 'pending_id_verification') {
          if (currentPath !== '/id-verification' && currentPath !== '/') {
            console.log("AuthGuard - Incomplete ID verification, redirecting to id-verification");
            setLocation("/id-verification");
            return;
          }
          return;
        }

        // STATUS: 'pending_application_review' - Application submitted, awaiting admin approval
        if (memberStatus === 'pending_application_review') {
          // Allow access to home and id-verification (to see status)
          if (currentPath !== '/id-verification' && currentPath !== '/' && currentPath !== '/profile') {
            console.log("AuthGuard - Application pending, limited access");
            setLocation("/id-verification");
            return;
          }
          return;
        }

        // STATUS: 'approved_application' - Admin approved, subdomain reserved (waiting for user to accept)
        if (memberStatus === 'approved_application') {
          // Allow access to id-verification to accept subdomain
          if (currentPath !== '/id-verification' && currentPath !== '/' && currentPath !== '/profile') {
            console.log("AuthGuard - Subdomain ready, redirecting to id-verification");
            setLocation("/id-verification");
            return;
          }
          return;
        }

        // STATUS: 'denied_application' - Application rejected
        if (memberStatus === 'denied_application') {
          if (currentPath !== '/profile' && currentPath !== '/id-verification' && currentPath !== '/') {
            setLocation("/profile");
            return;
          }
          return;
        }
      }

      // Authenticated but not a member yet - allow access to home and profile
      // They need to complete onboarding
      if (currentPath !== '/' && currentPath !== '/profile' && currentPath !== '/id-verification') {
        console.log("AuthGuard - Not a member yet, redirecting to home");
        setLocation("/");
        return;
      }
    }

    // Allow access for unauthenticated users if authentication is not required
  }, [isAuthenticated, isLoading, isMember, memberStatus, requireAuth, setLocation]);

  // Show loading state while determining authentication status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Render children if all checks pass
  return <>{children}</>;
}
