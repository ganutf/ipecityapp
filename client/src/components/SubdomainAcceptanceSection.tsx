import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MemberStatus {
  isMember: boolean;
  status?: string;
  member?: {
    id: number;
    farcasterFid: number;
    email?: string;
    emailVerified: boolean;
    ipePassport?: string;
    ipeUsername?: string;
    passportVerified: boolean;
    status: string;
    passportClaimSubdomain?: string;
    passportClaimWalletAddress?: string;
    passportClaimStatus?: string;
  };
}

interface SubdomainAcceptanceSectionProps {
  memberStatus: MemberStatus;
  onStatusChange: () => void;
}

export function SubdomainAcceptanceSection({ memberStatus, onStatusChange }: SubdomainAcceptanceSectionProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const { toast } = useToast();

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/passport/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          farcasterFid: memberStatus.member?.farcasterFid 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to accept subdomain");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Subdomain accepted successfully. You now have full access!",
      });
      onStatusChange();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptMutation.mutateAsync();
    } catch (error) {
      console.error("Accept error:", error);
    } finally {
      setIsAccepting(false);
    }
  };

  const subdomainName = memberStatus.member?.ipeUsername 
    ? `${memberStatus.member.ipeUsername}.ipecity.eth`
    : memberStatus.member?.ipePassport;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Subdomain Acceptance Required
        </CardTitle>
        <CardDescription>
          Your subdomain has been reserved and is ready for activation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="font-medium">Subdomain Reserved</span>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Your subdomain <strong>{subdomainName}</strong> has been reserved by an admin.
          </p>
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            <span>Click "Accept Subdomain" to complete the process and gain full access</span>
          </div>
        </div>

        <div className="text-center">
          <Button
            onClick={handleAccept}
            disabled={isAccepting || acceptMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
          >
            {isAccepting || acceptMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Accepting...
              </>
            ) : (
              "Accept Subdomain"
            )}
          </Button>
        </div>

        <div className="text-sm text-gray-500 text-center">
          <p>By accepting, you acknowledge ownership of the subdomain and agree to complete the registration process.</p>
        </div>
      </CardContent>
    </Card>
  );
}