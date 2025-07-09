import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { Wallet, Mail, Globe, User, CheckCircle, AlertCircle, Edit3, Save, X } from "lucide-react";
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
  };
}



const profileSchema = z.object({
  bio: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
});

export default function ProfilePage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // All hooks must be called at the top level
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);

  // Edit mode states
  const [editingBio, setEditingBio] = useState(false);
  const [editingSocial, setEditingSocial] = useState(false);
  const [editingTags, setEditingTags] = useState(false);

  // Form states for editing
  const [bioValue, setBioValue] = useState("");
  const [twitterValue, setTwitterValue] = useState("");
  const [linkedinValue, setLinkedinValue] = useState("");
  const [instagramValue, setInstagramValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get member data
  const { data: memberData } = useQuery<MemberData>({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  // Update form values when member data loads
  useEffect(() => {
    if (memberData?.member) {
      setBioValue(memberData.member.bio || "");
      setTwitterValue(memberData.member.twitter || "");
      setLinkedinValue(memberData.member.linkedin || "");
      setInstagramValue(memberData.member.instagram || "");
      setSelectedTags(memberData.member.profileTags || []);
    }
  }, [memberData]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<{
      bio: string;
      twitter: string;
      linkedin: string;
      instagram: string;
      profileTags: string[];
    }>) => {
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
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${profile?.fid}`] });
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
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
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
    setEditingSocial(false);
  };

  const cancelTagsEdit = () => {
    setSelectedTags(memberData?.member?.profileTags || []);
    setEditingTags(false);
  };

  // Early return after all hooks
  if (!memberData?.isMember) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Complete Verification</CardTitle>
            <CardDescription>
              Please complete email and passport verification to access your profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const hasIpeCityDomain = ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth');

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account settings and verification status</p>
      </div>

      <div className="space-y-6">
        {/* 1. Wallet Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your wallet to manage your Ipê City identity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">Connected Wallet</p>
                      <p className="text-xs font-mono text-green-700">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => disconnect()}
                  className="w-full"
                >
                  Disconnect Wallet
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No wallet connected</p>
                </div>
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <Button onClick={openConnectModal} className="w-full">
                      <Wallet className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </Button>
                  )}
                </ConnectButton.Custom>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Passport Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Ipê Passport
            </CardTitle>
            <CardDescription>
              Your ENS subdomain and associated wallet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {memberData?.member?.ipePassport || hasIpeCityDomain ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-800">ENS Domain</p>
                      <p className="text-sm text-green-700 font-mono">
                        {memberData?.member?.ipePassport || ensName}
                      </p>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                </div>
                {address && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">Associated Wallet</p>
                    <p className="text-xs font-mono text-blue-700">
                      {address}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No ENS domain verified</p>
                  <p className="text-xs text-gray-500 mt-1">Complete verification to claim your passport</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Email Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification
            </CardTitle>
            <CardDescription>
              Manage your email address and verification status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailVerificationSection
              farcasterFid={profile?.fid || 0}
              currentEmail={memberData?.member?.email}
              isVerified={memberData?.member?.emailVerified || false}
              allowChange={true}
            />
          </CardContent>
        </Card>

        {/* 4. Profile Information Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your bio, social links, and profile tags
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bio Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Bio</Label>
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
              
              {editingBio ? (
                <div className="space-y-3">
                  <Textarea
                    value={bioValue}
                    onChange={(e) => setBioValue(e.target.value)}
                    placeholder="Tell us about yourself..."
                    className="min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleBioSave}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelBioEdit}
                      disabled={updateProfileMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg min-h-[60px] flex items-center">
                  <p className="text-sm text-gray-700">
                    {memberData?.member?.bio || "No bio provided"}
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Social Links Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Social Links</Label>
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
              
              {editingSocial ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="twitter" className="text-xs text-gray-500">Twitter</Label>
                      <Input
                        id="twitter"
                        value={twitterValue}
                        onChange={(e) => setTwitterValue(e.target.value)}
                        placeholder="username"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="linkedin" className="text-xs text-gray-500">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        value={linkedinValue}
                        onChange={(e) => setLinkedinValue(e.target.value)}
                        placeholder="profile URL"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="instagram" className="text-xs text-gray-500">Instagram</Label>
                      <Input
                        id="instagram"
                        value={instagramValue}
                        onChange={(e) => setInstagramValue(e.target.value)}
                        placeholder="username"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSocialSave}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelSocialEdit}
                      disabled={updateProfileMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Twitter</p>
                    <p className="text-sm text-gray-700">
                      {memberData?.member?.twitter || "Not provided"}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
                    <p className="text-sm text-gray-700">
                      {memberData?.member?.linkedin || "Not provided"}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Instagram</p>
                    <p className="text-sm text-gray-700">
                      {memberData?.member?.instagram || "Not provided"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Profile Tags Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Profile Tags</Label>
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
              
              {editingTags ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">Select tags that describe you</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {PROFILE_TAGS.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={tag}
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={() => handleTagToggle(tag)}
                        />
                        <Label htmlFor={tag} className="text-sm cursor-pointer">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleTagsSave}
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelTagsEdit}
                      disabled={updateProfileMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg min-h-[60px] flex items-center">
                  {memberData?.member?.profileTags && memberData.member.profileTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {memberData.member.profileTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700">No tags selected</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}