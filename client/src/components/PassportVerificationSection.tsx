import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { authenticatedPost } from "@/lib/api";
import { useSignMessage } from "wagmi";
import { useConnectWallet } from "@privy-io/react-auth";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { createSiweMessage } from "viem/siwe";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { useAuth } from "@/contexts/AuthContext";
import { useAcceptSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CheckCircle, AlertCircle, Globe, Clock, Wallet, Users } from "lucide-react";

interface PassportMemberData {
  isMember: boolean;
  status?: string;
  member?: {
    id: number;
    email?: string | null;
    status: string;
    ipeUsername?: string | null;
    walletAddress?: string | null;
    memberType: string;
    ipePassport?: string | null;
  };
}

interface PassportVerificationSectionProps {
  memberId: number;
  currentPassport?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  memberData: PassportMemberData;
  context?: 'profile' | 'id-verification';
  variant?: 'default' | 'wizard';
}

export function PassportVerificationSection({
  memberId,
  currentPassport,
  isVerified,
  onVerificationComplete,
  memberData,
  context = 'profile',
  variant = 'default',
}: PassportVerificationSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { member: authMember, refreshMember } = useAuth();

  const { connectWallet } = useConnectWallet();
  const { activeWallet, isExternalWallet, disconnectExternalWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;
  const isConnected = !!activeWallet;

  // Keep useSignMessage from wagmi (works with @privy-io/wagmi)
  const { signMessage } = useSignMessage();

  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "checking" | "verifying" | "verified" | "failed"
  >("idle");
  const [walletConnectedForVerification, setWalletConnectedForVerification] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  // ENS lookup for connected wallet
  const { ensName, ensNames, isLoading: ensLoading } = useEnsLookup(address);

  // Hide application form if user gets approved
  useEffect(() => {
    if (memberData?.member?.status === "approved_application" || memberData?.member?.status === "active_member") {
      setShowApplicationForm(false);
    }
  }, [memberData?.member?.status]);

  // Set default selected domain when domains are loaded
  useEffect(() => {
    if (ensNames.length > 0 && !selectedDomain) {
      setSelectedDomain(ensNames[0]);
    }
  }, [ensNames, selectedDomain]);

  // JustaName accept hook for subdomain acceptance
  const { acceptSubname, isAcceptSubnamePending } = useAcceptSubname();

  // Check if current wallet has Ipê City domain - explicit boolean
  const hasIpeCityDomain = ensNames.length > 0;



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
      if (!selectedDomain) {
        throw new Error("No ENS domain selected for verification");
      }

      // Create SIWE message for signature verification
      const message = createSiweMessage({
        address: walletAddress as `0x${string}`,
        chainId: mainnet.id,
        domain: window.location.host,
        uri: window.location.origin,
        version: "1",
        statement: `Verify ownership of ${selectedDomain} for Ipe City membership activation.`,
        nonce: Math.random().toString(36).substring(2, 15),
      });

      // Request signature from user's wallet
      return new Promise((resolve, reject) => {
        signMessage(
          { message },
          {
            onSuccess: async (signature) => {
              try {
                // Send verification request with signature (uses v2 endpoint with memberId)
                const response = await authenticatedPost("/api/v2/auth/passport/verify", {
                    memberId,
                    ensName: selectedDomain,
                    walletAddress,
                    message,
                    signature,
                });
                resolve(response);
              } catch (error) {
                reject(error);
              }
            },
            onError: (error) => {
              reject(new Error("Signature verification cancelled or failed"));
            },
          }
        );
      });
    },
    onSuccess: () => {
      setVerificationStatus("verified");
      toast({
        title: "Passport verified successfully!",
        description: `Your ${selectedDomain} domain has been verified.`,
      });
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      }
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
  const acceptSubdomainMutation = useMutation<{ success: boolean; alreadyAccepted?: boolean } | any>({
    mutationFn: async (): Promise<{ success: boolean; alreadyAccepted?: boolean } | any> => {
      if (!memberData?.member?.ipeUsername) {
        throw new Error("No subdomain to accept");
      }

      const ensName = `${memberData.member.ipeUsername}.ipecity.eth`;

      try {
        // Use JustaName SDK to accept the subdomain
        const result = await acceptSubname({
          ens: ensName,
        });

        // Update backend status to active_member (uses v2 endpoint with memberId)
        await authenticatedPost("/api/v2/auth/passport/accept", { memberId });

        return result;
      } catch (error: any) {
        // Handle 409 Conflict as success (subdomain already accepted)
        if (error?.response?.status === 409 ||
          error?.message?.includes('SubdomainAlreadyAcceptedException') ||
          error?.message?.includes('already accepted')) {

          // Verify domain is actually associated with the wallet
          if (address) {
            try {
              const response = await fetch(`/api/v2/passport/ens/lookup/${address}`);
              const data = await response.json();

              if (data.ensName === ensName) {
                // Domain is verified as belonging to wallet, update backend
                await authenticatedPost("/api/v2/auth/passport/accept", { memberId });
                return { success: true, alreadyAccepted: true };
              }
            } catch (lookupError) {
              // ENS lookup failed — fall through to backend update
            }
          }

          // If verification fails, still update backend but note the conflict
          await authenticatedPost("/api/v2/auth/passport/accept", { memberId });
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
        description: `${memberData.member?.ipeUsername}.ipecity.eth is now yours.`,
      });
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      }
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
    const requiredWallet = memberData.member?.walletAddress?.toLowerCase();
    const connectedWallet = address?.toLowerCase();

    if (!connectedWallet) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to accept your passport.",
        variant: "destructive",
      });
      return;
    }

    if (requiredWallet && connectedWallet !== requiredWallet) {
      toast({
        title: "Wrong wallet connected",
        description: `Please connect the wallet registered for this passport: ${requiredWallet.slice(0, 6)}...${requiredWallet.slice(-4)}`,
        variant: "destructive",
      });
      return;
    }

    acceptSubdomainMutation.mutate();
  };

  const getStatusDisplay = () => {
    const status = memberData?.member?.status;

    switch (status) {
      case "pending_application_review":
        return {
          title: "Application Submitted",
          description: "Your application is pending admin approval.",
          icon: <Clock className="h-5 w-5 text-blue-500" />,
          color: "blue",
        };
      case "approved_application":
        return {
          title: "Accept Your Passport",
          description: `Your subdomain ${memberData.member?.ipeUsername}.ipecity.eth has been reserved and is ready to accept.`,
          icon: <Globe className="h-5 w-5 text-blue-500" />,
          color: "blue",
        };
      case "active_member":
        return {
          title: "Verified Member",
          description: `Welcome! You have access as a ${memberData.member?.memberType}.`,
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
  const isWizard = variant === 'wizard';

  const bodyContent = (
    <div className="space-y-4">
      {/* Wallet Connection - hidden in wizard mode (already completed) */}
      {!isWizard && !isConnected && (
        <div className="text-center">
          <Button onClick={() => connectWallet()} className="w-full">
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      )}

      {/* ENS Domain Check */}
      {isConnected && (
        <div className="space-y-3">
          {/* Wallet info row - compact in wizard mode */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">{context === 'id-verification' ? 'Connected Wallet' : 'Associated Wallet'}</p>
              <p className="text-sm text-gray-600">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
            </div>
            <div className="text-right">
              {ensLoading ? (
                <p className="text-sm text-gray-500">Looking up ENS domain...</p>
              ) : ensNames.length > 1 ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-600">{ensNames.length} domains found</p>
                  <p className="text-xs text-gray-500">Selected: {selectedDomain}</p>
                </div>
              ) : ensNames.length === 1 ? (
                <p className="text-sm font-medium text-green-600">{ensNames[0]}</p>
              ) : (
                <p className="text-sm text-gray-500">No Ipe City domain</p>
              )}
            </div>
          </div>

          {/* Disconnect External Wallet Button - hidden in wizard mode */}
          {!isWizard && isExternalWallet && disconnectExternalWallet && (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  disconnectExternalWallet();
                  setWalletConnectedForVerification(false);
                  setVerificationStatus("idle");
                }}
              >
                Disconnect Wallet
              </Button>
            </div>
          )}

          {/* Show domain verification button if Ipe City domain is found */}
          {isConnected && address && !ensLoading && hasIpeCityDomain &&
            memberData?.member?.status !== "approved_application" &&
            memberData?.member?.status !== "active_member" && (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">
                  {ensNames.length > 1 ? 'Multiple Ipe City Domains Found!' : 'Ipe City Domain Detected!'}
                </p>
                <p className="text-sm text-green-700">
                  {ensNames.length > 1
                    ? 'Choose which domain to verify with:'
                    : `${selectedDomain} detected! Sign a message to verify ownership.`
                  }
                </p>
              </div>

              {/* Domain Selection UI */}
              {ensNames.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Select domain to verify:</p>
                  <div className="space-y-2">
                    {ensNames.map((domain) => (
                      <label key={domain} className="flex items-center space-x-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name="selectedDomain"
                          value={domain}
                          checked={selectedDomain === domain}
                          onChange={(e) => setSelectedDomain(e.target.value)}
                          className="text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-900">{domain}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleVerifyPassport}
                disabled={verifyPassportMutation.isPending || !selectedDomain}
                className="w-full"
              >
                <Wallet className="mr-2 h-4 w-4" />
                {verifyPassportMutation.isPending ? "Signing..." : `Sign & Activate with ${selectedDomain}`}
              </Button>
            </div>
          )}

          {/* Show application button only if NO Ipe City domain is found AND not approved */}
          {isConnected && address && !ensLoading && hasIpeCityDomain === false &&
            memberData?.member?.status !== "approved_application" &&
            memberData?.member?.status !== "active_member" &&
            memberData?.member?.status !== "pending_application_review" && (
              <div className="space-y-4">
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                  <p className="text-sky-800 font-medium">No Ipe City Domain Found</p>
                  <p className="text-sm text-sky-700">
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

          {/* Pending Application Status */}
          {memberData?.member?.status === "pending_application_review" && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-center">
              <Clock className="h-8 w-8 text-sky-500 mx-auto mb-2" />
              <p className="font-medium text-sky-800">Application Under Review</p>
              <p className="text-sm text-sky-700">
                Your application for <strong>{memberData.member?.ipeUsername}.ipecity.eth</strong> is being reviewed by admins.
              </p>
            </div>
          )}

          {/* Approved Application - Accept Passport */}
          {memberData?.member?.status === "approved_application" && (
            <div className="space-y-3">
              <div className="p-3 bg-lime-50 border border-lime-200 rounded-lg">
                <p className="text-lime-800 font-medium">Passport Ready!</p>
                <p className="text-sm text-lime-700">
                  Your subdomain <strong>{memberData.member?.ipeUsername}.ipecity.eth</strong> has been reserved and is ready to accept.
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
              <p className="font-medium text-green-800">Welcome to Ipe City!</p>
              <p className="text-sm text-green-700">
                You are verified as a <strong>{memberData.member?.memberType}</strong> member.
              </p>
              {memberData.member?.ipePassport && (
                <p className="text-sm text-green-700 mt-1">
                  Domain: <strong>{memberData.member.ipePassport}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {isWizard ? (
        bodyContent
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {statusDisplay.icon}
              Ipe Passport Verification
            </CardTitle>
            <CardDescription>{statusDisplay.description}</CardDescription>
          </CardHeader>
          <CardContent>{bodyContent}</CardContent>
        </Card>
      )}

      {/* Application Form - Only show if not approved */}
      {showApplicationForm && memberData?.member?.status !== "approved_application" && memberData?.member?.status !== "active_member" && (
        <ApplicationForm
          memberData={memberData}
          memberId={memberId}
          onSuccess={() => {
            setShowApplicationForm(false);
            refreshMember();
            if (queryClient) {
              queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
            }
          }}
        />
      )}
    </div>
  );
}