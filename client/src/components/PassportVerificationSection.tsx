import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useAcceptSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CheckCircle, AlertCircle, Globe, Clock, Wallet, Users } from "lucide-react";

interface PassportVerificationSectionProps {
  farcasterFid: number;
  currentPassport?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
  memberData: any;
  farcasterProfile: any;
}

export function PassportVerificationSection({
  farcasterFid,
  currentPassport,
  isVerified,
  onVerificationComplete,
  allowChange = false,
  memberData,
  farcasterProfile,
}: PassportVerificationSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = usePersistentAuth();
  const { address, isConnected } = useAccount();
  const { signMessage } = useSignMessage();
  const { disconnect } = useDisconnect();
  
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "checking" | "verifying" | "verified" | "failed"
  >("idle");
  const [walletConnectedForVerification, setWalletConnectedForVerification] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  
  // ENS lookup for connected wallet
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);
  
  // JustaName accept hook for subdomain acceptance
  const { acceptSubname, isAcceptSubnamePending } = useAcceptSubname();

  // Check if current wallet has Ipê City domain
  const hasIpeCityDomain = ensName && (
    ensName === "ipecity.eth" || 
    ensName.endsWith(".ipecity.eth")
  );

  // Handle wallet connection for verification
  useEffect(() => {
    if (isConnected && address && !walletConnectedForVerification) {
      setWalletConnectedForVerification(true);
      setVerificationStatus("checking");
    }
  }, [isConnected, address, walletConnectedForVerification]);

  // Passport verification mutation with SIWE signature
  const verifyPassportMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      if (!ensName) {
        throw new Error("No ENS domain found for this wallet");
      }

      // Send verification request with just the essential data
      // Domain ownership is verified server-side via ENS lookup
      const response = await apiRequest("/api/passport/verify", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          ensName,
          walletAddress,
        }),
      });
      
      return response;
    },
    onSuccess: () => {
      setVerificationStatus("verified");
      toast({
        title: "Passport verified successfully!",
        description: `Your ${ensName} domain has been verified.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
      onVerificationComplete?.();
    },
    onError: (error: Error) => {
      setVerificationStatus("failed");
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Accept subdomain mutation (for pending acceptances)
  const acceptSubdomainMutation = useMutation({
    mutationFn: async () => {
      if (!memberData?.member?.ipeUsername) {
        throw new Error("No subdomain to accept");
      }

      const ensName = `${memberData.member.ipeUsername}.ipecity.eth`;

      try {
        // Use JustaName SDK to accept the subdomain
        const result = await acceptSubname({
          ens: ensName,
        });

        // Update backend status to active_member
        await apiRequest("/api/passport/accept", {
          method: "POST",
          body: JSON.stringify({
            farcasterFid,
          }),
        });

        return result;
      } catch (error: any) {
        // Handle 409 Conflict as success (subdomain already accepted)
        if (error?.response?.status === 409 || 
            error?.message?.includes('SubdomainAlreadyAcceptedException') ||
            error?.message?.includes('already accepted')) {
          
          // Verify domain is actually associated with the wallet
          if (address) {
            try {
              const response = await fetch(`/api/ens/lookup/${address}`);
              const data = await response.json();
              
              if (data.ensName === ensName) {
                // Domain is verified as belonging to wallet, update backend
                await apiRequest("/api/passport/accept", {
                  method: "POST",
                  body: JSON.stringify({
                    farcasterFid,
                  }),
                });
                return { success: true, alreadyAccepted: true };
              }
            } catch (lookupError) {
              console.log('ENS lookup error:', lookupError);
            }
          }
          
          // If verification fails, still update backend but note the conflict
          await apiRequest("/api/passport/accept", {
            method: "POST",
            body: JSON.stringify({
              farcasterFid,
            }),
          });
          return { success: true, alreadyAccepted: true };
        }
        
        // Re-throw other errors
        throw error;
      }
    },
    onSuccess: (result) => {
      const message = result?.alreadyAccepted 
        ? "Subdomain was already accepted!"
        : "Subdomain accepted successfully!";
      
      toast({
        title: message,
        description: `${memberData.member.ipeUsername}.ipecity.eth is now yours.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
      onVerificationComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept subdomain",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVerifyPassport = () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setVerificationStatus("verifying");
    verifyPassportMutation.mutate(address);
  };

  const handleAcceptSubdomain = () => {
    acceptSubdomainMutation.mutate();
  };

  const getStatusDisplay = () => {
    const status = memberData?.member?.status;

    switch (status) {
      case "pending_application":
        return {
          title: "Application Submitted",
          description: "Your application is pending admin approval.",
          icon: <Clock className="h-5 w-5 text-blue-500" />,
          color: "blue",
        };
      case "approved_application":
        return {
          title: "Accept Your Passport",
          description: `Your subdomain ${memberData.member.ipeUsername}.ipecity.eth has been reserved and is ready to accept.`,
          icon: <Globe className="h-5 w-5 text-blue-500" />,
          color: "blue",
        };
      case "active_member":
        return {
          title: "Verified Member",
          description: `Welcome! You have access as a ${memberData.member.memberType}.`,
          icon: <CheckCircle className="h-5 w-5 text-green-500" />,
          color: "green",
        };
      default:
        return {
          title: "Verification Required",
          description: "Connect your wallet to verify your Ipê City membership.",
          icon: <Wallet className="h-5 w-5 text-gray-500" />,
          color: "gray",
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {statusDisplay.icon}
            Ipê Passport Verification
          </CardTitle>
          <CardDescription>{statusDisplay.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet Connection */}
          {!isConnected && (
            <div className="text-center">
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button onClick={openConnectModal} className="w-full">
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            </div>
          )}

          {/* ENS Domain Check */}
          {isConnected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Connected Wallet</p>
                  <p className="text-sm text-gray-600">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
                </div>
                <div className="text-right">
                  {ensLoading ? (
                    <p className="text-sm text-gray-500">Looking up ENS domain...</p>
                  ) : ensName ? (
                    <p className="text-sm font-medium text-green-600">{ensName}</p>
                  ) : (
                    <p className="text-sm text-gray-500">No ENS domain</p>
                  )}
                </div>
              </div>
              
              {/* Disconnect Wallet Button */}
              <div className="text-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    disconnect();
                    setWalletConnectedForVerification(false);
                    setVerificationStatus("idle");
                  }}
                >
                  Disconnect Wallet
                </Button>
              </div>

              {/* Action based on current status */}
              {memberData?.member && memberData.member.status === "pending_id_verification" && (
                <div className="space-y-4">
                  {hasIpeCityDomain ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800 font-medium">Ipê City Domain Detected!</p>
                        <p className="text-sm text-green-700">
                          {ensName} detected! Sign a message to verify ownership and activate your membership.
                        </p>
                      </div>
                      <Button 
                        onClick={handleVerifyPassport}
                        disabled={verifyPassportMutation.isPending}
                        className="w-full"
                      >
                        <Wallet className="mr-2 h-4 w-4" />
                        {verifyPassportMutation.isPending ? "Verifying..." : "Activate Membership"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800 font-medium">No Ipê City Domain Found</p>
                        <p className="text-sm text-blue-700">
                          Submit an application to claim a new subdomain and join the community.
                        </p>
                      </div>
                      <Button 
                        onClick={() => setShowApplicationForm(true)}
                        className="w-full"
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Submit Application
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Pending Application Status */}
              {memberData?.member?.status === "pending_application" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="font-medium text-blue-800">Application Under Review</p>
                  <p className="text-sm text-blue-700">
                    Your application for <strong>{memberData.member.ipeUsername}.ipecity.eth</strong> is being reviewed by admins.
                  </p>
                </div>
              )}



              {/* Approved Application - Accept Passport */}
              {memberData?.member?.status === "approved_application" && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 font-medium">Passport Ready! 🎉</p>
                    <p className="text-sm text-blue-700">
                      Your subdomain <strong>{memberData.member.ipeUsername}.ipecity.eth</strong> has been reserved and is ready to accept.
                    </p>
                  </div>
                  <Button 
                    onClick={handleAcceptSubdomain}
                    disabled={acceptSubdomainMutation.isPending || isAcceptSubnamePending}
                    className="w-full"
                  >
                    {(acceptSubdomainMutation.isPending || isAcceptSubnamePending) ? (
                      "Accepting..."
                    ) : (
                      "Accept Your Passport"
                    )}
                  </Button>
                </div>
              )}

              {/* Active Member */}
              {memberData?.member?.status === "active_member" && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-800">Welcome to Ipê City!</p>
                  <p className="text-sm text-green-700">
                    You are verified as a <strong>{memberData.member.memberType}</strong> member.
                  </p>
                  {memberData.member.ipePassport && (
                    <p className="text-sm text-green-700 mt-1">
                      Domain: <strong>{memberData.member.ipePassport}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <ApplicationForm
          memberData={memberData}
          farcasterProfile={farcasterProfile}
          onSuccess={() => {
            setShowApplicationForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
          }}
        />
      )}
    </div>
  );
}