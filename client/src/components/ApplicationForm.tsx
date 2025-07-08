import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, User, Globe, Twitter, Linkedin, Instagram, Tag } from "lucide-react";
import { PROFILE_TAGS } from "@/constants/profileTags";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { apiRequest } from "@/lib/queryClient";

// Application form schema
const applicationFormSchema = z.object({
  ipeUsername: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9]+$/, "Username can only contain lowercase letters and numbers"),
  bio: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(), 
  instagram: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
});

type ApplicationFormData = z.infer<typeof applicationFormSchema>;

interface ApplicationFormProps {
  memberData: any;
  farcasterProfile: any;
  onSuccess: () => void;
}

export function ApplicationForm({ memberData, farcasterProfile, onSuccess }: ApplicationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      ipeUsername: farcasterProfile?.username?.replace(/[^a-z0-9]/g, "").toLowerCase() || "",
      bio: "",
      twitter: "",
      linkedin: "",
      instagram: "",
      profileTags: [],
    },
  });

  // Check username availability
  const [usernameStatus, setUsernameStatus] = useState<"checking" | "available" | "taken" | "error">("checking");
  const watchedUsername = form.watch("ipeUsername");

  useEffect(() => {
    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameStatus("checking");
      return;
    }

    const checkAvailability = async () => {
      try {
        setUsernameStatus("checking");
        const response = await fetch(`/api/passport/availability/${watchedUsername}`);
        const data = await response.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch (error) {
        setUsernameStatus("error");
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [watchedUsername]);

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      return apiRequest("/api/application/submit", {
        method: "POST",
        body: JSON.stringify({
          farcasterFid: memberData.member.farcasterFid,
          ...data,
          profileTags: selectedTags,
          walletAddress: address,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Application submitted successfully!",
        description: "Your application is now pending admin approval.",
      });
      // Invalidate member status queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/members/check/${memberData.member.farcasterFid}`] });
      // Small delay to ensure backend has processed the update
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: [`/api/members/check/${memberData.member.farcasterFid}`] });
      }, 500);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to submit application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApplicationFormData) => {
    if (usernameStatus !== "available") {
      toast({
        title: "Username not available",
        description: "Please choose a different username.",
        variant: "destructive",
      });
      return;
    }
    submitApplicationMutation.mutate(data);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 5 
          ? [...prev, tag]
          : prev; // Don't add if already at max
      
      // Update form value
      form.setValue("profileTags", newTags);
      return newTags;
    });
  };

  const getUsernameStatusColor = () => {
    switch (usernameStatus) {
      case "available": return "text-green-600";
      case "taken": return "text-red-600";
      case "error": return "text-gray-500";
      default: return "text-gray-500";
    }
  };

  const getUsernameStatusText = () => {
    switch (usernameStatus) {
      case "available": return "✓ Available";
      case "taken": return "✗ Taken";
      case "error": return "Error checking";
      default: return "Checking...";
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Submit Application
        </CardTitle>
        <p className="text-sm text-gray-600">
          Complete your application to join the Ipê City community. All fields are optional except username.
        </p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Username Field */}
            <FormField
              control={form.control}
              name="ipeUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Ipê Passport Username
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input {...field} placeholder="your-username" />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          Will create: {watchedUsername}.ipecity.eth
                        </span>
                        <span className={getUsernameStatusColor()}>
                          {getUsernameStatusText()}
                        </span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bio Field */}
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Tell us about yourself..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Social Media Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="@username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="linkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="linkedin.com/in/username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="instagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Instagram className="h-4 w-4" />
                      Instagram
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="@username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Profile Tags */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Skills & Interests (max 5)
              </FormLabel>
              <p className="text-xs text-gray-500">Select tags that describe you</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROFILE_TAGS.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={tag}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => handleTagToggle(tag)}
                      disabled={selectedTags.length >= 5 && !selectedTags.includes(tag)}
                    />
                    <Label htmlFor={tag} className="text-sm cursor-pointer">
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={
                submitApplicationMutation.isPending ||
                usernameStatus !== "available"
              }
            >
              {submitApplicationMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting Application...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submit Application
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}