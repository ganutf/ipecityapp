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
            memberData={memberData}
            farcasterProfile={profile}
            allowChange={true}
          />
        </div>
      </div>

      <Separator />

      {/* Application Information */}
      <Card>
        <CardHeader>
          <CardTitle>Application Information</CardTitle>
          <CardDescription>
            Information you provided during your application to Ipê City Pulse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Email Address</Label>
              <p className="text-sm">{memberData?.member?.email || "Not provided"}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Ipê Passport</Label>
              <p className="text-sm">
                {memberData?.member?.ipePassport ? (
                  <span className="text-green-600">✓ {memberData.member.ipePassport}</span>
                ) : (
                  "Not verified"
                )}
              </p>
            </div>

            {memberData?.member?.ipeUsername && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Username</Label>
                <p className="text-sm font-mono">{memberData.member.ipeUsername}</p>
              </div>
            )}

            {memberData?.member?.bio && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Bio</Label>
                <p className="text-sm">{memberData.member.bio}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {memberData?.member?.twitter && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Twitter</Label>
                  <p className="text-sm">@{memberData.member.twitter}</p>
                </div>
              )}
              
              {memberData?.member?.linkedin && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">LinkedIn</Label>
                  <p className="text-sm">{memberData.member.linkedin}</p>
                </div>
              )}
              
              {memberData?.member?.instagram && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Instagram</Label>
                  <p className="text-sm">@{memberData.member.instagram}</p>
                </div>
              )}
            </div>

            {memberData?.member?.profileTags && memberData.member.profileTags.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Profile Tags</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {memberData.member.profileTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Member Type</Label>
                <p className="text-sm capitalize">{memberData?.member?.memberType || "Not specified"}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <p className="text-sm capitalize">{memberData?.status?.replace('_', ' ') || "Unknown"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your profile information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Editable Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us a bit about yourself..."
                  rows={3}
                  {...form.register("bio")}
                />
              </div>

              <div>
                <Label htmlFor="twitter">Twitter Handle</Label>
                <Input
                  id="twitter"
                  placeholder="username (without @)"
                  {...form.register("twitter")}
                />
              </div>

              <div>
                <Label htmlFor="linkedin">LinkedIn Profile</Label>
                <Input
                  id="linkedin"
                  placeholder="https://linkedin.com/in/username"
                  {...form.register("linkedin")}
                />
              </div>

              <div>
                <Label htmlFor="instagram">Instagram Handle</Label>
                <Input
                  id="instagram"
                  placeholder="username (without @)"
                  {...form.register("instagram")}
                />
              </div>

              <div>
                <Label>Profile Tags</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PROFILE_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={tag}
                        checked={(form.watch("profileTags") || []).includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <Label htmlFor={tag} className="text-sm capitalize">
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}