import { useProfile } from "@farcaster/auth-kit";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Clock, Mail, CheckCircle } from "lucide-react";

export default function PendingPage() {
  const { profile } = useProfile();
  const [, setLocation] = useLocation();

  // Get member status
  const { data: memberStatus } = useQuery({
    queryKey: ["/api/members/check", profile?.fid],
    enabled: !!profile?.fid,
    refetchInterval: 5000, // Check every 5 seconds for approval
  }) as { data?: { 
    approved: boolean; 
    status: string; 
    member?: { 
      name: string; 
      ipePassport: string; 
    } 
  } };

  // Redirect if approved
  if (memberStatus?.approved) {
    setLocation("/");
    return null;
  }

  // Redirect if denied
  if (memberStatus?.status === "denied") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="container mx-auto max-w-md px-4">
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-red-600">Registration Not Approved</CardTitle>
              <CardDescription>
                Your registration for Ipê City Pulse was not approved at this time.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-4">
                If you have questions about this decision, please contact our support team.
              </p>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
              >
                Go Back
              </Button>
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
              <Clock className="w-8 h-8 text-[#8B5CF6]" />
            </div>
            <CardTitle>Registration Under Review</CardTitle>
            <CardDescription>
              Thank you for your registration, {memberStatus?.member?.name || profile?.displayName}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Mail className="w-5 h-5 text-[#8B5CF6]" />
                  <span className="font-medium">Email Notification</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You'll be notified via email when your registration is approved.
                </p>
              </div>

              {memberStatus?.member?.ipePassport && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                    Your Ipê Passport:
                  </p>
                  <p className="text-green-600 dark:text-green-400 font-mono">
                    {memberStatus.member.ipePassport}.ipecity.eth
                  </p>
                </div>
              )}

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Our team will review your registration and approve qualified members.
                </p>
                <p>
                  This process typically takes 24-48 hours.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.reload()}
              >
                Check Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}