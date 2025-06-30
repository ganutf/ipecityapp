import { useState } from "react";
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
  });

  // Update completion states based on member status (matching Profile page logic)
  const isEmailVerified = memberStatus?.member?.emailVerified || false;
  const isPassportVerified = !!memberStatus?.member?.ipePassport;
  const bothComplete = isEmailVerified && isPassportVerified;

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
        currentPassport={memberStatus?.member?.ipePassport}
        isVerified={isPassportVerified}
        onVerificationComplete={handlePassportComplete}
        allowChange={true}
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