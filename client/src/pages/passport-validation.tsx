import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAccount, useConnect, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useEnsLookup } from "@/hooks/useEnsLookup";

const passportClaimSchema = z.object({
  subdomain: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(20, "Subdomain must be at most 20 characters")
    .regex(/^[a-z0-9]+$/, "Subdomain can only contain lowercase letters and numbers"),
});

export default function PassportValidationPage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'idle' | 'pending' | 'approved' | 'denied'>('idle');

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  // ENS lookup
  const { ensName, isLoading: ensLoading, error: ensError } = useEnsLookup(address);

  // Form for claiming new passport
  const claimForm = useForm<z.infer<typeof passportClaimSchema>>({
    resolver: zodResolver(passportClaimSchema),
    defaultValues: {
      subdomain: profile?.username || "",
    },
  });

  const verifyPassportMutation = useMutation({
    mutationFn: async () => {
      if (!address || !ensName) {
        throw new Error("No wallet or ENS domain found");
      }

      // Sign message to prove ownership
      const message = `Verify ownership of ${ensName} for Ipê City membership`;
      const signature = await signMessageAsync({ message });

      return await apiRequest("/api/passport/verify", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          ensName,
          walletAddress: address,
          signature,
          message,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Passport verified!",
        description: "Your Ipê City passport has been verified successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify passport ownership",
        variant: "destructive",
      });
    },
  });

  const claimPassportMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passportClaimSchema>) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      return await apiRequest("/api/passport/claim", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          passportClaimSubdomain: data.subdomain,
          passportClaimWalletAddress: address,
        }),
      });
    },
    onSuccess: () => {
      setClaimStatus('pending');
      toast({
        title: "Claim submitted!",
        description: "Your passport claim is now under admin review.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim failed",
        description: error.message || "Failed to submit passport claim",
        variant: "destructive",
      });
    },
  });

  const handleVerifyPassport = () => {
    verifyPassportMutation.mutate();
  };

  const handleClaimPassport = (data: z.infer<typeof passportClaimSchema>) => {
    claimPassportMutation.mutate(data);
  };

  // Show claim under review status
  if (claimStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Application Under Review</CardTitle>
            <CardDescription className="text-center">
              Your passport claim is being reviewed by administrators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Requested subdomain:
              </p>
              <p className="font-medium text-lg">
                {claimForm.getValues().subdomain}.ipecity.eth
              </p>
            </div>
            <p className="text-sm text-gray-500">
              You will receive an email notification when your claim is processed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Passport Validation</CardTitle>
          <CardDescription className="text-center">
            Verify or claim your Ipê City passport
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wallet Connection */}
          <div className="space-y-3">
            <h3 className="font-medium">Step 1: Connect Wallet</h3>
            <div className="flex justify-center">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  authenticationStatus,
                  mounted,
                }) => {
                  const ready = mounted && authenticationStatus !== 'loading';
                  const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated');

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
                            <Button onClick={openConnectModal} type="button" className="w-full">
                              Connect Wallet
                            </Button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <Button onClick={openChainModal} type="button" variant="destructive" className="w-full">
                              Wrong network
                            </Button>
                          );
                        }

                        return (
                          <div className="space-y-2 w-full">
                            <Button
                              onClick={openAccountModal}
                              type="button"
                              variant="outline"
                              className="w-full"
                            >
                              {account.displayName}
                              {account.displayBalance ? ` (${account.displayBalance})` : ''}
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

          {/* Wallet Connected - Show ENS Status */}
          {isConnected && (
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Step 2: Passport Status</h3>
                
                {ensLoading ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Looking up ENS domain...</p>
                  </div>
                ) : ensError ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-red-600">Error looking up ENS domain</p>
                  </div>
                ) : ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth') ? (
                  /* Has Ipê City domain - Show verify option */
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-gray-600">Ipê City domain detected:</p>
                      <p className="font-medium text-lg text-green-600">{ensName}</p>
                    </div>
                    <Button
                      onClick={handleVerifyPassport}
                      disabled={verifyPassportMutation.isPending}
                      className="w-full"
                    >
                      {verifyPassportMutation.isPending ? "Verifying..." : "Verify Passport Ownership"}
                    </Button>
                  </div>
                ) : (
                  /* No Ipê City domain - Show claim option */
                  <div className="space-y-4">
                    <div className="text-center space-y-2">
                      <p className="text-sm text-gray-600">
                        No Ipê City domain found for this wallet
                      </p>
                      {ensName && (
                        <p className="text-sm text-gray-400">
                          Found: {ensName}
                        </p>
                      )}
                    </div>
                    
                    {!showClaimForm ? (
                      <Button
                        onClick={() => setShowClaimForm(true)}
                        variant="outline"
                        className="w-full"
                      >
                        Claim New Passport
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        <Form {...claimForm}>
                          <form onSubmit={claimForm.handleSubmit(handleClaimPassport)} className="space-y-4">
                            <FormField
                              control={claimForm.control}
                              name="subdomain"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Choose your subdomain</FormLabel>
                                  <FormControl>
                                    <div className="flex items-center space-x-2">
                                      <Input placeholder="username" {...field} />
                                      <span className="text-sm text-gray-500">.ipecity.eth</span>
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowClaimForm(false)}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={claimPassportMutation.isPending}
                                className="flex-1"
                              >
                                {claimPassportMutation.isPending ? "Submitting..." : "Confirm"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}