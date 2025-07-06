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
  walletRenewalStatus?: "pending_renewal" | "renewal_approved" | null;
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

  // Status polling for pending wallet renewal
  const { data: memberStatus } = useQuery({
    queryKey: ["/api/members/check", farcasterFid],
    enabled: !!farcasterFid && memberData?.walletRenewalStatus === "pending_renewal",
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
    const passport = memberData.ipePassport || currentPassport;
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
              <div className="text-sm font-medium">Currently Connected</div>
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
              <div className="text-sm text-gray-600">
                {ensLoading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Looking up ENS domain...
                  </div>
                ) : ensName ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    Found domain: {ensName}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500">
                    <AlertCircle className="h-3 w-3" />
                    No ENS domain found for this wallet
                  </div>
                )}
              </div>

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
                    "Request Wallet Update"
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