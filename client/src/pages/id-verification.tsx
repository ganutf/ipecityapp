import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { apiRequest } from "@/lib/queryClient";

const emailVerificationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const verificationCodeSchema = z.object({
  code: z.string().min(6, "Verification code must be 6 digits"),
});

export default function IdVerificationPage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Email verification state
  const [emailStep, setEmailStep] = useState<'input' | 'verify'>('input');
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  
  // Passport verification state
  const [passportVerified, setPassportVerified] = useState(false);
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  
  // ENS lookup
  const { ensName, isLoading: ensLoading, error: ensError } = useEnsLookup(address);

  // Email form
  const emailForm = useForm<z.infer<typeof emailVerificationSchema>>({
    resolver: zodResolver(emailVerificationSchema),
    defaultValues: {
      email: "",
    },
  });

  // Verification code form
  const codeForm = useForm<z.infer<typeof verificationCodeSchema>>({
    resolver: zodResolver(verificationCodeSchema),
    defaultValues: {
      code: "",
    },
  });

  // Send email verification mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailVerificationSchema>) => {
      const response = await apiRequest("/api/auth/request-email-verification", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          email: data.email,
        }),
      });
      return response;
    },
    onSuccess: () => {
      setEmailSent(true);
      setEmailStep('verify');
      toast({
        title: "Verification code sent",
        description: "Please check your email for the 6-digit verification code.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send verification code",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Verify email code mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof verificationCodeSchema>) => {
      const response = await apiRequest("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          code: data.code,
        }),
      });
      return response;
    },
    onSuccess: () => {
      setEmailVerified(true);
      toast({
        title: "Email verified",
        description: "Your email has been successfully verified.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Invalid verification code",
        description: error.message || "Please check your code and try again",
        variant: "destructive",
      });
    },
  });

  // Verify passport mutation
  const verifyPassportMutation = useMutation({
    mutationFn: async () => {
      if (!address || !ensName) {
        throw new Error("No wallet or ENS domain found");
      }

      // Sign message to prove ownership
      const message = `Verify ownership of ${ensName} for Ipê City membership`;
      const signature = await signMessageAsync({ message });

      const response = await apiRequest("/api/passport/verify", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          ensName,
          walletAddress: address,
          signature,
          message,
        }),
      });
      return response;
    },
    onSuccess: () => {
      setPassportVerified(true);
      localStorage.setItem(`passport-verified-${ensName}`, "true");
      toast({
        title: "Passport verified",
        description: "Your Ipê City passport has been successfully verified.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Verification failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Check passport verification status from localStorage
  useEffect(() => {
    if (ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth')) {
      const isVerified = localStorage.getItem(`passport-verified-${ensName}`) === "true";
      setPassportVerified(isVerified);
    } else {
      setPassportVerified(false);
    }
  }, [ensName, isConnected]);

  const onEmailSubmit = (data: z.infer<typeof emailVerificationSchema>) => {
    sendEmailMutation.mutate(data);
  };

  const onCodeSubmit = (data: z.infer<typeof verificationCodeSchema>) => {
    verifyEmailMutation.mutate(data);
  };

  const handleVerifyPassport = () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!ensName || (!ensName.endsWith('.ipecity.eth') && ensName !== 'ipecity.eth')) {
      toast({
        title: "Ipê City domain required",
        description: "Your wallet must own an Ipê City domain (ipecity.eth or *.ipecity.eth) to verify ownership.",
        variant: "destructive",
      });
      return;
    }

    verifyPassportMutation.mutate();
  };

  const hasIpeCityDomain = ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">ID Verification</CardTitle>
          <CardDescription className="text-center">
            Complete your email and passport verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Verification Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Email Verification</h3>
              {emailVerified && (
                <span className="text-green-600 font-medium text-sm">✓ Verified</span>
              )}
            </div>
            
            {!emailVerified && (
              <div className="space-y-4">
                {emailStep === 'input' && (
                  <Form {...emailForm}>
                    <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                      <FormField
                        control={emailForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                placeholder="Enter your email address"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={sendEmailMutation.isPending}
                      >
                        {sendEmailMutation.isPending ? "Sending..." : "Send Verification Code"}
                      </Button>
                    </form>
                  </Form>
                )}

                {emailStep === 'verify' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      We've sent a 6-digit verification code to your email. Please enter it below.
                    </p>
                    <Form {...codeForm}>
                      <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
                        <FormField
                          control={codeForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Verification Code</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter 6-digit code"
                                  maxLength={6}
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full"
                          disabled={verifyEmailMutation.isPending}
                        >
                          {verifyEmailMutation.isPending ? "Verifying..." : "Verify Email"}
                        </Button>
                      </form>
                    </Form>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEmailStep('input')}
                      className="w-full"
                    >
                      Change Email Address
                    </Button>
                  </div>
                )}
              </div>
            )}

            {emailVerified && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Your email has been successfully verified.
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Passport Verification Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Passport Verification</h3>
              {passportVerified && (
                <span className="text-green-600 font-medium text-sm">✓ Verified</span>
              )}
            </div>

            {/* Wallet Connection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Step 1: Connect Wallet</p>
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

                    if (!ready) {
                      return (
                        <Button disabled className="w-full">
                          Loading...
                        </Button>
                      );
                    }

                    if (!connected) {
                      return (
                        <Button onClick={openConnectModal} className="w-full">
                          Connect Wallet
                        </Button>
                      );
                    }

                    if (chain.unsupported) {
                      return (
                        <Button onClick={openChainModal} variant="destructive" className="w-full">
                          Wrong network
                        </Button>
                      );
                    }

                    return (
                      <div className="flex items-center gap-2 p-2 border rounded-lg">
                        <span className="text-sm font-medium">{account.displayName}</span>
                        <span className="text-xs text-gray-500">({account.displayBalance})</span>
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </div>

            {/* Passport Status */}
            {isConnected && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Step 2: Passport Status</p>
                
                {ensLoading && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">Looking up ENS domain...</p>
                  </div>
                )}

                {!ensLoading && hasIpeCityDomain && (
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">
                        Ipê City domain detected: <span className="font-medium">{ensName}</span>
                      </p>
                    </div>
                    
                    {!passportVerified && (
                      <Button
                        onClick={handleVerifyPassport}
                        disabled={verifyPassportMutation.isPending}
                        className="w-full"
                      >
                        {verifyPassportMutation.isPending ? "Verifying..." : "Verify Passport Ownership"}
                      </Button>
                    )}
                  </div>
                )}

                {!ensLoading && !hasIpeCityDomain && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-700">
                      No Ipê City domain found for this wallet.
                      {ensName && (
                        <span className="block mt-1 text-xs">Found: {ensName}</span>
                      )}
                    </p>
                  </div>
                )}

                {ensError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      Error looking up ENS domain. Please try again.
                    </p>
                  </div>
                )}
              </div>
            )}

            {passportVerified && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  Your Ipê City passport has been successfully verified.
                </p>
              </div>
            )}
          </div>

          {/* Completion Status */}
          {emailVerified && passportVerified && (
            <div className="mt-6 pt-4 border-t">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center space-y-3">
                <p className="text-green-700 font-medium">
                  🎉 Verification Complete!
                </p>
                <p className="text-sm text-green-600">
                  You now have full access to Ipê City Pulse.
                </p>
                <Button 
                  onClick={() => window.location.href = '/'}
                  className="w-full"
                >
                  Done - Go to Home
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}