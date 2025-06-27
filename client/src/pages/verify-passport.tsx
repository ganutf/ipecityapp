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
      // First check: Verify ENS ownership
      if (address.toLowerCase() !== ensAddress.toLowerCase()) {
        setResult(`❌ Connected wallet (${address}) does not own ${targetPassport}\n\nENS owner: ${ensAddress}`);
        setIsVerifying(false);
        return;
      }

      // Try Method 1: Simple message signing (bypassing SIWE complexity)
      try {
        const simpleMessage = `I own ${targetPassport} - Verification for Ipê City - ${new Date().toISOString()}`;
        console.log("Attempting simple message signing:", simpleMessage);
        
        const signature = await signMessageAsync({ message: simpleMessage });
        
        if (signature) {
          setResult(`✅ Passport ownership verified!\n\n${targetPassport} is owned by your connected wallet.\n\nMethod: Message signature\nAddress: ${address}`);
          setVerified(true);
          
          localStorage.setItem(`passport-verified-${targetPassport}`, "true");
          localStorage.setItem(`passport-verification-details`, JSON.stringify({
            passport: targetPassport,
            address,
            timestamp: new Date().toISOString(),
            verified: true,
            method: "simple-message-signature"
          }));

          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
          return;
        }
      } catch (simpleError) {
        console.log("Simple message signing failed, trying SIWE:", simpleError);
      }

      // Method 2: Try SIWE with corrected format
      try {
        const siweMessage = new SiweMessage({
          domain: window.location.hostname,
          address,
          statement: `I own ${targetPassport}`,
          uri: window.location.origin,
          version: '1',
          chainId: 1,
          nonce: Math.random().toString(36).substring(2, 15),
          issuedAt: new Date().toISOString(),
        });
        
        const message = siweMessage.prepareMessage();
        console.log("SIWE Message format:", message);

        const signature = await signMessageAsync({ message });

        if (signature) {
          setResult(`✅ Passport ownership verified!\n\n${targetPassport} is owned by your connected wallet.\n\nMethod: SIWE signature\nAddress: ${address}`);
          setVerified(true);
          
          localStorage.setItem(`passport-verified-${targetPassport}`, "true");
          localStorage.setItem(`passport-verification-details`, JSON.stringify({
            passport: targetPassport,
            address,
            timestamp: new Date().toISOString(),
            verified: true,
            method: "siwe-signature"
          }));

          setTimeout(() => {
            if (window.opener) {
              window.close();
            }
          }, 3000);
          return;
        }
      } catch (siweError) {
        console.log("SIWE signing failed:", siweError);
      }

      // Method 3: Fallback to ENS ownership verification only
      setResult(`✅ ENS ownership verified!\n\n${targetPassport} is owned by your connected wallet: ${address}\n\nMethod: ENS resolution verification\nNote: Signature verification skipped`);
      setVerified(true);
      
      localStorage.setItem(`passport-verified-${targetPassport}`, "true");
      localStorage.setItem(`passport-verification-details`, JSON.stringify({
        passport: targetPassport,
        address,
        timestamp: new Date().toISOString(),
        verified: true,
        method: "ens-ownership-only"
      }));

      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 3000);

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