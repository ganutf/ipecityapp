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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useAddSubname, useAcceptSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";
import { UsernameClaimSection } from "@/components/UsernameClaimSection";
import { CheckCircle, AlertCircle } from "lucide-react";

interface PassportVerificationSectionProps {
  farcasterFid: number;
  currentPassport?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
}

interface MemberData {
  isMember: boolean;
  approved: boolean;
  status?: string;
  member?: {
    passportClaimSubdomain?: string;
    passportClaimStatus?: string;
    ipePassport?: string;
    ipeUsername?: string;
    farcasterFid?: number;
  };
}

interface AcceptanceSectionProps {
  memberData: MemberData;
  onAcceptSuccess: () => void;
}

function AcceptanceSection({ memberData, onAcceptSuccess }: AcceptanceSectionProps) {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  
  // JustaName client-side accept hook
  const { acceptSubname, isAcceptSubnameLoading, acceptSubnameError } = useAcceptSubname({
    ensDomains: [
      {
        ensDomain: "ipecity.eth",
        chainId: mainnet.id,
        apiKey: import.meta.env.VITE_JUSTANAME_API_KEY,
        origin: window.location.origin,
      },
    ],
  });

  // Backend status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/passport/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          farcasterFid: memberData.member?.farcasterFid 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update member status");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Passport accepted successfully. You now have full access!",
      });
      onAcceptSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAcceptPassport = async () => {
    try {
      if (!isConnected || !address) {
        toast({
          title: "Connect wallet",
          description: "Please connect your wallet to accept your passport.",
          variant: "destructive",
        });
        return;
      }

      const username = memberData.member?.ipeUsername || memberData.member?.passportClaimSubdomain;
      if (!username) {
        toast({
          title: "Error",
          description: "No username found to accept.",
          variant: "destructive",
        });
        return;
      }

      // First, accept the subdomain with user's wallet signature
      await acceptSubname({
        username,
        ensDomain: "ipecity.eth",
        chainId: mainnet.id,
      });

      // Then update backend status
      statusUpdateMutation.mutate();
      
    } catch (error: any) {
      console.error("Accept passport error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept passport",
        variant: "destructive",
      });
    }
  };

  const subdomainName = memberData.member?.ipeUsername 
    ? `${memberData.member.ipeUsername}.ipecity.eth`
    : memberData.member?.passportClaimSubdomain
    ? `${memberData.member.passportClaimSubdomain}.ipecity.eth`
    : memberData.member?.ipePassport;

  const isLoading = isAcceptSubnameLoading || statusUpdateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-medium text-blue-800">Passport Reserved</span>
        </div>
        <p className="text-sm text-blue-700 mb-3">
          Your passport <span className="font-mono font-medium">{subdomainName}</span> has been reserved by an admin.
        </p>
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <span>Click "Accept Your Passport" to sign with your wallet and complete the process</span>
        </div>
      </div>

      {!isConnected && (
        <div className="text-center">
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, mounted }) => {
              return (
                <Button
                  onClick={openConnectModal}
                  variant="outline"
                  className="w-full mb-2"
                >
                  Connect Wallet to Accept
                </Button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      )}

      <Button
        onClick={handleAcceptPassport}
        disabled={!isConnected || isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Accepting...
          </>
        ) : (
          "Accept Your Passport"
        )}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        By accepting, you acknowledge ownership of the passport and agree to complete the registration process.
      </p>

      {acceptSubnameError && (
        <div className="text-sm text-red-600 text-center">
          {acceptSubnameError.message}
        </div>
      )}
    </div>
  );
}

export function PassportVerificationSection({
  farcasterFid,
  currentPassport = "",
  isVerified = false,
  onVerificationComplete,
  allowChange = false,
}: PassportVerificationSectionProps) {
  const [passportVerified, setPassportVerified] = useState(isVerified);
  const [passportVerificationSent, setPassportVerificationSent] =
    useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const {
    ensName,
    isLoading: ensLoading,
    error: ensError,
  } = useEnsLookup(address);



  // Query member status to check passport claim status
  const { data: memberData, refetch: refetchMemberStatus } =
    useQuery<MemberData>({
      queryKey: [`/api/members/check/${farcasterFid}`],
      enabled: !!farcasterFid,
      refetchInterval: (query) => {
        // Poll if verification was sent OR if claim is pending approval
        if (passportVerificationSent || (query.state.data as any)?.member?.passportClaimStatus === 'pending') {
          return 10000; // 10 seconds
        }
        return false;
      },
    });

  // Update states based on member data
  useEffect(() => {
    if (memberData?.member) {
      const { ipePassport, passportClaimStatus } = memberData.member;

      // If passport is verified/approved, update state
      if (ipePassport) {
        setPassportVerified(true);
        setPassportVerificationSent(false);
        onVerificationComplete?.();
      }

      // Handle claim status updates
      if (passportClaimStatus === "approved" && !ipePassport) {
        // Admin approved but passport not yet set - this shouldn't happen normally
        refetchMemberStatus();
      } else if (passportClaimStatus === "denied") {
        setPassportVerificationSent(false);
        toast({
          title: "Passport claim denied",
          description:
            "Your passport claim was not approved. You can try claiming a different passport.",
          variant: "destructive",
        });
      }
    }
  }, [memberData, onVerificationComplete, refetchMemberStatus, toast]);



  // Verify passport ownership
  const verifyPassportMutation = useMutation({
    mutationFn: async () => {
      if (!address || !ensName) {
        throw new Error("Wallet not connected or ENS domain not found");
      }

      // Create SIWE message for verification
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: `I verify that I own the Ipê City domain: ${ensName}`,
        uri: window.location.origin,
        version: "1",
        chainId: 1,
        nonce: Math.random().toString(36).substring(2, 15),
      });

      const signature = await signMessageAsync({ message });

      return apiRequest("/api/passport/verify", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          walletAddress: address,
          ensName,
          message,
          signature,
        }),
      });
    },
    onSuccess: () => {
      setPassportVerified(true);
      setPassportVerificationSent(true);
      toast({
        title: "Passport verified",
        description: "Your Ipê City passport has been successfully verified.",
      });
      onVerificationComplete?.();
    },
    onError: (error: any) => {
      // Only show error toast if it's not a network/loading issue
      if (!error?.message?.includes("fetch")) {
        toast({
          title: "Verification failed",
          description: error.message || "Failed to verify passport ownership.",
          variant: "destructive",
        });
      }
    },
  });

  const handleVerifyPassport = () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect wallet",
        description: "Please connect your wallet to verify passport ownership.",
        variant: "destructive",
      });
      return;
    }

    if (!ensName) {
      toast({
        title: "No Ipê City domain",
        description:
          "This wallet doesn't own an Ipê City domain (ipecity.eth or *.ipecity.eth).",
        variant: "destructive",
      });
      return;
    }

    verifyPassportMutation.mutate();
  };

  const resetVerification = () => {
    setPassportVerified(false);
    setPassportVerificationSent(false);
    if (isConnected) {
      disconnect();
    }
  };

  const isIpeCityDomain =
    ensName && (ensName === "ipecity.eth" || ensName.endsWith(".ipecity.eth"));

  // Determine current status and display appropriate message
  const getStatusDisplay = () => {
    if (passportVerified) {
      return {
        status: "✓ Verified",
        color: "text-green-600",
        description: "Your Ipê City passport has been verified.",
      };
    }

    if (memberData?.status === "pending_acceptance") {
      const subdomainName = memberData.member?.ipeUsername 
        ? `${memberData.member.ipeUsername}.ipecity.eth`
        : memberData.member?.ipePassport;
      return {
        status: "🔑 Accept Your Passport",
        color: "text-blue-600",
        description: `Your passport ${subdomainName} is ready for acceptance.`,
      };
    }

    if (memberData?.member?.passportClaimStatus === "pending") {
      return {
        status: "⏳ Pending Approval",
        color: "text-yellow-600",
        description: `Your claim for ${memberData.member.passportClaimSubdomain}.ipecity.eth is awaiting admin approval.`,
      };
    }

    if (memberData?.member?.passportClaimStatus === "denied") {
      return {
        status: "❌ Denied",
        color: "text-red-600",
        description:
          "Your passport claim was denied. You can try claiming again.",
      };
    }

    if (passportVerificationSent) {
      return {
        status: "⏳ Submitted",
        color: "text-yellow-600",
        description: "Your passport claim has been submitted for approval.",
      };
    }

    return {
      status: "",
      color: "",
      description:
        "Connect your wallet to verify ownership of an Ipê City domain or claim a new one.",
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ipê Passport Verification
          {statusDisplay.status && (
            <span className={statusDisplay.color}>{statusDisplay.status}</span>
          )}
        </CardTitle>
        <CardDescription>{statusDisplay.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {passportVerified ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">Verified Passport</div>
              <p className="text-sm text-gray-600">{currentPassport}</p>
            </div>
            <div>
              <div className="text-sm font-medium">Wallet Connected</div>
              <p className="text-sm text-gray-600 break-all">{address}</p>
            </div>
            {allowChange && (
              <Button
                variant="outline"
                onClick={resetVerification}
                className="w-full"
              >
                Change Wallet / Re-verify
              </Button>
            )}
          </div>
        ) : memberData?.status === "pending_acceptance" ? (
          <AcceptanceSection 
            memberData={memberData}
            onAcceptSuccess={() => {
              refetchMemberStatus();
              onVerificationComplete?.();
            }}
          />
        ) : memberData?.member?.passportClaimStatus === "pending" ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800">
                Claim Pending Approval
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Your claim for{" "}
                <span className="font-mono">
                  {memberData.member.passportClaimSubdomain}.ipecity.eth
                </span>{" "}
                is being reviewed by administrators.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                You'll receive an email notification once your claim is
                processed.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetchMemberStatus()}
              className="w-full"
            >
              Check Status
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Wallet Connection</div>
              <div className="flex justify-center">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openConnectModal,
                    openAccountModal,
                    mounted,
                  }) => {
                    const ready = mounted;
                    const connected = ready && account && chain;

                    return (
                      <div
                        {...(!ready && {
                          "aria-hidden": true,
                          style: {
                            opacity: 0,
                            pointerEvents: "none",
                            userSelect: "none",
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <Button
                                onClick={openConnectModal}
                                className="w-full"
                              >
                                Connect Wallet
                              </Button>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-2 w-full">
                              <Button
                                onClick={openAccountModal}
                                variant="outline"
                                className="w-full"
                              >
                                {account.displayName}
                                {account.displayBalance &&
                                  ` (${account.displayBalance})`}
                              </Button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </div>

            {isConnected && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium">ENS Domain Status</div>
                  {ensLoading ? (
                    <p className="text-sm text-gray-500">
                      Looking up ENS domain...
                    </p>
                  ) : ensError ? (
                    <p className="text-sm text-red-500">
                      Error looking up ENS domain
                    </p>
                  ) : ensName ? (
                    <div className="space-y-1">
                      <p className="text-sm font-mono">{ensName}</p>
                      {isIpeCityDomain ? (
                        <p className="text-sm text-green-600">
                          ✓ Valid Ipê City domain
                        </p>
                      ) : (
                        <p className="text-sm text-orange-500">
                          ⚠ Not an Ipê City domain
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No ENS domain found for this wallet
                    </p>
                  )}
                </div>

                {isIpeCityDomain ? (
                  <Button
                    onClick={handleVerifyPassport}
                    disabled={verifyPassportMutation.isPending}
                    className="w-full"
                  >
                    {verifyPassportMutation.isPending
                      ? "Verifying..."
                      : "Verify Passport Ownership"}
                  </Button>
                ) : (
                  <div className="mt-6">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        No Ipê City domain found on this wallet. You can claim a new username below.
                      </p>
                    </div>
                    <UsernameClaimSection member={memberData?.member} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
