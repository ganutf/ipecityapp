import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { StatsCards } from "@/components/profile/StatsCards";
import { AboutSection } from "@/components/profile/AboutSection";
import { SocialLinksSection } from "@/components/profile/SocialLinksSection";
import { ProfileTagsSection } from "@/components/profile/ProfileTagsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface MemberDetailsData {
  id: number;
  farcasterFid: number;
  displayName?: string;
  username?: string;
  memberType: string;
  ipePassport?: string;
  passportVerified?: boolean;
  walletAddress?: string;
  bio?: string;
  email?: string;
  emailVerified?: boolean;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  profileTags?: string[];
  totalPoints: number;
  pulseStreak: number;
  createdAt?: string;
  pfpUrl?: string;
}

export default function MemberDetails() {
  const { id } = useParams();
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();

  // Fetch member details using Privy auth
  const { data: memberData, isLoading, error } = useQuery<MemberDetailsData>({
    queryKey: [`/api/v2/community/members/${id}`],
    queryFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(`/api/v2/community/members/${id}`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.member;
    },
    enabled: Boolean(isAuthenticated && id),
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Show loading state
  if (authLoading || isLoading) {
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
          <Card>
            <CardContent className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading member details...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
          <Card>
            <CardContent className="text-center py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Authentication Required
              </h2>
              <p className="text-gray-600">
                Please sign in to view member details.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !memberData) {
    console.error("Member details page error:", error);
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
          {/* Back Button */}
          <Link href="/community">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Community
            </Button>
          </Link>

          <Card>
            <CardContent className="text-center py-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Member Not Found
              </h2>
              <p className="text-gray-600 mb-4">
                The member you're looking for could not be found or may not be an active member.
              </p>
              {error && (
                <details className="text-left text-xs text-gray-500 max-w-md mx-auto">
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{error instanceof Error ? error.message : String(error)}</pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const member: MemberDetailsData = memberData;

  return (
    <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
      <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Back Button */}
        <Link href="/community">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Community
          </Button>
        </Link>

        {/* Header with Profile Info */}
        <ProfileCard>
          <CardContent className="pt-4 md:pt-6">
            <ProfileHeader
              displayName={member.displayName}
              username={member.username}
              fid={member.farcasterFid}
              memberType={member.memberType}
              ipePassport={member.ipePassport}
              passportVerified={member.passportVerified}
              walletAddress={member.walletAddress}
              showWalletActions={false}
              pfpUrl={member.pfpUrl}
              createdAt={member.createdAt}
            />
          </CardContent>
        </ProfileCard>

        {/* Stats Cards */}
        <StatsCards
          totalPoints={member.totalPoints}
          pulseStreak={member.pulseStreak}
          createdAt={member.createdAt}
          walletAddress={member.walletAddress}
        />

        {/* About Section */}
        <AboutSection 
          bio={member.bio} 
          isEditable={false} 
        />

        {/* Profile Tags */}
        <ProfileTagsSection 
          profileTags={member.profileTags} 
          isEditable={false} 
        />

        {/* Social Links */}
        <SocialLinksSection
          email={member.email}
          emailVerified={member.emailVerified}
          twitter={member.twitter}
          linkedin={member.linkedin}
          instagram={member.instagram}
          isEditable={false}
          showEmailVerification={false}
        />

        {/* Projects Section - Placeholder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg flex items-center space-x-2">
              <Briefcase className="h-5 w-5" />
              <span>Projects</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                <LinkIcon className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Projects Coming Soon
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Member project showcases and portfolio integration will be available in a future update.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}