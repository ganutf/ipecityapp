import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";

interface MemberStatus {
  isMember: boolean;
  approved: boolean;
  status?: string;
  member?: {
    email?: string;
    emailVerified?: boolean;
    ipePassport?: string;
    ipeUsername?: string;
    passportVerified?: boolean;
    walletAddress?: string;
    walletRenewalStatus?: "pending_renewal" | "renewal_approved" | null;
    newWalletAddress?: string;
  };
}

export default function IdVerificationPage() {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [emailComplete, setEmailComplete] = useState(false);
  const [passportComplete, setPassportComplete] = useState(false);

  // Check member status to determine current verification state
  const { data: memberStatus, refetch, isLoading: memberLoading } = useQuery<MemberStatus>({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
    refetchInterval: (query) => {
      // Poll every 10 seconds if user is pending_claim (waiting for admin approval)
      const status = (query.state.data as any)?.status;
      if (status === 'pending_claim' || status === 'pending_acceptance') {
        return 10000; // 10 seconds
      }
      return false; // Stop polling for other statuses
    },
  });

  // Update completion states based on member status (matching Profile page logic)
  const isEmailVerified = memberStatus?.member?.emailVerified || false;
  const isPassportVerified = !!memberStatus?.member?.ipePassport;
  const bothComplete = isEmailVerified && isPassportVerified;
  
  // Redirect to home if user becomes approved member
  useEffect(() => {
    if (memberStatus?.status === 'active_member') {
      setLocation("/");
    }
  }, [memberStatus?.status, setLocation]);

  const handleEmailComplete = () => {
    setEmailComplete(true);
    refetch(); // Refresh member status
    queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
  };

  const handlePassportComplete = () => {
    setPassportComplete(true);
    refetch(); // Refresh member status
    queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
  };

  const handleDone = () => {
    setLocation("/");
  };

  // Show loading state while member status is being fetched
  if (memberLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">ID Verification</h1>
          <div className="flex items-center justify-center mt-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600">Loading verification status...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">ID Verification</h1>
        <p className="text-gray-600 mt-2">
          Complete both email and passport verification to access all features.
        </p>
      </div>

      <EmailVerificationSection
        farcasterFid={profile?.fid || 0}
        currentEmail={memberStatus?.member?.email}
        isVerified={isEmailVerified}
        onVerificationComplete={handleEmailComplete}
        allowChange={true}
      />

      <PassportVerificationSection
        farcasterFid={profile?.fid || 0}
        currentPassport={memberStatus?.member?.ipePassport || memberStatus?.member?.ipeUsername}
        isVerified={isPassportVerified}
        onVerificationComplete={handlePassportComplete}
        allowChange={true}
        memberData={{
          farcasterFid: profile?.fid || 0,
          walletAddress: memberStatus?.member?.walletAddress,
          ipePassport: memberStatus?.member?.ipePassport,
          ipeUsername: memberStatus?.member?.ipeUsername,
          passportVerified: memberStatus?.member?.passportVerified || false,
          status: memberStatus?.status || '',
          walletRenewalStatus: memberStatus?.member?.walletRenewalStatus,
          newWalletAddress: memberStatus?.member?.newWalletAddress,
          email: memberStatus?.member?.email,
          emailVerified: memberStatus?.member?.emailVerified || false
        }}
        farcasterProfile={profile}
      />



      {bothComplete && (
        <div className="text-center pt-4">
          <Button onClick={handleDone} size="lg" className="w-full">
            Done - Go to Home
          </Button>
        </div>
      )}
    </div>
  );
}