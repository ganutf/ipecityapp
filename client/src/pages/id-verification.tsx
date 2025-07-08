import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { Mail, Globe, CheckCircle, AlertCircle, Wallet } from "lucide-react";

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
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  
  const [emailComplete, setEmailComplete] = useState(false);
  const [passportComplete, setPassportComplete] = useState(false);

  // ENS lookup for connected wallet
  const { ensName, isLoading: ensLoading } = useEnsLookup(address || "");

  // Passport verification mutation
  const verifyPassportMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/passport/verify`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          ensName: ensName,
          walletAddress: address,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Membership activated",
        description: "Your Ipê City membership has been activated successfully.",
      });
      handlePassportComplete();
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error?.message || "Failed to verify passport ownership.",
        variant: "destructive",
      });
    },
  });

  // Check member status to determine current verification state
  const { data: memberStatus, refetch, isLoading: memberLoading } = useQuery<MemberStatus>({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,

  });

  // Update completion states based on member status (matching Profile page logic)
  const isEmailVerified = memberStatus?.member?.emailVerified || false;
  const isPassportVerified = !!memberStatus?.member?.ipePassport;
  const hasIpeCityDomain = ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth');
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

      {/* Email Verification Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Ipê Passport
          </CardTitle>
          <CardDescription>
            Connect your wallet and verify your ENS domain
            {!isPassportVerified && !isConnected && (
              <span className="text-xs text-gray-500 block mt-1">(wallet connection required)</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memberStatus?.member?.ipePassport || hasIpeCityDomain ? (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">ENS Domain</p>
                    <p className="text-sm text-green-700 font-mono">
                      {memberStatus?.member?.ipePassport || ensName}
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </div>
              {address && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Associated Wallet</p>
                  <p className="text-xs font-mono text-blue-700">
                    {address}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {isConnected ? (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-800">Connected Wallet</p>
                        <p className="text-xs font-mono text-blue-700">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                        {ensLoading && (
                          <p className="text-xs text-blue-600 mt-1">Looking up ENS domain...</p>
                        )}
                        {ensName && !hasIpeCityDomain && (
                          <p className="text-xs text-blue-600 mt-1">ENS: {ensName}</p>
                        )}
                      </div>
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  
                  {hasIpeCityDomain ? (
                    <Button 
                      onClick={() => verifyPassportMutation.mutate()}
                      disabled={verifyPassportMutation.isPending}
                      className="w-full"
                    >
                      {verifyPassportMutation.isPending ? "Activating..." : "Activate Membership"}
                    </Button>
                  ) : ensName && !hasIpeCityDomain ? (
                    <div className="text-center space-y-3">
                      <div className="text-sm text-gray-600">
                        This wallet doesn't own an Ipê City domain.
                      </div>
                      <Button 
                        onClick={() => {
                          // Handle application process or show application form
                          toast({
                            title: "Application Process",
                            description: "Please complete email verification first to apply for membership.",
                          });
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Apply for Membership
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="text-sm text-gray-600">
                        No ENS domain found for this wallet.
                      </div>
                      <Button 
                        onClick={() => {
                          // Handle application process
                          toast({
                            title: "Application Process", 
                            description: "Please complete email verification first to apply for membership.",
                          });
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Apply for Membership
                      </Button>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    onClick={() => disconnect()}
                    className="w-full"
                  >
                    Disconnect Wallet
                  </Button>
                </div>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <Button onClick={openConnectModal} className="w-full">
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </Button>
                  )}
                </ConnectButton.Custom>
              )}
            </div>
          )}
        </CardContent>
      </Card>



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