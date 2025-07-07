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
import { useAcceptSubname, useUpdateSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CheckCircle, AlertCircle, Globe, Clock, Wallet, Users, RefreshCw } from "lucide-react";

interface Member {
  farcasterFid: number;
  walletAddress?: string;
  ipePassport?: string;
  passportVerified: boolean;
  status: string;
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



  // Update wallet in database after JustaName transfer
  const updateWalletMutation = useMutation({
    mutationFn: async (newWalletAddress: string) => {
      return await apiRequest("/api/passport/update-wallet", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          newWalletAddress,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Updated",
        description: "Your passport has been successfully transferred to the new wallet.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check", farcasterFid] });
      onVerificationComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Database Error",
        description: error.message || "Failed to update wallet in database",
        variant: "destructive",
      });
    },
  });

  // JustaName updateSubname hook for client-side subdomain transfer
  const {
    updateSubname,
    isLoading: isUpdatingSubname,
    isSuccess: updateSuccess,
    error: updateError,
  } = useUpdateSubname({
    username: memberData.ipeUsername || "",
    chainId: mainnet.id,
    addresses: address ? [{ address: address as `0x${string}`, coinType: 60 }] : [],
  });

  // Handle wallet transfer
  const handleWalletTransfer = async () => {
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
        description: "This wallet is already registered to your passport",
        variant: "destructive",
      });
      return;
    }

    if (!memberData.ipeUsername) {
      toast({
        title: "No Username",
        description: "No username found for passport transfer",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use JustaName hook to transfer subdomain
      await updateSubname();
      
      // If successful, update database
      if (updateSuccess) {
        await updateWalletMutation.mutateAsync(address);
      }
    } catch (error) {
      console.error("Wallet transfer error:", error);
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer passport to new wallet",
        variant: "destructive",
      });
    }
  };

  // Monitor updateSubname success
  useEffect(() => {
    if (updateSuccess && address) {
      updateWalletMutation.mutate(address);
    }
  }, [updateSuccess, address]);

  // Monitor updateSubname error
  useEffect(() => {
    if (updateError) {
      toast({
        title: "JustaName Error",
        description: updateError.message || "Failed to transfer subdomain",
        variant: "destructive",
      });
    }
  }, [updateError]);;

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
            <div className="text-sm text-gray-600">Current Passport Wallet</div>
            <div className="font-mono text-sm">
              {memberData.walletAddress.slice(0, 6)}...{memberData.walletAddress.slice(-4)}
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
            Transfer your passport to a different wallet instantly
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


              {/* Wallet transfer action */}
              {address !== memberData.walletAddress && (
                <Button
                  onClick={handleWalletTransfer}
                  disabled={isUpdatingSubname || updateWalletMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isUpdatingSubname || updateWalletMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      {isUpdatingSubname ? "Transferring..." : "Updating Database..."}
                    </div>
                  ) : (
                    "Transfer Passport to This Wallet"
                  )}
                </Button>
              )}

              {address === memberData.walletAddress && (
                <div className="text-xs text-green-600 p-2 bg-green-50 rounded-lg">
                  ✓ This wallet owns your passport
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