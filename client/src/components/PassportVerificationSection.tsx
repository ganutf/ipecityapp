import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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

interface PassportVerificationSectionProps {
  farcasterFid: number;
  currentPassport?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
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
  
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { ensName, isLoading: ensLoading, error: ensError } = useEnsLookup(address);

  // Claim passport
  const claimPassportMutation = useMutation({
    mutationFn: async (passportName: string) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      // Create SIWE message for claiming
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

      // Submit claim
      return apiRequest("/api/passport/claim", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          ipePassport: passportName,
          walletAddress: address,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Ipê Passport Verification
          {passportVerified && <span className="text-green-600">✓</span>}
        </CardTitle>
        <CardDescription>
          {passportVerified 
            ? "Your Ipê City passport has been verified."
            : "Connect your wallet to verify ownership of an Ipê City domain."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {passportVerified ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">Verified Passport</div>
              <p className="text-sm text-gray-600">{currentPassport}</p>
            </div>
            <div>
              <div className="text-sm font-medium">Connected Wallet</div>
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