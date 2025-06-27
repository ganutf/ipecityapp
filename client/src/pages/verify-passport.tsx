import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useAccount, useEnsAddress, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiweMessage } from "siwe";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyPassportPage() {
  const { token } = useParams<{ token: string }>();
  const [result, setResult] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  
  // Hardcoded for testing
  const targetPassport = "hansen.ipecity.eth";
  
  const { address, isConnected } = useAccount();
  const { data: ensAddress } = useEnsAddress({ name: targetPassport });
  const { signMessageAsync } = useSignMessage();

  // Check localStorage for verification status
  useEffect(() => {
    const storedVerification = localStorage.getItem(`passport-verified-${targetPassport}`);
    if (storedVerification === "true") {
      setVerified(true);
      setResult("✅ Passport ownership already verified!");
    }
  }, [targetPassport]);

  const handleVerify = async () => {
    if (!isConnected || !ensAddress || !address) return;
    
    setIsVerifying(true);
    setResult("");

    try {
      // Check if connected wallet owns the ENS domain
      if (address.toLowerCase() !== ensAddress.toLowerCase()) {
        setResult(`❌ Connected wallet (${address}) does not own ${targetPassport}\n\nENS owner: ${ensAddress}`);
        setIsVerifying(false);
        return;
      }

      // Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: `I prove I own ${targetPassport} for Ipê City registration`,
        uri: window.location.origin,
        version: '1',
        chainId: 1,
        nonce: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
      }).prepareMessage();

      // Sign the message
      const signature = await signMessageAsync({ message });

      // For now, just verify the signature was created successfully
      if (signature) {
        setResult(`✅ Passport ownership verified!\n\n${targetPassport} is owned by your connected wallet.\n\nSignature: ${signature.slice(0, 20)}...`);
        setVerified(true);
        
        // Store verification in localStorage
        localStorage.setItem(`passport-verified-${targetPassport}`, "true");
        localStorage.setItem(`passport-verification-details`, JSON.stringify({
          passport: targetPassport,
          address,
          timestamp: new Date().toISOString(),
          signature: signature.slice(0, 20) + "..."
        }));

        // Close window after delay if opened from registration
        setTimeout(() => {
          if (window.opener) {
            window.close();
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Verification error:", error);
      setResult(`❌ Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
              <ConnectButton />
              
              {isConnected && (
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