import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import {
  Wallet,
  Mail,
  Globe,
  User,
  CheckCircle,
  AlertCircle,
  Edit3,
  Save,
  X,
  Shield,
  Compass,
  Twitter,
  Linkedin,
  Instagram,
  Users,
  Star,
} from "lucide-react";
import { PROFILE_TAGS } from "@/constants/profileTags";

interface MemberData {
  isMember: boolean;
  approved: boolean;
  status?: string;
  member?: {
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
  const { profile, isAuthenticated, isLoading: authLoading } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Authentication check - redirect to home if not authenticated
  // Wait for auth to stabilize before making redirect decisions
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !profile?.fid) {
      console.log("Profile - Not authenticated (stable), redirecting to home");
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, profile, setLocation]);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);

  // Member type configuration
  const memberTypeConfig = {
    architect: { 
      label: 'Architect', 
      icon: User, 
      color: 'bg-purple-100 text-purple-600',
      hoverColor: 'hover:bg-purple-200',
      description: 'Building the future of communities'
    },
    explorer: { 
      label: 'Explorer', 
      icon: Compass, 
      color: 'bg-blue-100 text-blue-600',
      hoverColor: 'hover:bg-blue-200',
      description: 'Discovering new possibilities'
    },
    admin: { 
      label: 'Admin', 
      icon: Shield, 
      color: 'bg-green-100 text-green-600',
      hoverColor: 'hover:bg-green-200',
      description: 'Leading and managing the community'
    },
    org_team: { 
      label: 'Org Team', 
      icon: Users, 
      color: 'bg-orange-100 text-orange-600',
      hoverColor: 'hover:bg-orange-200',
      description: 'Supporting organizational operations'
    },
    core_team: { 
      label: 'Core Team', 
      icon: Star, 
      color: 'bg-red-100 text-red-600',
      hoverColor: 'hover:bg-red-200',
      description: 'Core development and leadership'
    },
    pending: { 
      label: 'Pending', 
      icon: AlertCircle, 
      color: 'bg-gray-100 text-gray-600',
      hoverColor: 'hover:bg-gray-200',
      description: 'Awaiting approval'
    }
  };

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

  // Wallet disconnect confirmation dialog state
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const { data: memberData, isLoading } = useQuery<MemberData>({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  const currentMemberType = memberData?.member?.memberType || 'pending';
  const memberTypeInfo = memberTypeConfig[currentMemberType as keyof typeof memberTypeConfig];

  // Verification status check - redirect incomplete users to id-verification
  useEffect(() => {
    if (memberData && profile?.fid) {
      const { isMember, status } = memberData as any;
      if (isMember) {
        const incompleteStatuses = [
          'pending_id_verification',
          'email_verified', 
          'pending_application_preview',
          'approved_application'
        ];
        if (incompleteStatuses.includes(status)) {
          console.log("Profile - Incomplete verification, redirecting to id-verification. Status:", status);
          setLocation("/id-verification");
          return;
        }
      }
    }
  }, [memberData, profile, setLocation]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: {
      bio?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
      profileTags?: string[];
    }) => {
      return apiRequest(`/api/members/${profile?.fid}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          profileCompleted: true,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/members/check/${profile?.fid}`],
      });
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

  const handleDisconnectConfirm = () => {
    disconnect();
    setShowDisconnectDialog(false);
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

  // Initialize form values when memberData loads
  useEffect(() => {
    if (memberData?.member) {
      setBioValue(memberData.member.bio || "");
      setTwitterValue(memberData.member.twitter || "");
      setLinkedinValue(memberData.member.linkedin || "");
      setInstagramValue(memberData.member.instagram || "");
      setEmailValue(memberData.member.email || "");
      setSelectedTags(memberData.member.profileTags || []);
    }
  }, [memberData]);

  // Show loading while auth is stabilizing
  if (authLoading || (!profile?.fid && isAuthenticated)) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
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

  const hasIpeCityDomain =
    ensName && (ensName.endsWith(".ipecity.eth") || ensName === "ipecity.eth");

  return (
    <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
      <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Header with Profile Info */}
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    {profile?.displayName || profile?.username}
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">
                    ID: {profile?.fid}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    {memberTypeInfo && (
                      <div className="group relative">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${memberTypeInfo.color} ${memberTypeInfo.hoverColor}`}>
                          <memberTypeInfo.icon className="h-5 w-5" />
                        </div>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="font-medium">{memberTypeInfo.label}</div>
                          <div className="text-xs text-gray-300 mt-1">{memberTypeInfo.description}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2 lg:flex-shrink-0">
                {/* Connected Wallet Info Box */}
                <div
                  className={`flex flex-col px-2 md:px-3 py-1.5 rounded-lg border ${
                    isConnected
                      ? "bg-blue-50 border-blue-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Wallet
                      className={`h-4 w-4 ${isConnected ? "text-blue-600" : "text-gray-400"}`}
                    />
                    <span className="text-xs text-gray-600 font-medium">
                      {isConnected ? "Connected Wallet" : "Wallet Not Connected"}
                    </span>
                  </div>
                  <div className="mt-1">
                    {isConnected ? (
                      <div className="flex items-center space-x-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-xs md:text-sm font-mono hover:underline transition-colors text-blue-600">
                              {address?.slice(0, 6)}...{address?.slice(-4)}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Disconnect Wallet</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to disconnect your wallet? You'll need to reconnect to perform transactions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDisconnectConfirm}>
                                Disconnect
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      </div>
                    ) : (
                      <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                          <button
                            onClick={openConnectModal}
                            className="text-xs md:text-sm text-gray-400 hover:underline transition-colors"
                          >
                            Connect
                          </button>
                        )}
                      </ConnectButton.Custom>
                    )}
                  </div>
                </div>

                {/* Passport Info Box */}
                {memberData?.member?.ipePassport && memberData?.member?.passportVerified && (
                  <div className="inline-block px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-purple-600" />
                      <span className="text-xs text-gray-600 font-medium">Ipê Passport</span>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <p className="text-purple-600 font-medium text-sm">
                        {memberData.member.ipePassport}
                      </p>
                      {memberData.member.walletAddress && (
                        <div className="text-xs text-gray-500 mt-1">
                          Passport wallet: {memberData.member.walletAddress?.slice(0, 6)}...
                          {memberData.member.walletAddress?.slice(-4)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">About</CardTitle>
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
              <div className="space-y-3">
                <Textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="min-h-[100px]"
                />
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">
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
              <div className="space-y-4">
                {/* Email Section with Verification */}
                <div>
                  <EmailVerificationSection
                    farcasterFid={profile?.fid || 0}
                    currentEmail={memberData?.member?.email}
                    isVerified={memberData?.member?.emailVerified || false}
                    allowChange={true}
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

                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
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
              <div className="space-y-3">
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
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
      </div>
    </div>
  );
}
