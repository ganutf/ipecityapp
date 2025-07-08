import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailVerificationSectionProps {
  farcasterFid: number;
  currentEmail?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
}

export function EmailVerificationSection({
  farcasterFid,
  currentEmail = "",
  isVerified = false,
  onVerificationComplete,
  allowChange = false
}: EmailVerificationSectionProps) {
  const [email, setEmail] = useState(currentEmail);
  const [originalEmail, setOriginalEmail] = useState(currentEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(isVerified);
  const { toast } = useToast();

  // Sync local state with props when they change (for page refreshes)
  useEffect(() => {
    setEmail(currentEmail || "");
    setOriginalEmail(currentEmail || "");
    setEmailVerified(isVerified || false);
    console.log("EmailVerificationSection: Updated state - isVerified:", isVerified, "currentEmail:", currentEmail, "emailVerified state:", emailVerified);
  }, [currentEmail, isVerified]);

  // Send verification email
  const sendVerificationMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      return apiRequest(`/api/auth/request-email-verification`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          email: emailAddress,
        }),
      });
    },
    onSuccess: () => {
      setShowVerification(true);
      toast({
        title: "Verification code sent",
        description: "Check your email for the verification code.",
      });
    },
    onError: (error: any) => {
      // Only show error toast if it's not a network/loading issue
      if (!error?.message?.includes('fetch')) {
        toast({
          title: "Error",
          description: "Failed to send verification code. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Confirm verification code
  const confirmVerificationMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest(`/api/auth/confirm-email`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid,
          code,
        }),
      });
    },
    onSuccess: () => {
      setEmailVerified(true);
      setShowVerification(false);
      toast({
        title: "Email verified",
        description: "Your email has been successfully verified.",
      });
      onVerificationComplete?.();
    },
    onError: (error: any) => {
      // Only show error toast if it's not a network/loading issue
      if (!error?.message?.includes('fetch')) {
        toast({
          title: "Invalid code",
          description: "The verification code is invalid or expired.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSendVerification = () => {
    if (!email || !email.includes("@")) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    sendVerificationMutation.mutate(email);
  };

  const handleConfirmCode = () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }
    confirmVerificationMutation.mutate(verificationCode);
  };

  const resetVerification = () => {
    setEmailVerified(false);
    setShowVerification(false);
    setVerificationCode("");
  };

  const cancelEmailChange = () => {
    setEmail(originalEmail);
    setEmailVerified(true);
    setShowVerification(false);
    setVerificationCode("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email Verification
          {emailVerified && <span className="text-green-600">✓</span>}
        </CardTitle>
        <CardDescription>
          {emailVerified 
            ? "Your email address has been verified."
            : "Verify your email address to continue."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {emailVerified ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">{email}</p>
            </div>
            {allowChange && (
              <Button
                variant="outline"
                onClick={resetVerification}
                className="w-full"
              >
                Change Email Address
              </Button>
            )}
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={showVerification}
              />
            </div>

            {!showVerification ? (
              <div className="flex gap-2">
                <Button
                  onClick={handleSendVerification}
                  disabled={sendVerificationMutation.isPending || !email || email === originalEmail}
                  className="flex-1"
                >
                  {sendVerificationMutation.isPending ? "Sending..." : "Send Verification Code"}
                </Button>
                <Button
                  variant="outline"
                  onClick={cancelEmailChange}
                  disabled={sendVerificationMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirmCode}
                    disabled={confirmVerificationMutation.isPending || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {confirmVerificationMutation.isPending ? "Verifying..." : "Verify Code"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowVerification(false)}
                    className="flex-1"
                  >
                    Change Email
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}