import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";

interface UsernameClaimSectionProps {
  member: any;
  isProfilePage?: boolean;
}

export function UsernameClaimSection({
  member,
  isProfilePage = false,
}: UsernameClaimSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [username, setUsername] = useState("");
  const [availabilityCheck, setAvailabilityCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    error: string | null;
  }>({ checking: false, available: null, error: null });

  // Check username availability with debounce
  useEffect(() => {
    if (username.length < 3) {
      setAvailabilityCheck({ checking: false, available: null, error: null });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setAvailabilityCheck({ checking: true, available: null, error: null });
      try {
        const response = await fetch(`/api/subname/available/${username}`);
        const data = await response.json();

        if (response.ok) {
          setAvailabilityCheck({
            checking: false,
            available: data.available,
            error: null,
          });
        } else {
          setAvailabilityCheck({
            checking: false,
            available: null,
            error: data.error || "Failed to check availability",
          });
        }
      } catch (error) {
        setAvailabilityCheck({
          checking: false,
          available: null,
          error: "Failed to check availability",
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const claimUsernameMutation = useMutation({
    mutationFn: async (data: {
      farcasterFid: number;
      username: string;
      walletAddress: string;
    }) => {
      const response = await fetch("/api/username/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Username claimed successfully!",
        description: "Your username is now pending admin approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to claim username",
        description: error.error || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Accept subdomain mutation (frontend wallet signing + JustaName API)
  const acceptSubdomainMutation = useMutation({
    mutationFn: async () => {
      if (!address || !isConnected) {
        throw new Error("Wallet not connected");
      }

      // Create SIWE-compliant message for signing
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = `Accept subdomain ${member.ipeUsername}.ipecity.eth`;

      const siweMessage = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: "1",
        chainId: 1,
        issuedAt: new Date().toISOString(),
      });

      const message = siweMessage.prepareMessage();

      // Get user to sign the SIWE message
      const signature = await signMessageAsync({ message });

      // Prepare request data
      const requestData = {
        username: member.ipeUsername,
        ensDomain: "ipecity.eth",
        chainId: 1, // Mainnet
        addresses: [
          {
            address: address,
            coinType: 60, // ETH
          },
        ],
      };

      const requestHeaders = {
        "Content-Type": "application/json",
        "x-api-key": import.meta.env.VITE_JUSTANAME_API_KEY || "",
        "x-signature": signature,
        "x-message": message,
        "x-address": address,
      };

      // Log all request details to console and send to server for logging
      console.log("JustaName Accept API Request:", {
        url: "https://api.justaname.id/ens/v1/subname/accept",
        method: "POST",
        headers: requestHeaders,
        body: requestData,
        member: {
          farcasterFid: member.farcasterFid,
          ipeUsername: member.ipeUsername,
          status: member.status,
        },
      });

      // Send request details to server for terminal logging
      fetch("/api/debug/log-justaname-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://api.justaname.id/ens/v1/subname/accept",
          headers: requestHeaders,
          body: requestData,
          member: {
            farcasterFid: member.farcasterFid,
            ipeUsername: member.ipeUsername,
            status: member.status,
          },
        }),
      }).catch((err) => console.log("Debug logging failed:", err));

      // Call JustaName accept API directly
      let response;
      try {
        response = await fetch(
          "https://api.justaname.id/ens/v1/subname/accept",
          {
            method: "POST",
            headers: requestHeaders,
            body: JSON.stringify(requestData),
          },
        );
      } catch (fetchError) {
        console.error("Network/Fetch Error:", fetchError);
        throw new Error(
          `Network error: ${fetchError.message || "Failed to connect to JustaName API"}`,
        );
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: "Failed to parse error response" };
        }
        console.error("JustaName API Error:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
          headers: Object.fromEntries(response.headers.entries()),
          requestData: {
            username: member.ipeUsername,
            ensDomain: "ipecity.eth",
            chainId: 1,
            address: address,
          },
        });
        throw new Error(
          errorData.message ||
            errorData.error ||
            `API Error: ${response.status}`,
        );
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Passport verified successfully!",
        description: "Your Ipê passport is now active on the blockchain.",
      });
      // Update member status to active_member
      updateMemberStatusMutation.mutate({
        farcasterFid: member.farcasterFid,
        status: "active_member",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to verify passport",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update member status mutation
  const updateMemberStatusMutation = useMutation({
    mutationFn: async ({
      farcasterFid,
      status,
    }: {
      farcasterFid: number;
      status: string;
    }) => {
      const response = await fetch("/api/members/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ farcasterFid, status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
    },
  });

  const handleClaimUsername = () => {
    if (!username || !availabilityCheck.available || !isConnected || !address)
      return;

    claimUsernameMutation.mutate({
      farcasterFid: member.farcasterFid,
      username: username.toLowerCase(),
      walletAddress: address,
    });
  };

  // Show status if user already has claimed username
  if (member?.ipeUsername) {
    const isPending = member.status === "pending_claim";
    const isApprovedNotAccepted = member.status === "member";
    const isActive = member.status === "active_member";

    return (
      <Card
        className={
          isActive
            ? "border-green-200"
            : isApprovedNotAccepted
              ? "border-blue-200"
              : isPending
                ? "border-yellow-200"
                : "border-gray-200"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {isActive ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : isApprovedNotAccepted ? (
              <CheckCircle className="w-5 h-5 text-blue-600" />
            ) : isPending ? (
              <Clock className="w-5 h-5 text-yellow-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-gray-600" />
            )}
            <span>Ipê Username</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Your claimed username:</p>
            <p className="font-mono text-lg">
              {member.ipeUsername}.ipecity.eth
            </p>
          </div>

          <div
            className={`p-3 rounded-lg ${
              isActive
                ? "bg-green-50 text-green-800"
                : isApprovedNotAccepted
                  ? "bg-blue-50 text-blue-800"
                  : isPending
                    ? "bg-yellow-50 text-yellow-800"
                    : "bg-gray-50 text-gray-800"
            }`}
          >
            <p className="text-sm font-medium">
              Status:{" "}
              {isActive
                ? "Active & Live"
                : isApprovedNotAccepted
                  ? "Approved & Reserved"
                  : isPending
                    ? "Pending Admin Approval"
                    : "Unknown"}
            </p>
            {isPending && (
              <div>
                <p className="text-xs mt-1">
                  An admin will review and approve your username claim.
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Check Status
                </Button>
              </div>
            )}
            {isApprovedNotAccepted && (
              <p className="text-xs mt-1">
                Your subdomain has been reserved! Verify your passport to
                activate it.
              </p>
            )}
            {isActive && (
              <p className="text-xs mt-1">
                Your Ipê passport is now active and live on the blockchain!
              </p>
            )}
          </div>

          {/* Show Verify Passport button when approved but not yet accepted */}
          {isApprovedNotAccepted && (
            <div className="space-y-2">
              {!isConnected && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 mb-2">
                    Connect your wallet to verify passport:
                  </p>
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) => {
                      if (!mounted) return null;
                      return (
                        <Button
                          onClick={openConnectModal}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          Connect Wallet
                        </Button>
                      );
                    }}
                  </ConnectButton.Custom>
                </div>
              )}

              {isConnected && (
                <Button
                  onClick={() => acceptSubdomainMutation.mutate()}
                  disabled={acceptSubdomainMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {acceptSubdomainMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Verifying Passport...
                    </>
                  ) : (
                    "Verify Passport"
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Your Ipê Username</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            Choose a unique username for your Ipê City passport. This will be
            your subdomain under ipecity.eth.
          </p>

          {/* Wallet Connection Requirement */}
          {!isConnected && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                Connect your wallet to claim a username:
              </p>
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => {
                  if (!mounted) return null;
                  return (
                    <Button
                      onClick={openConnectModal}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Connect Wallet
                    </Button>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          )}

          {isConnected && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Wallet connected: {address?.slice(0, 6)}...
                {address?.slice(-4)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter username (3+ characters)"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""),
                )
              }
              className="font-mono"
            />

            {username && (
              <p className="text-sm text-gray-500">
                Your subdomain will be:{" "}
                <span className="font-mono">{username}.ipecity.eth</span>
              </p>
            )}

            {/* Availability indicator */}
            {username.length >= 3 && (
              <div className="flex items-center space-x-2">
                {availabilityCheck.checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-600">
                      Checking availability...
                    </span>
                  </>
                ) : availabilityCheck.error ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600">
                      {availabilityCheck.error}
                    </span>
                  </>
                ) : availabilityCheck.available === true ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">Available!</span>
                  </>
                ) : availabilityCheck.available === false ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-600">
                      Username not available
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={handleClaimUsername}
          disabled={
            !username ||
            username.length < 3 ||
            availabilityCheck.checking ||
            !availabilityCheck.available ||
            !isConnected ||
            !address ||
            claimUsernameMutation.isPending
          }
          className="w-full"
        >
          {claimUsernameMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Claiming...
            </>
          ) : (
            "Claim Username"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
