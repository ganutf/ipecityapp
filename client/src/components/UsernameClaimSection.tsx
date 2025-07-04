import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccountInvitations, useAcceptSubname } from "@justaname.id/react";

interface UsernameClaimSectionProps {
  member: any;
  isProfilePage?: boolean;
}

export function UsernameClaimSection({
  member: memberProp,
  isProfilePage = false,
}: UsernameClaimSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const [username, setUsername] = useState("");
  const [member, setMember] = useState(memberProp);
  
  // Update local member state when prop changes
  useEffect(() => {
    setMember(memberProp);
  }, [memberProp]);

  // Use JustaName SDK hooks
  const { invitations, isInvitationsPending, refetchInvitations } =
    useAccountInvitations();
  const { acceptSubname, isAcceptSubnamePending } = useAcceptSubname();

  // Claim username mutation (for new claims)
  const claimUsernameMutation = useMutation({
    mutationFn: async ({
      farcasterFid,
      username,
      walletAddress,
    }: {
      farcasterFid: number;
      username: string;
      walletAddress: string;
    }) => {
      const response = await fetch("/api/passport/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          farcasterFid,
          passportClaimSubdomain: username,
          passportClaimWalletAddress: walletAddress,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }

      return response.json();
    },
    onSuccess: (responseData) => {
      // Update local member state with response data for instant UI update
      setMember(responseData.member);
      
      toast({
        title: "Username claimed successfully!",
        description: "Your username is now pending admin approval.",
      });
      
      // Still invalidate admin member list for admin dashboard updates
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to claim username",
        description: error.error || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Accept subdomain mutation using JustaName SDK
  const acceptSubdomainMutation = useMutation({
    mutationFn: async () => {
      if (!address || !isConnected) {
        throw new Error("Wallet not connected");
      }

      console.log("Looking for username:", `${member.ipeUsername}.ipecity.eth`);

      // Find the invitation for this member's username
      const invitation = invitations?.find(
        (inv: any) => inv.ens === `${member.ipeUsername}.ipecity.eth`,
      );

      console.log("Found invitation:", invitation);

      if (!invitation) {
        throw new Error("No pending invitation found for this username");
      }

      // Use JustaName SDK to accept the invitation
      const result = await acceptSubname({
        ens: `${member.ipeUsername}.ipecity.eth`,
      });

      return result;
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

  // Availability check mutation
  const availabilityCheck = useMutation({
    mutationFn: async (username: string) => {
      const response = await fetch(`/api/passport/availability/${username}`);
      return response.json();
    },
  });

  useEffect(() => {
    if (username && username.length >= 3) {
      availabilityCheck.mutate(username.toLowerCase());
    }
  }, [username]);

  const handleClaimUsername = () => {
    if (
      !username ||
      !availabilityCheck.data?.available ||
      !isConnected ||
      !address
    )
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

          <div>
            <p className="text-sm font-medium mb-2">Status:</p>
            {isPending && (
              <div className="flex items-center space-x-2 text-yellow-700">
                <Clock className="w-4 h-4" />
                <span>Pending admin approval</span>
              </div>
            )}
            {isApprovedNotAccepted && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-blue-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>Approved - Ready to verify</span>
                </div>

                {!isConnected ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Connect your wallet to verify your passport:
                    </p>
                    <ConnectButton />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Click to complete passport verification:
                    </p>
                    <Button
                      onClick={() => acceptSubdomainMutation.mutate()}
                      disabled={
                        acceptSubdomainMutation.isPending ||
                        isAcceptSubnamePending
                      }
                      className="w-full"
                    >
                      {acceptSubdomainMutation.isPending ||
                      isAcceptSubnamePending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Passport"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            {isActive && (
              <div className="flex items-center space-x-2 text-green-700">
                <CheckCircle className="w-4 h-4" />
                <span>Active on blockchain</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user hasn't claimed username yet, show claiming interface
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          <span>Claim Ipê Username</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Claim your unique username for the Ipê City community:
          </p>

          <div className="space-y-3">
            <div>
              <Input
                placeholder="Enter desired username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="mb-2"
              />
              <p className="text-xs text-gray-500">
                Will become: {username || "[username]"}.ipecity.eth
              </p>
            </div>

            {username && username.length >= 3 && (
              <div className="text-sm">
                {availabilityCheck.isPending ? (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking availability...</span>
                  </div>
                ) : availabilityCheck.data?.available ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Available</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Not available</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!isConnected ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Connect your wallet to claim a username:
            </p>
            <ConnectButton />
          </div>
        ) : (
          <Button
            onClick={handleClaimUsername}
            disabled={
              !username ||
              username.length < 3 ||
              availabilityCheck.isPending ||
              !availabilityCheck.data?.available ||
              claimUsernameMutation.isPending
            }
            className="w-full"
          >
            {claimUsernameMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Claiming...
              </>
            ) : (
              "Claim Username"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
