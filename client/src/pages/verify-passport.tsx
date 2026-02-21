import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useEnsAddress, useSignMessage } from "wagmi";
import { useConnectWallet } from "@privy-io/react-auth";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { SiweMessage } from "siwe";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function VerifyPassportPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [targetPassport, setTargetPassport] = useState<string>("");

  const { connectWallet } = useConnectWallet();
  const { activeWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;
  const isConnected = !!activeWallet;

  // Keep wagmi hooks that work with @privy-io/wagmi
  const { data: ensAddress } = useEnsAddress({
    name: targetPassport || undefined
  });
  const { signMessageAsync } = useSignMessage();

  // Fetch verification details from server using token
  const { data: verificationData, isLoading: isLoadingToken } = useQuery({
    queryKey: ["/api/passport/verify", token],
    enabled: !!token,
  }) as { data?: { passport: string; farcasterFid: number; challenge: string } | null; isLoading: boolean };

  // Set passport from server data
  useEffect(() => {
    if (verificationData?.passport) {
      setTargetPassport(verificationData.passport);
    }
  }, [verificationData]);

  // Check localStorage for verification status
  useEffect(() => {
    if (targetPassport) {
      const storedVerification = localStorage.getItem(`passport-verified-${targetPassport}`);
      if (storedVerification === "true") {
        setVerified(true);
        setResult("✅ Passport ownership already verified!");
      }
    }
  }, [targetPassport]);

  const handleVerify = async () => {
    if (!isConnected || !ensAddress || !address) return;
    
    setIsVerifying(true);
    setResult("");

    try {
      // First check: Verify ENS ownership
      if (address.toLowerCase() !== ensAddress.toLowerCase()) {
        setResult(`❌ Connected wallet does not own ${targetPassport}\n\nYour wallet: ${address}\nENS owner: ${ensAddress}\n\nPlease connect the wallet that owns this ENS domain.`);
        setIsVerifying(false);
        return;
      }

      // Cryptographic signature verification - MANDATORY for security
      let signature: string;
      let verificationMessage: string;

      try {
        // Try SIWE format first (industry standard)
        const siweMessage = new SiweMessage({
          domain: window.location.hostname,
          address,
          statement: `Verify ownership of ${targetPassport} for Ipê City registration`,
          uri: window.location.origin,
          version: '1',
          chainId: 1,
          nonce: Math.random().toString(36).substring(2, 15),
          issuedAt: new Date().toISOString(),
        });
        
        verificationMessage = siweMessage.prepareMessage();
        signature = await signMessageAsync({ message: verificationMessage });
        
      } catch (siweError) {
        // Fallback to simple message format if SIWE fails
        verificationMessage = `Verify ownership of ${targetPassport}\n\nThis signature proves I control the wallet that owns this ENS domain.\n\nTimestamp: ${new Date().toISOString()}\nWallet: ${address}`;
        signature = await signMessageAsync({ message: verificationMessage });
      }

      // Verify the signature cryptographically
      const { verifyMessage } = await import('viem');
      const isValidSignature = await verifyMessage({
        address,
        message: verificationMessage,
        signature: signature as `0x${string}`
      });

      if (!isValidSignature) {
        setResult(`❌ Signature verification failed\n\nThe signature does not match your wallet address. Please try again.`);
        setIsVerifying(false);
        return;
      }

      // Success - both ENS ownership and signature verified
      setResult(`✅ Passport ownership verified!\n\n${targetPassport} is cryptographically verified as owned by your wallet.\n\nWallet: ${address}\nVerification: Signature + ENS ownership confirmed`);
      setVerified(true);
      
      // Store verification proof
      localStorage.setItem(`passport-verified-${targetPassport}`, "true");
      localStorage.setItem(`passport-verification-details`, JSON.stringify({
        passport: targetPassport,
        address,
        timestamp: new Date().toISOString(),
        verified: true,
        signatureVerified: true,
        ensVerified: true
      }));

      // Close window after success
      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 3000);

    } catch (error) {
      console.error("Verification error:", error);
      
      // Provide helpful error messages
      let errorMessage = "Verification failed.";
      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Signature was cancelled. Please try again and approve the signature request.";
        } else if (error.message.includes("network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else {
          errorMessage = `Verification failed: ${error.message}`;
        }
      }
      
      setResult(`❌ ${errorMessage}\n\nBoth ENS ownership and cryptographic signature verification are required for security.`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              {verified ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
              )}
              Verify Passport Ownership
            </CardTitle>
            <CardDescription>
              Prove that you own <strong>{targetPassport}</strong>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Token Display (for debugging) */}
            <Alert>
              <AlertDescription>
                Verification Token: <code className="text-sm bg-gray-100 px-1 rounded">{token}</code>
              </AlertDescription>
            </Alert>

            {/* Wallet Connection */}
            <div className="flex flex-col items-center space-y-4">
              {!isConnected ? (
                <Button onClick={() => connectWallet()}>
                  Connect Wallet
                </Button>
              ) : (
                <div className="text-sm text-gray-600">
                  Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              )}
            </div>

            {/* ENS Resolution Info */}
            {ensAddress && (
              <Alert>
                <AlertDescription>
                  <strong>{targetPassport}</strong> resolves to: <br />
                  <code className="text-xs bg-gray-100 px-1 rounded">{ensAddress}</code>
                </AlertDescription>
              </Alert>
            )}

            {/* Verification Button */}
            {isConnected && (
              <div className="flex justify-center">
                <Button 
                  onClick={handleVerify}
                  disabled={isVerifying || verified}
                  size="lg"
                  className="min-w-48"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : verified ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verified
                    </>
                  ) : (
                    "Verify Ownership"
                  )}
                </Button>
              </div>
            )}

            {/* Results */}
            {result && (
              <Alert className={verified ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <div className="flex items-start gap-2">
                  {verified ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <AlertDescription className="whitespace-pre-line text-sm">
                    {result}
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {verified && (
              <div className="text-center text-sm text-gray-500">
                You can close this window and return to registration.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}