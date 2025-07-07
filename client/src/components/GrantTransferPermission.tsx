import { useState } from "react";
import { useAddPermission } from "@justaname.id/react";
import { useAccount, useSignMessage } from "wagmi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw, Shield, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createSiweMessage } from "viem/siwe";

interface GrantTransferPermissionProps {
  username: string;           // e.g. "peerbase"
  farcasterFid: number;      // For API calls
  onPermissionGranted?: () => void;
}

export function GrantTransferPermission({
  username,
  farcasterFid,
  onPermissionGranted,
}: GrantTransferPermissionProps) {
  const { isConnected, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { addPermission, isAddPermissionPending } = useAddPermission({ chainId: 1 });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCompleting, setIsCompleting] = useState(false);

  // Step 1: Grant permission mutation
  const grantPermissionMutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Please connect your admin wallet");
      }

      // Grant TRANSFER permission to admin wallet
      await addPermission({
        ens: `${username}.ipecity.eth`,
        permission: "TRANSFER",
        applicationKey: address,
      });

      return { adminAddress: address };
    },
    onSuccess: async ({ adminAddress }) => {
      toast({
        title: "Permission Granted",
        description: "TRANSFER permission granted to admin wallet. Starting revoke/reserve process...",
      });

      // Update status to indicate permission granted
      await updateStatus("awaiting_revoke_reserve");

      // Automatically trigger Step 2: Complete revoke/reserve
      await completeRevokeReserve(adminAddress);
    },
    onError: (error: Error) => {
      toast({
        title: "Permission Grant Failed",
        description: error.message || "Failed to grant TRANSFER permission",
        variant: "destructive",
      });
    },
  });

  // Helper function to update status
  const updateStatus = async (status: string) => {
    try {
      await apiRequest("/api/admin/update-wallet-renewal-status", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          status,
        }),
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  // Step 2: Complete revoke and reserve
  const completeRevokeReserve = async (adminAddress: string) => {
    try {
      setIsCompleting(true);

      // Create SIWE message for authentication
      const siweMessage = createSiweMessage({
        address: adminAddress as `0x${string}`,
        chainId: 1,
        domain: window.location.host,
        uri: window.location.origin,
        version: "1",
        statement: "Admin completing wallet renewal revoke/reserve process",
        nonce: Math.random().toString(36).substring(2),
        issuedAt: new Date().toISOString(),
      });

      // Sign the message
      const signature = await signMessageAsync({
        message: siweMessage,
      });

      // Call server to complete revoke/reserve
      await apiRequest("/api/admin/complete-wallet-revoke-reserve", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          siweMessage,
          siweSignature: signature,
          adminAddress,
        }),
      });

      toast({
        title: "Wallet Renewal Processing Complete",
        description: "Subdomain revoked and reserved. User can now accept with their new wallet.",
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-wallet-renewals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      
      onPermissionGranted?.();

    } catch (error: any) {
      toast({
        title: "Revoke/Reserve Failed",
        description: error.message || "Failed to complete revoke/reserve process",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const isProcessing = grantPermissionMutation.isPending || isAddPermissionPending || isCompleting;

  return (
    <Button
      disabled={!isConnected || isProcessing}
      onClick={() => grantPermissionMutation.mutate()}
      size="sm"
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isProcessing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          {grantPermissionMutation.isPending || isAddPermissionPending 
            ? "Granting Permission..." 
            : "Completing Process..."
          }
        </>
      ) : (
        <>
          <Shield className="h-4 w-4 mr-2" />
          Grant & Process
        </>
      )}
    </Button>
  );
}