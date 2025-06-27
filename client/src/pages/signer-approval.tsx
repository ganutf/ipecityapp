import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Smartphone, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

export default function SignerApprovalPage() {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get signer data
  const { data: signerData, refetch: refetchSigner } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
    refetchInterval: 3000, // Check every 3 seconds for approval
  });

  // Generate QR code
  const { data: qrData } = useQuery({
    queryKey: ["/api/qrcode"],
    queryFn: async () => {
      if (!(signerData as any)?.signer_approval_url) return null;
      return apiRequest(`/api/qrcode`, {
        method: "POST",
        body: JSON.stringify({ url: (signerData as any).signer_approval_url }),
      });
    },
    enabled: !!(signerData as any)?.signer_approval_url,
  });

  // Check signer status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/neynar/signer/check/${profile?.fid}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      refetchSigner();
      queryClient.invalidateQueries({ queryKey: [`/api/neynar/signer/${profile?.fid}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check signer status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Redirect if signer is approved
  useEffect(() => {
    if (signerData?.status === "approved") {
      toast({
        title: "Signer Approved!",
        description: "Your signer has been approved. Continuing with registration...",
      });
      setTimeout(() => {
        setLocation("/register");
      }, 2000);
    }
  }, [signerData?.status, setLocation, toast]);

  // Set QR code URL
  useEffect(() => {
    if (qrData?.qr) {
      setQrCodeUrl(qrData.qr);
    }
  }, [qrData]);

  if (!profile) {
    return null;
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
                Redirecting to registration...
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
            <CardTitle>Approve Your Signer</CardTitle>
            <CardDescription>
              To interact with Farcaster posts, you need to approve a signer for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-[#8B5CF6]" />
                  <span className="font-medium">One-Time Setup</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  This approval allows the app to interact with Farcaster on your behalf. You'll typically pay 1 warp for this approval.
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

              {/* Instructions */}
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong>Option 1:</strong> Scan the QR code with your mobile Farcaster app
                </p>
                <p>
                  <strong>Option 2:</strong> Open the approval link directly
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {signerData?.approvalUrl && (
                <Button
                  className="w-full"
                  onClick={() => window.open(signerData.approvalUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Approval Link
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => checkStatusMutation.mutate()}
                disabled={checkStatusMutation.isPending}
              >
                {checkStatusMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Checking Status...
                  </>
                ) : (
                  'Check Approval Status'
                )}
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Status: <span className="font-medium text-yellow-600">Pending Approval</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}