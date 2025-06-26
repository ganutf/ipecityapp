import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useProfile } from "@farcaster/auth-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const PROFILE_TAGS = [
  'tech founder',
  'student', 
  'developer',
  'lawyer',
  'scientist',
  'public servant',
  'designer',
  'creator',
  'technologist',
  'researcher'
];

const registrationSchema = z.object({
  email: z.string().email("Invalid email address"),
  xHandle: z.string().optional(),
  linkedin: z.string().optional(),
  miniBio: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
  ipePassport: z.string()
    .min(3, "Passport must be at least 3 characters")
    .max(20, "Passport must be at most 20 characters")
    .regex(/^[a-z0-9]+$/, "Passport can only contain lowercase letters and numbers"),
});

type RegistrationData = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const { profile } = useProfile();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);

  const form = useForm<RegistrationData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      email: "",
      xHandle: "",
      linkedin: "",
      miniBio: "",
      profileTags: [],
      ipePassport: "",
    },
  });

  // Check passport availability
  const passportValue = form.watch("ipePassport");
  const { data: passportCheck } = useQuery({
    queryKey: ["/api/passport/check", passportValue],
    enabled: !!passportValue && passportValue.length >= 3,
  });

  // Send verification email
  const sendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest(`/api/auth/verify-email`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          email,
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send verification code. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Confirm verification code
  const confirmVerificationMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiRequest(`/api/auth/confirm-email`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
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
    },
    onError: () => {
      toast({
        title: "Invalid code",
        description: "The verification code is invalid or expired.",
        variant: "destructive",
      });
    },
  });

  // Register member
  const registerMutation = useMutation({
    mutationFn: async (data: RegistrationData) => {
      return apiRequest(`/api/auth/register`, {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          farcasterUsername: profile?.username,
          name: profile?.displayName || profile?.username || "",
          ...data,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Registration successful",
        description: "Your registration is now under review.",
      });
      setLocation("/pending");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendVerification = () => {
    const email = form.getValues("email");
    if (email) {
      sendVerificationMutation.mutate(email);
    }
  };

  const handleConfirmVerification = () => {
    if (verificationCode) {
      confirmVerificationMutation.mutate(verificationCode);
    }
  };

  const onSubmit = (data: RegistrationData) => {
    if (!emailVerified) {
      toast({
        title: "Email verification required",
        description: "Please verify your email before submitting.",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(data);
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    const currentTags = form.getValues("profileTags") || [];
    if (checked) {
      form.setValue("profileTags", [...currentTags, tag]);
    } else {
      form.setValue("profileTags", currentTags.filter(t => t !== tag));
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in with Farcaster to continue registration.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Registration</CardTitle>
            <CardDescription>
              Welcome {profile.displayName || profile.username}! Please provide additional information to complete your registration.
            </CardDescription>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Farcaster Info */}
              <div className="space-y-2">
                <Label>Farcaster Username</Label>
                <Input value={profile.username} disabled />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    disabled={emailVerified}
                  />
                  {!emailVerified && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendVerification}
                      disabled={!form.watch("email") || sendVerificationMutation.isPending}
                    >
                      {sendVerificationMutation.isPending ? "Sending..." : "Verify"}
                    </Button>
                  )}
                  {emailVerified && (
                    <Button type="button" variant="outline" disabled>
                      ✓ Verified
                    </Button>
                  )}
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              {/* Email Verification */}
              {showVerification && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">Verification Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                        />
                        <Button
                          type="button"
                          onClick={handleConfirmVerification}
                          disabled={!verificationCode || confirmVerificationMutation.isPending}
                        >
                          {confirmVerificationMutation.isPending ? "Confirming..." : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Ipê Passport */}
              <div className="space-y-2">
                <Label htmlFor="ipePassport">Ipê Passport *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ipePassport"
                    {...form.register("ipePassport")}
                    placeholder="yourname"
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">.ipecity.eth</span>
                </div>
                {passportValue && passportCheck && (
                  <p className={`text-sm ${passportCheck.available ? "text-green-600" : "text-red-600"}`}>
                    {passportCheck.available ? "✓ Available" : `✗ ${passportCheck.reason || "Not available"}`}
                  </p>
                )}
                {form.formState.errors.ipePassport && (
                  <p className="text-sm text-destructive">{form.formState.errors.ipePassport.message}</p>
                )}
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="xHandle">X (Twitter) Handle</Label>
                  <Input
                    id="xHandle"
                    {...form.register("xHandle")}
                    placeholder="@yourhandle"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn Profile</Label>
                  <Input
                    id="linkedin"
                    {...form.register("linkedin")}
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="miniBio">Mini Bio</Label>
                <Textarea
                  id="miniBio"
                  {...form.register("miniBio")}
                  placeholder="Tell us a bit about yourself..."
                  rows={3}
                />
              </div>

              {/* Profile Tags */}
              <div className="space-y-3">
                <Label>Profile Tags</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PROFILE_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        onCheckedChange={(checked) => handleTagChange(tag, !!checked)}
                      />
                      <Label htmlFor={tag} className="text-sm font-normal">
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={!emailVerified || registerMutation.isPending}
              >
                {registerMutation.isPending ? "Submitting..." : "Complete Registration"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}