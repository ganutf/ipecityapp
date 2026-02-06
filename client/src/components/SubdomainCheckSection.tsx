import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { useAuth } from "@/contexts/AuthContext";
import { ApplicationForm } from "@/components/ApplicationForm";
import { CheckCircle, AlertCircle, Loader2, Clock } from "lucide-react";

interface SubdomainCheckSectionProps {
  walletAddress: string;
  memberId: number;
  onSubdomainFound?: () => void;
  onNoSubdomain?: () => void;
}

export function SubdomainCheckSection({
  walletAddress,
  memberId,
  onSubdomainFound,
  onNoSubdomain,
}: SubdomainCheckSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { member, getAccessToken, refreshMember } = useAuth();
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("");

  // Check for subdomain using existing hook
  const { ensName, ensNames, isLoading } = useEnsLookup(walletAddress);

  const hasSubdomain = ensNames && ensNames.length > 0;

  // Auto-select first domain when loaded, or if only one
  const activeDomain = selectedDomain || ensNames?.[0] || null;

  // Mutation to upgrade member to active
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(`/api/v2/members/${memberId}/upgrade-to-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ selectedDomain: activeDomain }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome to Ipê City!",
        description: `Your domain ${activeDomain} has been verified.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
      onSubdomainFound?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleContinueToDashboard = () => {
    upgradeMutation.mutate();
  };

  const handleApplyForMembership = () => {
    setShowApplicationForm(true);
    onNoSubdomain?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Checking for Subdomain
          </CardTitle>
          <CardDescription>
            Searching for ipecity.eth subdomain on your wallet...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (hasSubdomain) {
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            {ensNames.length > 1 ? 'Multiple Domains Found!' : 'Subdomain Found!'}
          </CardTitle>
          <CardDescription>
            {ensNames.length > 1
              ? `We found ${ensNames.length} ipecity.eth domains on your wallet. Choose which one to activate with:`
              : <>We found your ipecity.eth subdomain: <strong>{activeDomain}</strong></>
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Domain selection when multiple domains */}
          {ensNames.length > 1 && (
            <div className="space-y-2">
              {ensNames.map((domain) => (
                <label
                  key={domain}
                  className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    activeDomain === domain
                      ? 'bg-green-50 border-green-300'
                      : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="selectedDomain"
                    value={domain}
                    checked={activeDomain === domain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{domain}</span>
                </label>
              ))}
            </div>
          )}

          <Button
            onClick={handleContinueToDashboard}
            disabled={upgradeMutation.isPending || !activeDomain}
            className="w-full"
          >
            {upgradeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              `Continue with ${activeDomain}`
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show pending review state if application was submitted or member status reflects it
  const isPendingReview = applicationSubmitted || member?.status === 'pending_application_review';

  if (isPendingReview) {
    return (
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Application Under Review
          </CardTitle>
          <CardDescription>
            Your application has been submitted and is pending admin approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-sm text-amber-800">
              You'll be notified once your application is reviewed. This usually takes 1-2 business days.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build memberData for ApplicationForm
  const memberData = member ? {
    isMember: true,
    approved: false,
    status: member.status,
    member: {
      id: member.id,
      email: member.email,
      status: member.status,
      ipeUsername: member.ipeUsername,
      walletAddress: member.walletAddress || walletAddress,
    },
  } : undefined;

  return (
    <>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500" />
            No Subdomain Found
          </CardTitle>
          <CardDescription>
            We didn't find an ipecity.eth subdomain linked to your wallet. You can apply for
            membership to get one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showApplicationForm && (
            <Button
              onClick={handleApplyForMembership}
              className="w-full"
            >
              Apply for Membership
            </Button>
          )}
        </CardContent>
      </Card>

      {showApplicationForm && memberData && (
        <ApplicationForm
          memberData={memberData}
          memberId={memberId}
          onSuccess={() => {
            setShowApplicationForm(false);
            setApplicationSubmitted(true);
            refreshMember();
            queryClient.invalidateQueries({ queryKey: ["/api/members/check"] });
          }}
        />
      )}
    </>
  );
}
