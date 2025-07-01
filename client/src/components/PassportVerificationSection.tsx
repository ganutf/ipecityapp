import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { createSiweMessage } from "viem/siwe";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useAddSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";

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
  };
}

export function PassportVerificationSection({
  farcasterFid,
  currentPassport = "",
  isVerified = false,
  onVerificationComplete,
  allowChange = false
}: PassportVerificationSectionProps) {
  const [passportVerified, setPassportVerified] = useState(isVerified);
  const [passportVerificationSent, setPassportVerificationSent] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimPassport, setClaimPassport] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { addSubname } = useAddSubname();
  const { ensName, isLoading: ensLoading, error: ensError } = useEnsLookup(address);
  const { profile } = usePersistentAuth();

  // Username sanitization function
  const sanitizeUsername = (username: string): string => {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
      .slice(0, 20); // Ensure max length
  };

  // Pre-fill passport name with sanitized Farcaster username when claim form opens
  useEffect(() => {
    if (showClaimForm && profile?.username && !claimPassport) {
      const sanitizedUsername = sanitizeUsername(profile.username);
      setClaimPassport(sanitizedUsername);
    }
  }, [showClaimForm, profile?.username, claimPassport]);

  // Query member status to check passport claim status
  const { data: memberData, refetch: refetchMemberStatus } = useQuery<MemberData>({
    queryKey: [`/api/members/check/${farcasterFid}`],
    enabled: !!farcasterFid,
    refetchInterval: passportVerificationSent ? 10000 : false, // Poll every 10 seconds when claim is pending
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
      if (passportClaimStatus === 'approved' && !ipePassport) {
        // Admin approved but passport not yet set - this shouldn't happen normally
        refetchMemberStatus();
      } else if (passportClaimStatus === 'denied') {
        setPassportVerificationSent(false);
        setShowClaimForm(false);
        toast({
          title: "Passport claim denied",
          description: "Your passport claim was not approved. You can try claiming a different passport.",
          variant: "destructive",
        });
      }
    }
  }, [memberData, onVerificationComplete, refetchMemberStatus, toast]);

  // Claim passport
  const claimPassportMutation = useMutation({
    mutationFn: async (passportName: string) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      console.log("=== PASSPORT CLAIMING PROCESS ===");
      console.log("Step 1: Creating subdomain with JustaName SDK...");
      console.log(`Subdomain: ${passportName}.ipecity.eth`);
      console.log("User wallet:", address);

      // Step 1: Create subdomain using JustaName SDK (user-initiated)
      try {
        const subdomainParams = {
          ensDomain: 'ipecity.eth',
          username: passportName,
          chainId: mainnet.id
        };
        
        console.log("Subdomain parameters:", subdomainParams);
        await addSubname(subdomainParams);
        console.log("✓ Subdomain created successfully with JustaName SDK");
      } catch (subdomainError) {
        console.error("✗ Subdomain creation failed:", subdomainError);
        throw new Error(`Failed to create subdomain: ${subdomainError.message || 'Unknown error'}`);
      }

      console.log("Step 2: Submitting claim to backend for admin approval...");

      // Step 2: Create SIWE message for claiming
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: `I claim the Ipê City passport: ${passportName}.ipecity.eth`,
        uri: window.location.origin,
        version: "1",
        chainId: 1,
        nonce: Math.random().toString(36).slice(2)
      });

      // Sign the message
      const signature = await signMessageAsync({ message });

      // Step 3: Submit claim to backend (subdomain already created)
      return apiRequest("/api/passport/claim", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          passportClaimSubdomain: passportName,
          passportClaimWalletAddress: address,
          signature,
          message
        }),
        headers: {
          "Content-Type": "application/json"
        }
      });
    },
    onSuccess: () => {
      setPassportVerificationSent(true);
      setShowClaimForm(false);
      toast({
        title: "Passport claim submitted",
        description: "Your passport claim has been submitted for admin approval.",
      });
      onVerificationComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Claim failed",
        description: error.message || "Failed to submit passport claim.",
        variant: "destructive",
      });
    },
  });

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
      if (!error?.message?.includes('fetch')) {
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
        description: "This wallet doesn't own an Ipê City domain (ipecity.eth or *.ipecity.eth).",
        variant: "destructive",
      });
      return;
    }

    verifyPassportMutation.mutate();
  };

  const resetVerification = () => {
    setPassportVerified(false);
    setPassportVerificationSent(false);
    setShowClaimForm(false);
    setClaimPassport("");
    if (isConnected) {
      disconnect();
    }
  };

  const handleClaimPassport = () => {
    if (!claimPassport.trim()) {
      toast({
        title: "Enter passport name",
        description: "Please enter a passport name to claim.",
        variant: "destructive",
      });
      return;
    }
    claimPassportMutation.mutate(claimPassport.trim());
  };

  const isIpeCityDomain = ensName && (ensName === 'ipecity.eth' || ensName.endsWith('.ipecity.eth'));
  
  // Determine current status and display appropriate message
  const getStatusDisplay = () => {
    if (passportVerified) {
      return { status: "✓ Verified", color: "text-green-600", description: "Your Ipê City passport has been verified." };
    }
    
    if (memberData?.member?.passportClaimStatus === 'pending') {
      return { 
        status: "⏳ Pending Approval", 
        color: "text-yellow-600", 
        description: `Your claim for ${memberData.member.passportClaimSubdomain}.ipecity.eth is awaiting admin approval.` 
      };
    }
    
    if (memberData?.member?.passportClaimStatus === 'denied') {
      return { 
        status: "❌ Denied", 
        color: "text-red-600", 
        description: "Your passport claim was denied. You can try claiming again." 
      };
    }
    
    if (passportVerificationSent) {
      return { 
        status: "⏳ Submitted", 
        color: "text-yellow-600", 
        description: "Your passport claim has been submitted for approval." 
      };
    }
    
    return { 
      status: "", 
      color: "", 
      description: "Connect your wallet to verify ownership of an Ipê City domain or claim a new one." 
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ipê Passport Verification
          {statusDisplay.status && <span className={statusDisplay.color}>{statusDisplay.status}</span>}
        </CardTitle>
        <CardDescription>
          {statusDisplay.description}
        </CardDescription>
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
        ) : memberData?.member?.passportClaimStatus === 'pending' ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800">
                Claim Pending Approval
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Your claim for <span className="font-mono">{memberData.member.passportClaimSubdomain}.ipecity.eth</span> is being reviewed by administrators.
              </p>
              <p className="text-xs text-yellow-600 mt-2">
                You'll receive an email notification once your claim is processed.
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
                          'aria-hidden': true,
                          style: {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <Button onClick={openConnectModal} className="w-full">
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
                                {account.displayBalance && ` (${account.displayBalance})`}
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
                    <p className="text-sm text-gray-500">Looking up ENS domain...</p>
                  ) : ensError ? (
                    <p className="text-sm text-red-500">Error looking up ENS domain</p>
                  ) : ensName ? (
                    <div className="space-y-1">
                      <p className="text-sm font-mono">{ensName}</p>
                      {isIpeCityDomain ? (
                        <p className="text-sm text-green-600">✓ Valid Ipê City domain</p>
                      ) : (
                        <p className="text-sm text-orange-500">⚠ Not an Ipê City domain</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No ENS domain found for this wallet</p>
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
                      : "Verify Passport Ownership"
                    }
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {!showClaimForm ? (
                      <Button
                        onClick={() => setShowClaimForm(true)}
                        className="w-full"
                      >
                        Claim New Ipê Passport
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="passport-name">Choose your passport name</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="passport-name"
                              type="text"
                              placeholder="username"
                              value={claimPassport}
                              onChange={(e) => setClaimPassport(e.target.value)}
                              className="flex-1"
                            />
                            <span className="flex items-center text-sm text-gray-500">.ipecity.eth</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleClaimPassport}
                            disabled={claimPassportMutation.isPending || !claimPassport.trim()}
                            className="flex-1"
                          >
                            {claimPassportMutation.isPending ? "Claiming..." : "Claim Passport"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowClaimForm(false)}
                            disabled={claimPassportMutation.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
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