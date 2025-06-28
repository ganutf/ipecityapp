import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

const emailRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const emailVerifySchema = z.object({
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export default function EmailVerificationPage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");

  const requestForm = useForm<z.infer<typeof emailRequestSchema>>({
    resolver: zodResolver(emailRequestSchema),
    defaultValues: {
      email: "",
    },
  });

  const verifyForm = useForm<z.infer<typeof emailVerifySchema>>({
    resolver: zodResolver(emailVerifySchema),
    defaultValues: {
      code: "",
    },
  });

  const requestEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailRequestSchema>) => {
      return await apiRequest("/api/auth/request-email-verification", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          email: data.email,
        }),
      });
    },
    onSuccess: () => {
      setEmailSent(true);
      setEmail(requestForm.getValues().email);
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit verification code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification email",
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof emailVerifySchema>) => {
      return await apiRequest("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: profile?.fid,
          code: data.code,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Email verified!",
        description: "Your email has been successfully verified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      // Navigation will be handled by AuthGuard based on updated status
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid or expired verification code",
        variant: "destructive",
      });
    },
  });

  const handleRequestEmail = (data: z.infer<typeof emailRequestSchema>) => {
    requestEmailMutation.mutate(data);
  };

  const handleVerifyEmail = (data: z.infer<typeof emailVerifySchema>) => {
    verifyEmailMutation.mutate(data);
  };

  const handleResendCode = () => {
    if (email) {
      requestEmailMutation.mutate({ email });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            Verify your email address to continue registration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!emailSent ? (
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(handleRequestEmail)} className="space-y-4">
                <FormField
                  control={requestForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={requestEmailMutation.isPending}
                >
                  {requestEmailMutation.isPending ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">
                  We sent a 6-digit verification code to:
                </p>
                <p className="font-medium">{email}</p>
              </div>
              
              <Form {...verifyForm}>
                <form onSubmit={verifyForm.handleSubmit(handleVerifyEmail)} className="space-y-4">
                  <FormField
                    control={verifyForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="123456" 
                            maxLength={6}
                            className="text-center text-lg tracking-widest"
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
              
              <div className="text-center">
                <Button 
                  variant="link" 
                  onClick={handleResendCode}
                  disabled={requestEmailMutation.isPending}
                  className="text-sm"
                >
                  Resend code
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}