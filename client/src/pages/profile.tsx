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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PROFILE_TAGS = [
  'tech founder', 'student', 'developer', 'lawyer', 'scientist',
  'public servant', 'designer', 'creator', 'technologist', 'researcher'
];

const profileSchema = z.object({
  name: z.string().optional(),
  xHandle: z.string().optional(),
  linkedin: z.string().optional(),
  miniBio: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
});

export default function ProfilePage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get member data
  const { data: memberData } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: !!profile?.fid,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: memberData?.member?.name || "",
      xHandle: memberData?.member?.xHandle || "",
      linkedin: memberData?.member?.linkedin || "",
      miniBio: memberData?.member?.miniBio || "",
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
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Update your profile information and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Member Info Display */}
            <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="font-medium">Email</Label>
                  <p className="text-gray-600">{memberData.member?.email}</p>
                </div>
                <div>
                  <Label className="font-medium">Ipê Passport</Label>
                  <p className="text-gray-600">{memberData.member?.ipePassport || 'Not set'}</p>
                </div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  {...form.register("name")}
                />
              </div>

              <div>
                <Label htmlFor="xHandle">X (Twitter) Handle</Label>
                <Input
                  id="xHandle"
                  placeholder="@username"
                  {...form.register("xHandle")}
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
                <Label htmlFor="miniBio">Mini Bio</Label>
                <Textarea
                  id="miniBio"
                  placeholder="Tell us a bit about yourself..."
                  rows={3}
                  {...form.register("miniBio")}
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