import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, AlertCircle } from "lucide-react";

interface EmailVerificationSectionProps {
  memberId: number;
  farcasterFid?: number; // Optional, kept for backward compatibility
  currentEmail?: string;
  isVerified?: boolean;
  onVerificationComplete?: () => void;
  allowChange?: boolean;
}

export function EmailVerificationSection({
  memberId,
  farcasterFid,
  currentEmail,
  isVerified = false,
  onVerificationComplete,
  allowChange = false
}: EmailVerificationSectionProps) {
  const { getAccessToken } = useAuth();

  // Ensure we always have string values, never null/undefined
  const initialEmail = currentEmail || "";
  const [email, setEmail] = useState(initialEmail);
  const [originalEmail, setOriginalEmail] = useState(initialEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(isVerified);
  const { toast } = useToast();

  // Sync local state with props when they change (for page refreshes)
  useEffect(() => {
    const emailValue = currentEmail || "";
    setEmail(emailValue);
    setOriginalEmail(emailValue);
    setEmailVerified(isVerified || false);
    console.log("EmailVerificationSection: Updated state - isVerified:", isVerified, "currentEmail:", currentEmail, "emailVerified state:", emailVerified);
  }, [currentEmail, isVerified]);

  // Send verification email (uses v2 endpoint with memberId)
  const sendVerificationMutation = useMutation({
    mutationFn: async (emailAddress: string) => {
      const token = await getAccessToken();
      const response = await fetch(`/api/v2/auth/request-email-verification`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          memberId,
          email: emailAddress,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      return response.json();
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

  // Confirm verification code (uses v2 endpoint with memberId)
  const confirmVerificationMutation = useMutation({
    mutationFn: async (code: string) => {
      const token = await getAccessToken();
      const response = await fetch(`/api/v2/auth/verify-email`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          memberId,
          code,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      return response.json();
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
    <div className="space-y-4">
      {emailVerified ? (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800">Verified Email</p>
                <p className="text-sm text-green-700">{email}</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
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
        <div className="space-y-3">
          
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
              <span className="text-xs text-gray-500 ml-2">(verification required)</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="mt-1"
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
              {allowChange && originalEmail && (
                <Button
                  variant="outline"
                  onClick={cancelEmailChange}
                  disabled={sendVerificationMutation.isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
                <Input
                  id="code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="mt-1"
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
        </div>
      )}
    </div>
  );
}