import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Smartphone, ExternalLink, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet } from "@/lib/api";
import type { SignerResponse } from "@shared/types";

export default function SignerApprovalPage() {
  const { isAuthenticated, isLoading: authLoading, member, memberId } = useAuth();
  const [, setLocation] = useLocation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [qrCodeError, setQrCodeError] = useState<string>("");
  const queryClient = useQueryClient();

  // Authentication check - redirect to home if truly not authenticated
  // Wait for auth to stabilize before making redirect decisions
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !member?.farcasterFid) {
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, member, setLocation]);

  // Get signer data
  const { data: signerData, refetch: refetchSigner, error: signerError } = useQuery<SignerResponse>({
    queryKey: queryKeys.signers.byMember(member?.id),
    queryFn: () => authenticatedGet("/api/v2/farcaster/signer"),
    enabled: Boolean(member?.id),
    refetchInterval: (query) => {
      // Stop polling if there's a rate limit error
      if (query?.state?.error && query.state.error instanceof Error && query.state.error.message.includes('429')) {
        return false;
      }
      return 3000; // Check every 3 seconds for approval
    },
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data for signer status
    gcTime: 0, // Don't cache signer status data
  });

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      const approvalUrl = signerData?.signer_approval_url;

      if (approvalUrl) {
        try {
          setQrCodeError(""); // Clear previous errors

          const response = await fetch(`/api/qrcode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: approvalUrl }),
          });

          if (response.ok) {
            const qrDataUrl = await response.text();
            setQrCodeUrl(qrDataUrl);
            setQrCodeError("");
          } else {
            const errorText = await response.text();
            console.error('QR Code API error:', errorText);

            // Handle specific error cases
            if (response.status === 429) {
              setQrCodeError("Too many requests. Please wait a moment and refresh the page.");
            } else if (response.status === 404) {
              setQrCodeError("Previous signer was invalid. Please refresh the page to get a new one.");
            } else {
              setQrCodeError(`Failed to generate QR code: ${response.status} ${response.statusText}`);
            }
          }
        } catch (error) {
          console.error('Failed to generate QR code:', error);
          setQrCodeError('Network error generating QR code');
        }
      }
    };

    generateQR();
  }, [signerData, member?.farcasterFid]);

  // Auto-redirect when signer is approved
  useEffect(() => {
    if (signerData?.status === 'approved') {
      // Invalidate auth cache to refresh member status
      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.all,
      });
      
      // Small delay to allow cache invalidation and status update
      setTimeout(() => {
        setLocation('/id-verification');
      }, 1000);
    }
  }, [signerData?.status, setLocation, queryClient, member?.farcasterFid]);





  // Show loading while auth is stabilizing
  if (authLoading || (!member?.farcasterFid && isAuthenticated)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto max-w-md px-4">
          <Card>
            <CardContent className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading authentication...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle rate limit and other API errors
  if (signerError) {
    const is429 = signerError instanceof Error && signerError.message.includes('429');

    if (is429) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="container mx-auto max-w-md px-4">
            <Card className="border-orange-200">
              <CardHeader className="text-center">
                <CardTitle className="text-orange-600">Rate Limit Reached</CardTitle>
                <CardDescription>
                  Too many requests to the API. Please wait before refreshing.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">
                  Please wait 60 seconds before trying again.
                </p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Refresh Page
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    
    const is404 = signerError instanceof Error && signerError.message.includes('404');
    if (is404) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="container mx-auto max-w-md px-4">
            <Card className="border-blue-200">
              <CardHeader className="text-center">
                <CardTitle className="text-blue-600">Refresh Required</CardTitle>
                <CardDescription>
                  Your previous signer was cleaned up. Please refresh to get a new one.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-4">
                  {signerError.message}
                </p>
                <Button onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
  }

  if (signerData?.status === "approved") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto max-w-md px-4">
          <Card className="border-green-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-green-600">Signer Approved!</CardTitle>
              <CardDescription>
                Your Farcaster signer has been successfully approved.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                Redirecting to verification...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto max-w-md px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#8B5CF6] bg-opacity-10 rounded-full flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-[#8B5CF6]" />
            </div>
            <CardTitle>Approve Ipê City App</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  One-time setup to connect with your Farcaster account. Costs about 1 warp.
                </p>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <img 
                    src={qrCodeUrl} 
                    alt="Signer Approval QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}
              
              {/* QR Code Error */}
              {qrCodeError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{qrCodeError}</p>
                  <p className="text-red-500 text-xs mt-1">Use the button below to approve manually</p>
                </div>
              )}
              
              {/* Loading State */}
              {!qrCodeUrl && !qrCodeError && signerData?.signer_approval_url && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="animate-pulse flex items-center justify-center h-48 w-48 mx-auto bg-gray-200 rounded">
                    <span className="text-gray-400 text-sm">Loading QR Code...</span>
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Scan the QR code with your Farcaster app</p>
                <p>or use the button below</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {signerData?.signer_approval_url && (
                <Button
                  className="w-full"
                  onClick={() => window.open(signerData!.signer_approval_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Approve in Farcaster
                </Button>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}