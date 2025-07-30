import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AboutSection } from "@/components/profile/AboutSection";
import { SocialLinksSection } from "@/components/profile/SocialLinksSection";
import { ProfileTagsSection } from "@/components/profile/ProfileTagsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Target, Calendar, Briefcase, Link as LinkIcon } from "lucide-react";
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
}

export default function MemberDetails() {
  const { fid } = useParams();
  const { isAuthenticated, profile, isLoading: authLoading } = usePersistentAuth();

  // Fetch member details
  const { data: memberData, isLoading, error } = useQuery<MemberDetailsData>({
    queryKey: [`/api/community/members/${fid}`],
    queryFn: async () => {
      console.log("=== FRONTEND MEMBER DETAILS QUERY DEBUG START ===");
      console.log("Fetching member details for FID:", fid);
      console.log("Profile FID:", profile?.fid);
      console.log("Is authenticated:", isAuthenticated);
      
      const response = await fetch(`/api/community/members/${fid}`, {
        headers: {
          "x-farcaster-fid": profile?.fid?.toString() || "",
        },
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error text:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Member details response data:", data);
      console.log("=== FRONTEND MEMBER DETAILS QUERY DEBUG END ===");
      
      return data;
    },
    enabled: Boolean(isAuthenticated && fid && profile?.fid),
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
  const joinDate = member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'Unknown';

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
        <Card>
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
            />
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{member.totalPoints}</p>
                  <p className="text-sm text-gray-600">Total Points</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Target className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{member.pulseStreak}</p>
                  <p className="text-sm text-gray-600">Pulse Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{joinDate}</p>
                  <p className="text-sm text-gray-600">Member Since</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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