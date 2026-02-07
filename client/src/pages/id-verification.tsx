import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { Mail, Shield, CheckCircle, Clock } from "lucide-react";

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
  
  // Debug logging
  console.log("ID Verification Page - Email verification status:", {
    isEmailVerified,
    memberEmailVerified: memberStatus?.member?.emailVerified,
    memberStatus: memberStatus?.status,
    memberEmail: memberStatus?.member?.email,
    memberData: memberStatus?.member
  });
  
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading verification status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="bg-gradient-to-r from-slate-800 to-sky-600 rounded-t-xl px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">ID Verification</h1>
                  <p className="text-slate-200 mt-1">
                    Complete both email and passport verification to access all features
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-6 text-white/90">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {isEmailVerified && isPassportVerified ? '2' : (isEmailVerified || isPassportVerified ? '1' : '0')}/2
                  </div>
                  <div className="text-sm text-slate-200">Complete</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress indicators */}
          <div className="px-8 py-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {isEmailVerified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${isEmailVerified ? 'text-green-700' : 'text-gray-600'}`}>
                  Email Verification
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isPassportVerified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${isPassportVerified ? 'text-green-700' : 'text-gray-600'}`}>
                  Passport Verification
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* Email Verification Section */}
      <Card className="border-l-4 border-l-lime-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-lime-600" />
            Email Verification
          </CardTitle>
          <CardDescription>
            Manage your email address and verification status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailVerificationSection
            farcasterFid={profile?.fid || 0}
            currentEmail={memberStatus?.member?.email || ""}
            isVerified={memberStatus?.member?.emailVerified || false}
            onVerificationComplete={handleEmailComplete}
            allowChange={true}
          />
        </CardContent>
      </Card>

      {/* Passport Verification Section */}
      <div className="border-l-4 border-l-sky-500 bg-white shadow-sm hover:shadow-md transition-all duration-200 rounded-lg">
        <PassportVerificationSection
          farcasterFid={profile?.fid || 0}
          currentPassport={memberStatus?.member?.ipePassport}
          isVerified={isPassportVerified}
          onVerificationComplete={handlePassportComplete}
          allowChange={false}
          memberData={memberStatus}
          farcasterProfile={profile}
          context="id-verification"
        />
      </div>



      {bothComplete && (
        <Card className="border-l-4 border-l-green-500 bg-green-50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900">Verification Complete!</h3>
                <p className="text-green-700 text-sm">
                  Both email and passport verification have been completed successfully.
                </p>
              </div>
            </div>
            <Button 
              onClick={handleDone} 
              size="lg" 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Continue to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}