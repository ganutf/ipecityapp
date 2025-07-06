import { useState, useEffect } from "react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { SocialLinksFields } from "@/components/SocialLinksFields";
import { ProfileTagsField } from "@/components/ProfileTagsField";
import { User, Twitter, Linkedin, Instagram, Edit3, X, Check } from "lucide-react";

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
    walletRenewalStatus?: "pending_renewal" | "renewal_approved" | null;
    newWalletAddress?: string;
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
  const [isEditing, setIsEditing] = useState(false);

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

  // Update form when member data changes
  useEffect(() => {
    if (memberData?.member) {
      form.reset({
        bio: memberData.member.bio || "",
        twitter: memberData.member.twitter || "",
        linkedin: memberData.member.linkedin || "",
        instagram: memberData.member.instagram || "",
        profileTags: memberData.member.profileTags || [],
      });
    }
  }, [memberData, form]);

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

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
  };

  const handleSave = (data: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(data, {
      onSuccess: () => {
        setIsEditing(false);
      }
    });
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

  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      {/* Verification Sections */}
      <div>
        <h2 className="text-2xl font-bold mb-4">ID Verification</h2>
        <div className="space-y-4">
          <EmailVerificationSection
            farcasterFid={profile?.fid || 0}
            currentEmail={memberData?.member?.email}
            isVerified={memberData?.member?.emailVerified || false}
            allowChange={true}
          />
          
          <PassportVerificationSection
            farcasterFid={profile?.fid || 0}
            currentPassport={memberData?.member?.ipePassport || memberData?.member?.ipeUsername}
            isVerified={memberData?.member?.passportVerified || false}
            memberData={{
              farcasterFid: profile?.fid || 0,
              walletAddress: memberData?.member?.walletAddress,
              ipePassport: memberData?.member?.ipePassport,
              ipeUsername: memberData?.member?.ipeUsername,
              passportVerified: memberData?.member?.passportVerified || false,
              status: memberData?.status || '',
              walletRenewalStatus: memberData?.member?.walletRenewalStatus,
              newWalletAddress: memberData?.member?.newWalletAddress,
              email: memberData?.member?.email,
              emailVerified: memberData?.member?.emailVerified || false
            }}
            farcasterProfile={profile}
            allowChange={true}
          />
        </div>
      </div>

      <Separator />

      {/* Profile Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </span>
            {!isEditing && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Manage your profile information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            // Display Mode
            <div className="space-y-6">
              {/* Member Type - Always at top */}
              <div>
                <Label className="text-sm font-medium text-gray-600">Member Type</Label>
                <Badge variant="secondary" className="mt-1 capitalize text-sm">
                  {memberData?.member?.memberType || "Not specified"}
                </Badge>
              </div>
              
              {/* Email Address */}
              <div>
                <Label className="text-sm font-medium text-gray-600">Email Address</Label>
                <p className="text-sm mt-1">{memberData?.member?.email || "Not provided"}</p>
              </div>

              {/* Bio */}
              <div>
                <Label className="text-sm font-medium text-gray-600">Bio</Label>
                <p className="text-sm mt-1 text-gray-800">
                  {memberData?.member?.bio || "No bio provided"}
                </p>
              </div>

              {/* Social Links */}
              <div>
                <Label className="text-sm font-medium text-gray-600 mb-3 block">Social Links</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      {memberData?.member?.twitter ? (
                        `@${memberData.member.twitter}`
                      ) : (
                        <span className="text-gray-400">Not provided</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      {memberData?.member?.linkedin ? (
                        memberData.member.linkedin
                      ) : (
                        <span className="text-gray-400">Not provided</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-500" />
                    <span className="text-sm">
                      {memberData?.member?.instagram ? (
                        `@${memberData.member.instagram}`
                      ) : (
                        <span className="text-gray-400">Not provided</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Tags */}
              <div>
                <Label className="text-sm font-medium text-gray-600">Profile Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {memberData?.member?.profileTags && memberData.member.profileTags.length > 0 ? (
                    memberData.member.profileTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">No tags selected</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-6">
                
                {/* Member Type - Display only */}
                <div>
                  <Label className="text-sm font-medium text-gray-600">Member Type</Label>
                  <Badge variant="secondary" className="mt-1 capitalize text-sm">
                    {memberData?.member?.memberType || "Not specified"}
                  </Badge>
                </div>

                {/* Bio */}
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us a bit about yourself..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Social Links */}
                <SocialLinksFields control={form.control} layout="vertical" />

                {/* Profile Tags */}
                <ProfileTagsField control={form.control} />

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>


    </div>
  );
}