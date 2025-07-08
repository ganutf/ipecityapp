import { useForm } from "react-hook-form";
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
import { Wallet, Mail, Globe, User, CheckCircle, AlertCircle, Edit3 } from "lucide-react";

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

const PROFILE_TAGS = [
  'tech founder', 'student', 'developer', 'lawyer', 'scientist',
  'public servant', 'designer', 'creator', 'technologist', 'researcher'
];

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

  // Get member data
  const { data: memberData } = useQuery<MemberData>({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: memberData?.member?.bio || "",
      twitter: memberData?.member?.twitter || "",
      linkedin: memberData?.member?.linkedin || "",
      instagram: memberData?.member?.instagram || "",
      profileTags: memberData?.member?.profileTags || [],
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof profileSchema>) => {
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
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  const handleTagToggle = (tag: string) => {
    const currentTags = form.getValues("profileTags") || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    form.setValue("profileTags", newTags);
  };

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

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);

  const hasIpeCityDomain = ensName && (ensName.endsWith('.ipecity.eth') || ensName === 'ipecity.eth');

  return (
    <div className="container mx-auto max-w-4xl py-8 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account settings and verification status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your bio, social links, and profile tags
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Bio Section */}
              <div>
                <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  className="mt-1"
                  {...form.register("bio")}
                />
              </div>

              {/* Social Links */}
              <div>
                <Label className="text-sm font-medium">Social Links</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label htmlFor="twitter" className="text-xs text-gray-500">Twitter</Label>
                    <Input
                      id="twitter"
                      placeholder="username"
                      className="mt-1"
                      {...form.register("twitter")}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="linkedin" className="text-xs text-gray-500">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      placeholder="profile URL"
                      className="mt-1"
                      {...form.register("linkedin")}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="instagram" className="text-xs text-gray-500">Instagram</Label>
                    <Input
                      id="instagram"
                      placeholder="username"
                      className="mt-1"
                      {...form.register("instagram")}
                    />
                  </div>
                </div>
              </div>

              {/* Profile Tags */}
              <div>
                <Label className="text-sm font-medium">Profile Tags</Label>
                <p className="text-xs text-gray-500 mb-3">Select tags that describe you</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PROFILE_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        checked={(form.watch("profileTags") || []).includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <Label htmlFor={tag} className="text-sm cursor-pointer">
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Profile Preview */}
              {(memberData?.member?.bio || (memberData?.member?.profileTags && memberData.member.profileTags.length > 0)) && (
                <div className="border-t pt-6">
                  <Label className="text-sm font-medium text-gray-700">Current Profile</Label>
                  <div className="mt-2 space-y-3">
                    {memberData?.member?.bio && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm">{memberData.member.bio}</p>
                      </div>
                    )}
                    
                    {memberData?.member?.profileTags && memberData.member.profileTags.length > 0 && (
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
                    )}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}