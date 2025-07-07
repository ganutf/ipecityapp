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
import { CheckCircle, AlertCircle, Globe, Clock, Wallet, Users, RefreshCw } from "lucide-react";

interface Member {
  farcasterFid: number;
  walletAddress?: string;
  ipePassport?: string;
  passportVerified: boolean;
  status: string;
  walletRenewalStatus?: "pending_renewal" | "revoking_subdomain" | "awaiting_new_acceptance" | "completed" | null;
  newWalletAddress?: string;
  ipeUsername?: string;
  email?: string;
  emailVerified: boolean;
}

interface PassportVerificationSectionProps {
  farcasterFid: number;
  currentPassport?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
  memberData: Member;
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
  const { address, isConnected } = useAccount();
  const { signMessage } = useSignMessage();
  const { disconnect } = useDisconnect();
  
  // ENS lookup for connected wallet
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);
  
  // Check if current wallet has Ipê City domain
  const hasIpeCityDomain = ensName && (
    ensName === "ipecity.eth" || 
    ensName.endsWith(".ipecity.eth")
  );

  // Status polling for pending wallet renewal and awaiting acceptance
  const { data: memberStatus } = useQuery({
    queryKey: ["/api/members/check", farcasterFid],
    enabled: !!farcasterFid && (
      memberData?.walletRenewalStatus === "pending_renewal" || 
      memberData?.walletRenewalStatus === "awaiting_new_acceptance"
    ),
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Request wallet renewal mutation
  const requestWalletRenewalMutation = useMutation({
    mutationFn: async (newWalletAddress: string) => {
      return await apiRequest("/api/passport/request-wallet-update", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          newWalletAddress,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Update Requested",
        description: "Your wallet update request has been submitted for admin approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check", farcasterFid] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to request wallet update",
        variant: "destructive",
      });
    },
  });

  // Accept wallet renewal mutation (reuses existing pattern)
  const acceptWalletRenewalMutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Please connect your new wallet");
      }

      if (address !== memberData.newWalletAddress) {
        throw new Error("Connected wallet doesn't match the reserved renewal request");
      }

      return await apiRequest("/api/passport/accept-wallet-renewal", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          walletAddress: address,
          ensName: `${memberData.ipeUsername}.ipecity.eth`,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Renewal Complete",
        description: "Your passport has been successfully transferred to your new wallet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check", farcasterFid] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept wallet renewal",
        variant: "destructive",
      });
    },
  });

  // Handle wallet change request
  const handleWalletUpdateRequest = () => {
    if (!isConnected || !address) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your new wallet first",
        variant: "destructive",
      });
      return;
    }

    if (address === memberData.walletAddress) {
      toast({
        title: "Same Wallet",
        description: "This is the same wallet currently registered to your passport",
        variant: "destructive",
      });
      return;
    }

    requestWalletRenewalMutation.mutate(address);
  };

  const renderPassportStatus = () => {
    const passport = memberData.ipePassport || memberData.ipeUsername || currentPassport;
    const verified = memberData.passportVerified || isVerified;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Ipê Passport Status</span>
          </div>
          {verified ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Verified</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Not verified</span>
            </div>
          )}
        </div>

        {passport && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">Your Passport</div>
            <div className="font-mono text-lg">{passport}</div>
          </div>
        )}

        {memberData.walletAddress && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">Registered Wallet</div>
            <div className="font-mono text-sm">
              {memberData.walletAddress.slice(0, 6)}...{memberData.walletAddress.slice(-4)}
            </div>
          </div>
        )}

        {/* Wallet Renewal Status */}
        {memberData.walletRenewalStatus === "pending_renewal" && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-700">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Wallet Update Pending</span>
            </div>
            <div className="text-sm text-orange-600 mt-1">
              Admin approval required for wallet change
            </div>
            {memberData.newWalletAddress && (
              <div className="text-xs text-orange-600 mt-1">
                New wallet: {memberData.newWalletAddress.slice(0, 6)}...{memberData.newWalletAddress.slice(-4)}
              </div>
            )}
          </div>
        )}

        {memberData.walletRenewalStatus === "revoking_subdomain" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-700">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="font-medium">Processing Wallet Update</span>
            </div>
            <div className="text-sm text-blue-600 mt-1">
              Revoking old passport and reserving for new wallet...
            </div>
          </div>
        )}

        {memberData.walletRenewalStatus === "awaiting_new_acceptance" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Ready to Accept New Passport</span>
            </div>
            <div className="text-sm text-green-600 mb-3">
              Your passport has been reserved for your new wallet. Connect your new wallet and accept the transfer.
            </div>
            {memberData.newWalletAddress && (
              <div className="text-xs text-green-600 mb-3">
                Target wallet: {memberData.newWalletAddress.slice(0, 6)}...{memberData.newWalletAddress.slice(-4)}
              </div>
            )}
            
            {/* Wallet connection for acceptance */}
            <div className="space-y-3">
              <ConnectButton.Custom>
                {({ openConnectModal, openAccountModal, mounted, account }) => {
                  if (!mounted) return null;
                  
                  const isCorrectWallet = account?.address === memberData.newWalletAddress;
                  
                  if (!account) {
                    return (
                      <Button onClick={openConnectModal} className="bg-green-600 hover:bg-green-700">
                        Connect New Wallet
                      </Button>
                    );
                  }
                  
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-medium">
                            {isCorrectWallet ? "✓ Correct wallet connected" : "⚠️ Wrong wallet connected"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {account.address.slice(0, 6)}...{account.address.slice(-4)}
                          </div>
                        </div>
                        <Button onClick={openAccountModal} size="sm" variant="outline">
                          Change
                        </Button>
                      </div>
                      
                      {isCorrectWallet && (
                        <Button 
                          onClick={() => acceptWalletRenewalMutation.mutate()}
                          disabled={acceptWalletRenewalMutation.isPending}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {acceptWalletRenewalMutation.isPending ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                              Accepting Passport...
                            </>
                          ) : (
                            "Accept Your New Passport"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        )}

        {/* Passport Verification Interface for non-verified users */}
        {!verified && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {memberData.status === "pending_application" ? (
                "Complete your passport verification to submit your application"
              ) : memberData.status === "pending_application_review" ? (
                "Your application is under review"
              ) : memberData.status === "approved_application" ? (
                "Your application has been approved. Complete passport acceptance below"
              ) : (
                "Connect your wallet to verify an existing Ipê passport or claim a new one"
              )}
            </div>

            {/* Wallet Connection */}
            <div className="space-y-3">
              <ConnectButton.Custom>
                {({ openConnectModal, openAccountModal, mounted, account }) => {
                  if (!mounted) return null;
                  
                  if (!account) {
                    return (
                      <Button 
                        onClick={openConnectModal} 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Connect Wallet to Verify Passport
                      </Button>
                    );
                  }
                  
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium">Wallet Connected</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {account.address.slice(0, 6)}...{account.address.slice(-4)}
                          </div>
                        </div>
                        <Button onClick={openAccountModal} size="sm" variant="outline">
                          Change
                        </Button>
                      </div>

                      {/* ENS Domain Detection */}
                      <div className="space-y-3">
                        {ensLoading ? (
                          <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
                            Looking up ENS domain...
                          </div>
                        ) : hasIpePassport ? (
                          <div className="space-y-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2 text-green-700 mb-2">
                                <CheckCircle className="h-4 w-4" />
                                <span className="font-medium">Ipê Passport Found</span>
                              </div>
                              <div className="text-sm text-green-600 mb-2">
                                Found domain: <span className="font-mono">{ensName}</span>
                              </div>
                            </div>
                            
                            <Button 
                              onClick={() => {
                                // Trigger passport verification API call
                                // This would call the existing /api/passport/verify endpoint
                              }}
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              Activate Membership with Existing Passport
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="text-sm text-blue-600">
                                No Ipê City domain found for this wallet. You can claim a new passport.
                              </div>
                            </div>
                            
                            {/* Username Claiming Interface */}
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Choose your Ipê username:</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="username"
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                                <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                                  .ipecity.eth
                                </span>
                              </div>
                            </div>
                            
                            <Button 
                              className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                              Check Availability & Claim Passport
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWalletManagement = () => {
    if (!verified || !allowChange) {
      return null;
    }

    return (
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-purple-600" />
          <span className="font-medium">Wallet Management</span>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Connect a different wallet to update your passport registration
          </div>

          {/* Current wallet connection status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm font-medium">Wallet Connected</div>
              <div className="text-xs text-gray-500 mt-1">
                This is a different wallet than the one that owns your passport.
              </div>
              <div className="text-xs text-gray-500">
                {isConnected && address 
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "No wallet connected"
                }
              </div>
            </div>
            
            <ConnectButton.Custom>
              {({ openConnectModal, openAccountModal, mounted, account }) => {
                if (!mounted) return null;
                
                if (!account) {
                  return (
                    <Button
                      onClick={openConnectModal}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Connect Wallet
                    </Button>
                  );
                }
                
                return (
                  <Button
                    onClick={openAccountModal}
                    size="sm"
                    variant="outline"
                  >
                    Change Wallet
                  </Button>
                );
              }}
            </ConnectButton.Custom>
          </div>

          {/* ENS domain check for connected wallet */}
          {isConnected && address && (
            <div className="space-y-2">


              {/* Different actions based on wallet state */}
              {address !== memberData.walletAddress && memberData.walletRenewalStatus !== "pending_renewal" && (
                <Button
                  onClick={handleWalletUpdateRequest}
                  disabled={requestWalletRenewalMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {requestWalletRenewalMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Requesting Update...
                    </div>
                  ) : (
                    "Request Passport Transfer"
                  )}
                </Button>
              )}

              {address === memberData.walletAddress && (
                <div className="text-xs text-green-600 p-2 bg-green-50 rounded-lg">
                  This wallet is already registered to your passport
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const verified = memberData.passportVerified || isVerified;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ipê Passport Verification</CardTitle>
        <CardDescription>
          Your unique Ipê City domain registration and wallet management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderPassportStatus()}
        {renderWalletManagement()}
      </CardContent>
    </Card>
  );
}