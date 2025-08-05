import { useEffect } from "react";
import { useLocation } from "wouter";
import { SignInButton } from "@farcaster/auth-kit";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useQuery } from "@tanstack/react-query";

export default function HomePage() {
  const { isAuthenticated, profile, isLoading: authLoading } = usePersistentAuth();
  const [, setLocation] = useLocation();

  // Check member status to determine where to redirect authenticated users
  const { data: memberCheck, isLoading: memberLoading } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(isAuthenticated && profile?.fid),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Redirect authenticated users to appropriate page
  useEffect(() => {
    if (isAuthenticated && profile?.fid && memberCheck && !memberLoading) {
      const { isMember, status } = memberCheck as any;
      
      if (isMember && status === 'active_member') {
        // Active members go to community (main landing page for members)
        setLocation("/community");
      }
      // For users in verification process, let AuthGuard handle the redirection
      // AuthGuard will redirect them to appropriate verification pages
    }
  }, [isAuthenticated, profile, memberCheck, memberLoading, setLocation]);

  // Show loading while determining authentication status
  if (authLoading || (isAuthenticated && memberLoading)) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Ipê City
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Your community engagement tracking platform
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="space-y-2">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800">Pulse</h3>
              <p className="text-sm text-gray-600">
                Engage in collective activities to help Ipê move forward.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl mb-2">✨</div>
              <h3 className="font-semibold text-gray-800">Collaborate</h3>
              <p className="text-sm text-gray-600">
                Monitor your reputation within the community.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl mb-2">🌟</div>
              <h3 className="font-semibold text-gray-800">Connect</h3>
              <p className="text-sm text-gray-600">
                Meet Ipê members and learn about their projects.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">
            Ready to Join?
          </h3>
          <p className="text-purple-700 mb-4">
            Connect your Farcaster account to start participating in community
            pulses
          </p>
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>Ipê City • A Network State community</p>
        </div>
      </div>
    );
  }

  // For authenticated users who haven't been redirected, show a loading state
  // (AuthGuard will handle redirection for users in verification process)
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Redirecting...</p>
      </div>
    </div>
  );
}