import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAcceptSubname, useAddSubname } from "@justaname.id/react";
import { mainnet } from "viem/chains";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CheckCircle, AlertCircle, Globe, Clock, Wallet, Users, RefreshCw, Loader2 } from "lucide-react";

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

  // State for initial verification flow
  const [claimUsername, setClaimUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"checking" | "available" | "taken" | "">("");
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  // Auto-fill username from Farcaster profile
  useEffect(() => {
    if (farcasterProfile?.username && !claimUsername) {
      const sanitizedUsername = farcasterProfile.username.replace(/[^a-z0-9]/g, "").toLowerCase();
      setClaimUsername(sanitizedUsername);
    }
  }, [farcasterProfile?.username, claimUsername]);

  // Check username availability
  useEffect(() => {
    if (!claimUsername || claimUsername.length < 3) {
      setUsernameStatus("");
      return;
    }

    const checkAvailability = async () => {
      setUsernameStatus("checking");
      try {
        const response = await fetch(`/api/passport/availability/${claimUsername}`);
        const data = await response.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch (error) {
        console.error("Error checking availability:", error);
        setUsernameStatus("");
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [claimUsername]);

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

  // Verify existing domain mutation
  const verifyDomainMutation = useMutation({
    mutationFn: async () => {
      if (!address || !ensName) {
        throw new Error("Wallet and ENS domain required");
      }

      const domain = `domain=ipecity.eth&chainId=1&address=${address}`;
      const message = createSiweMessage({
        domain: window.location.host,
        address,
        statement: `I own ${ensName} and want to verify it for Ipê City`,
        uri: window.location.origin,
        version: "1",
        chainId: mainnet.id,
        nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 8),
      });

      const signature = await signMessage({ message });

      return await apiRequest("/api/passport/verify", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          ensName,
          walletAddress: address,
          signature,
          message,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Domain Verified!",
        description: "Your Ipê City domain has been verified. You can now submit your application.",
      });
      setShowApplicationForm(true);
      onVerificationComplete?.();
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${farcasterFid}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify domain ownership",
        variant: "destructive",
      });
    },
  });

  // Username claiming with JustaName
  const { addSubname } = useAddSubname();
  const claimUsernameMutation = useMutation({
    mutationFn: async () => {
      if (!address || !claimUsername) {
        throw new Error("Wallet and username required");
      }

      if (usernameStatus !== "available") {
        throw new Error("Username is not available");
      }

      const result = await addSubname({
        username: claimUsername,
        ensDomain: "ipecity.eth",
        address: address,
      });

      return await apiRequest("/api/passport/claim", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          ipeUsername: claimUsername,
          walletAddress: address,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Username Claimed!",
        description: `${claimUsername}.ipecity.eth has been claimed. You can now submit your application.`,
      });
      setShowApplicationForm(true);
      onVerificationComplete?.();
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${farcasterFid}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim username",
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
      </div>
    );
  };

  const renderInitialVerification = () => {
    return (
      <div className="space-y-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Complete Your Passport Verification</h3>
          <p className="text-sm text-blue-700">
            Connect your wallet to verify an existing Ipê City domain or claim a new subdomain.
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-600" />
            <span className="font-medium">Step 1: Connect Wallet</span>
          </div>
          
          <ConnectButton.Custom>
            {({ openConnectModal, openAccountModal, mounted, account }) => {
              if (!mounted) return null;
              
              if (!account) {
                return (
                  <Button
                    onClick={openConnectModal}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    Connect Wallet
                  </Button>
                );
              }
              
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-green-800">Wallet Connected</div>
                        <div className="text-xs text-green-600">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </div>
                      </div>
                      <Button onClick={openAccountModal} size="sm" variant="outline">
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>

        {/* ENS Domain Check */}
        {isConnected && address && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Step 2: Passport Verification</span>
            </div>

            {ensLoading ? (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Looking up ENS domain...</span>
                </div>
              </div>
            ) : hasIpeCityDomain ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Ipê City Domain Found!</span>
                  </div>
                  <div className="text-sm text-green-600 mb-3">
                    Domain: <span className="font-mono">{ensName}</span>
                  </div>
                  <Button
                    onClick={() => verifyDomainMutation.mutate()}
                    disabled={verifyDomainMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {verifyDomainMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying Domain...
                      </div>
                    ) : (
                      "Sign & Activate Membership"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-sm text-orange-700 mb-3">
                    No Ipê City domain found. Claim your subdomain:
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Input
                        value={claimUsername}
                        onChange={(e) => setClaimUsername(e.target.value.replace(/[^a-z0-9]/g, "").toLowerCase())}
                        placeholder="your-username"
                        className="text-center"
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          Will create: {claimUsername}.ipecity.eth
                        </span>
                        <span className={
                          usernameStatus === "available" ? "text-green-600" :
                          usernameStatus === "taken" ? "text-red-600" :
                          usernameStatus === "checking" ? "text-blue-600" : "text-gray-500"
                        }>
                          {usernameStatus === "checking" && "Checking..."}
                          {usernameStatus === "available" && "✓ Available"}
                          {usernameStatus === "taken" && "✗ Taken"}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => claimUsernameMutation.mutate()}
                      disabled={
                        claimUsernameMutation.isPending ||
                        usernameStatus !== "available" ||
                        !claimUsername ||
                        claimUsername.length < 3
                      }
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {claimUsernameMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Claiming Username...
                        </div>
                      ) : (
                        "Claim Subdomain"
                      )}
                    </Button>
                  </div>
                </div>
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
  const needsInitialVerification = !verified && !memberData.ipePassport && !memberData.ipeUsername;

  const handleApplicationSuccess = () => {
    toast({
      title: "Application Submitted!",
      description: "Your application has been submitted for admin review.",
    });
    queryClient.invalidateQueries({ queryKey: [`/api/members/check/${farcasterFid}`] });
    onVerificationComplete?.();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ipê Passport Verification</CardTitle>
          <CardDescription>
            Your unique Ipê City domain registration and wallet management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderPassportStatus()}
          
          {needsInitialVerification ? (
            renderInitialVerification()
          ) : (
            renderWalletManagement()
          )}
        </CardContent>
      </Card>

      {/* Show Application Form after passport verification is complete */}
      {(verified || showApplicationForm) && memberData.status !== 'active_member' && memberData.status !== 'pending_application_review' && memberData.status !== 'approved_application' && (
        <ApplicationForm
          memberData={memberData}
          farcasterProfile={farcasterProfile}
          onSuccess={handleApplicationSuccess}
        />
      )}
    </div>
  );
}