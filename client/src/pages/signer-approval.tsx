import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Smartphone, ExternalLink, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

export default function SignerApprovalPage() {
  const { profile } = usePersistentAuth();
  const [, setLocation] = useLocation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Get signer data
  const { data: signerData, refetch: refetchSigner } = useQuery({
    queryKey: [`/api/neynar/signer/${profile?.fid}`],
    enabled: !!profile?.fid,
    refetchInterval: false, // Disable polling
    refetchIntervalInBackground: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      const approvalUrl = (signerData as any)?.signer_approval_url;
      
      if (approvalUrl) {
        try {
          const response = await fetch(`/api/qrcode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: approvalUrl }),
          });
          if (response.ok) {
            const qrDataUrl = await response.text();
            setQrCodeUrl(qrDataUrl);
          }
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }
      }
    };
    
    generateQR();
  }, [signerData]);

  // Auto-redirect when signer is approved
  useEffect(() => {
    if ((signerData as any)?.status === 'approved') {
      setLocation('/register');
    }
  }, [(signerData as any)?.status, setLocation]);





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

              {/* Instructions */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Scan the QR code with your Farcaster app</p>
                <p>or use the button below</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {(signerData as any)?.signer_approval_url && (
                <Button
                  className="w-full"
                  onClick={() => window.open((signerData as any).signer_approval_url, '_blank')}
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