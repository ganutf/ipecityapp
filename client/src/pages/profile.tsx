import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { StatsCards } from "@/components/profile/StatsCards";
import { WalletsCard } from "@/components/profile/WalletsCard";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  Edit3,
  Save,
  X,
  Twitter,
  Linkedin,
  Instagram,
  Briefcase,
  Link as LinkIcon,
} from "lucide-react";
import { PROFILE_TAGS } from "@/constants/profileTags";

interface MemberData {
  isMember: boolean;
  approved: boolean;
  status?: string;
  member?: {
    id?: number;
    name?: string;
    email?: string;
    emailVerified?: boolean;
    passportVerified?: boolean;
    bio?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    profileTags?: string[];
    ipePassport?: string;
    ipeUsername?: string;
    memberType?: string;
    profileCompleted?: boolean;
    walletAddress?: string;
    totalPoints?: number;
    pulseStreak?: number;
    createdAt?: string;
    ipeBalance?: string;
  };
}

const profileSchema = z.object({
  bio: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
});

export default function Profile2() {
  const { member, memberId, isAuthenticated, isLoading: authLoading, isMemberLoading, memberStatus, refreshMember, getAccessToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Authentication check - redirect to home if not authenticated
  // Wait for auth to stabilize before making redirect decisions
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log("Profile - Not authenticated (stable), redirecting to home");
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, setLocation]);


  // Edit states
  const [editingBio, setEditingBio] = useState(false);
  const [editingSocial, setEditingSocial] = useState(false);
  const [editingTags, setEditingTags] = useState(false);

  // Form values
  const [bioValue, setBioValue] = useState("");
  const [twitterValue, setTwitterValue] = useState("");
  const [linkedinValue, setLinkedinValue] = useState("");
  const [instagramValue, setInstagramValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Email verification states for social section
  const [emailValue, setEmailValue] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);


  // Use member data from AuthContext instead of fetching via query
  const memberData: MemberData | undefined = member ? {
    isMember: true,
    approved: memberStatus === 'active_member',
    status: memberStatus || undefined,
    member: {
      id: member.id,
      name: member.ipeUsername || member.email?.split('@')[0] || undefined, // Use username or email prefix as name
      email: member.email || undefined,
      emailVerified: member.emailVerified,
      passportVerified: !!member.ipePassport,
      bio: member.bio || undefined,
      twitter: member.twitter || undefined,
      linkedin: member.linkedin || undefined,
      instagram: member.instagram || undefined,
      profileTags: member.profileTags || undefined,
      ipePassport: member.ipePassport || undefined,
      ipeUsername: member.ipeUsername || undefined,
      memberType: member.memberType,
      profileCompleted: !!member.bio, // Considered completed if bio is filled
      walletAddress: member.walletAddress || undefined,
      totalPoints: member.totalPoints,
      pulseStreak: member.pulseStreak,
      createdAt: member.createdAt?.toString(),
    },
  } : undefined;
  const isLoading = isMemberLoading;

  // Verification status check - redirect incomplete users to id-verification
  useEffect(() => {
    if (member && memberId) {
      const incompleteStatuses = [
        'pending_id_verification',
        'email_verified',
        'pending_application_review',
        'approved_application'
      ];
      if (incompleteStatuses.includes(memberStatus || '')) {
        console.log("Profile - Incomplete verification, redirecting to id-verification. Status:", memberStatus);
        setLocation("/id-verification");
        return;
      }
    }
  }, [member, memberId, memberStatus, setLocation]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      bio?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      profileTags?: string[];
    }) => {
      const token = await getAccessToken();
      // Use memberId for profile updates via v2 endpoint
      return apiRequest(`/api/v2/members/${memberId}/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      // Refresh member data from AuthContext
      refreshMember();
      // Reset edit modes
      setEditingBio(false);
      setEditingSocial(false);
      setEditingTags(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBioSave = () => {
    updateProfileMutation.mutate({ bio: bioValue });
  };

  const handleSocialSave = () => {
    updateProfileMutation.mutate({
      twitter: twitterValue,
      linkedin: linkedinValue,
      instagram: instagramValue,
    });
  };

  const handleTagsSave = () => {
    updateProfileMutation.mutate({ profileTags: selectedTags });
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const cancelBioEdit = () => {
    setBioValue(memberData?.member?.bio || "");
    setEditingBio(false);
  };

  const cancelSocialEdit = () => {
    setTwitterValue(memberData?.member?.twitter || "");
    setLinkedinValue(memberData?.member?.linkedin || "");
    setInstagramValue(memberData?.member?.instagram || "");
    setEmailValue(memberData?.member?.email || "");
    setEditingSocial(false);
    setIsVerificationSent(false);
    setVerificationCode("");
  };

  const cancelTagsEdit = () => {
    setSelectedTags(memberData?.member?.profileTags || []);
    setEditingTags(false);
  };

  // Initialize form values when member data loads
  // Use member (from auth context, stable reference) instead of memberData (recreated each render)
  useEffect(() => {
    if (member) {
      setBioValue(member.bio || "");
      setTwitterValue(member.twitter || "");
      setLinkedinValue(member.linkedin || "");
      setInstagramValue(member.instagram || "");
      setEmailValue(member.email || "");
      setSelectedTags(member.profileTags || []);
    }
  }, [member]);

  // Show loading while auth is stabilizing
  if (authLoading || isMemberLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading authentication...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Early return after all hooks
  if (!memberData?.isMember) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Complete Verification</CardTitle>
            <CardDescription>
              Please complete email and passport verification to access your
              profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
      <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Header with Profile Info */}
        <ProfileCard>
          <CardContent className="pt-4 md:pt-6">
            <ProfileHeader
              displayName={member?.ipeUsername || member?.email?.split('@')[0]}
              username={member?.ipeUsername || undefined}
              fid={member?.farcasterFid || undefined}
              memberId={memberId || undefined}
              memberType={memberData?.member?.memberType}
              ipePassport={memberData?.member?.ipePassport}
              passportVerified={memberData?.member?.passportVerified}
              pfpUrl={undefined}
              createdAt={memberData?.member?.createdAt}
            />
          </CardContent>
        </ProfileCard>

        {/* Stats Cards */}
        <StatsCards
          totalPoints={memberData?.member?.totalPoints}
          pulseStreak={memberData?.member?.pulseStreak}
          createdAt={memberData?.member?.createdAt}
          ipeBalance={memberData?.member?.ipeBalance}
        />

        {/* Bio Section */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">About</CardTitle>
              {!editingBio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingBio(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingBio ? (
              <div className="space-y-4">
                <Textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="min-h-[100px]"
                />
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleBioSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelBioEdit}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700">
                {memberData?.member?.bio ||
                  "No bio provided yet. Click the edit button to add one."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Social Links
              </CardTitle>
              {!editingSocial && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSocial(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSocial ? (
              <div className="space-y-6">
                {/* Email Section with Verification */}
                <div>
                  <EmailVerificationSection
                    memberId={memberId || 0}
                    farcasterFid={member?.farcasterFid || undefined}
                    currentEmail={memberData?.member?.email}
                    isVerified={memberData?.member?.emailVerified || false}
                    allowChange={true}
                    onVerificationComplete={refreshMember}
                  />
                </div>

                <Separator />

                {/* Social Media Links */}
                <div className="space-y-4">
                  <div>
                    <Label
                      htmlFor="twitter"
                      className="flex items-center space-x-1"
                    >
                      <Twitter className="h-4 w-4" />
                      <span>Twitter</span>
                    </Label>
                    <Input
                      id="twitter"
                      value={twitterValue}
                      onChange={(e) => setTwitterValue(e.target.value)}
                      placeholder="@username"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="linkedin"
                      className="flex items-center space-x-1"
                    >
                      <Linkedin className="h-4 w-4" />
                      <span>LinkedIn</span>
                    </Label>
                    <Input
                      id="linkedin"
                      value={linkedinValue}
                      onChange={(e) => setLinkedinValue(e.target.value)}
                      placeholder="linkedin.com/in/username"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="instagram"
                      className="flex items-center space-x-1"
                    >
                      <Instagram className="h-4 w-4" />
                      <span>Instagram</span>
                    </Label>
                    <Input
                      id="instagram"
                      value={instagramValue}
                      onChange={(e) => setInstagramValue(e.target.value)}
                      placeholder="@username"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleSocialSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelSocialEdit}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Email Display */}
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {memberData?.member?.email || "No email provided"}
                  </span>
                  {memberData?.member?.emailVerified ? (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Social Links Display */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Twitter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {memberData?.member?.twitter || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Linkedin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {memberData?.member?.linkedin || "Not provided"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Instagram className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {memberData?.member?.instagram || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Tags */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Profile Tags
              </CardTitle>
              {!editingTags && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTags(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingTags ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {PROFILE_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <Label htmlFor={tag} className="text-sm">
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 pt-2">
                  <Button
                    size="sm"
                    onClick={handleTagsSave}
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelTagsEdit}
                    className="flex-1 sm:flex-none"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {memberData?.member?.profileTags &&
                memberData.member.profileTags.length > 0 ? (
                  memberData.member.profileTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">
                    No tags selected yet. Click edit to choose tags.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallets */}
        <WalletsCard
          memberId={memberId || 0}
          passportWalletAddress={memberData?.member?.walletAddress}
          ipePassport={memberData?.member?.ipePassport}
        />

        {/* Projects Section */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
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
                Project showcases and portfolio integration will be available in a future update.
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
