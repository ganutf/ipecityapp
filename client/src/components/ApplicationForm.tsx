import { useState, useEffect, useRef } from "react";
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
import { PROFILE_TAGS, VALIDATION_LIMITS } from "@shared/constants";
import { secureUsernameSchema, secureBioSchema, secureSocialHandleSchema, secureProfileTagsSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { validateSocialMediaUrl, type SocialPlatform } from "@/lib/utils";

// Application form schema - using shared validation
const applicationFormSchema = z.object({
  ipeUsername: secureUsernameSchema,
  bio: secureBioSchema,
  twitter: secureSocialHandleSchema.refine((value) => {
    if (!value) return true;
    const validation = validateSocialMediaUrl(value, "twitter");
    return validation.isValid;
  }, "Please enter a valid Twitter/X URL"),
  linkedin: secureSocialHandleSchema.refine((value) => {
    if (!value) return true;
    const validation = validateSocialMediaUrl(value, "linkedin");
    return validation.isValid;
  }, "Please enter a valid LinkedIn URL"),
  instagram: secureSocialHandleSchema.refine((value) => {
    if (!value) return true;
    const validation = validateSocialMediaUrl(value, "instagram");
    return validation.isValid;
  }, "Please enter a valid Instagram URL"),
  profileTags: secureProfileTagsSchema,
});

type ApplicationFormData = z.infer<typeof applicationFormSchema>;

interface ApplicationFormProps {
  memberData: any;
  memberId: number;
  farcasterProfile?: any; // Optional, no longer required
  onSuccess: () => void;
}

export function ApplicationForm({ memberData, memberId, farcasterProfile, onSuccess }: ApplicationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();

  const { activeWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  // Scroll to form when component mounts
  useEffect(() => {
    const scrollToForm = () => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    };

    // Small delay to ensure the form has fully rendered
    const timeoutId = setTimeout(scrollToForm, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      // Use Farcaster username if available, otherwise use member email prefix or empty
      ipeUsername: farcasterProfile?.username?.replace(/[^a-z0-9]/g, "").toLowerCase()
        || memberData?.member?.email?.split('@')[0]?.replace(/[^a-z0-9]/g, "").toLowerCase()
        || "",
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

  // Submit application mutation (uses v2 endpoint with memberId)
  const submitApplicationMutation = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      const payload = {
        memberId,
        ...data,
        profileTags: selectedTags,
        walletAddress: address,
      };

      console.log("Submitting application with payload:", payload);

      try {
        const token = await getAccessToken();
        const response = await apiRequest("/api/v2/auth/application/submit", {
          method: "POST",
          body: JSON.stringify(payload),
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        console.log("Application submission response:", response);
        return response;
      } catch (error) {
        console.error("Application submission error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Application submitted successfully!",
        description: "Your application is now pending admin approval.",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      console.error("Application submission failed:", error);
      toast({
        title: "Failed to submit application",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ApplicationFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Username status:", usernameStatus);
    console.log("Selected tags:", selectedTags);
    console.log("Wallet address:", address);
    
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
        : prev.length < VALIDATION_LIMITS.MAX_PROFILE_TAGS
          ? [...prev, tag]
          : prev; // Don't add if already at max

      // Update form value
      form.setValue("profileTags", newTags);
      return newTags;
    });
  };

  const handleSocialMediaBlur = (platform: SocialPlatform, value: string) => {
    if (!value.trim()) {
      return;
    }

    const validation = validateSocialMediaUrl(value, platform);
    if (validation.isValid && validation.formattedUrl) {
      // Update form value with formatted URL
      form.setValue(platform, validation.formattedUrl);
    }
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
    <Card ref={formRef} className="max-w-2xl mx-auto">
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
                      Twitter/X
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="username or x.com/username"
                        onBlur={(e) => handleSocialMediaBlur("twitter", e.target.value)}
                      />
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
                      <Input
                        {...field}
                        placeholder="username or linkedin.com/in/username"
                        onBlur={(e) => handleSocialMediaBlur("linkedin", e.target.value)}
                      />
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
                      <Input
                        {...field}
                        placeholder="username or instagram.com/username"
                        onBlur={(e) => handleSocialMediaBlur("instagram", e.target.value)}
                      />
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
                Skills & Interests (max {VALIDATION_LIMITS.MAX_PROFILE_TAGS})
              </FormLabel>
              <p className="text-xs text-gray-500">Select tags that describe you</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {PROFILE_TAGS.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={tag}
                      checked={selectedTags.includes(tag)}
                      onCheckedChange={() => handleTagToggle(tag)}
                      disabled={selectedTags.length >= VALIDATION_LIMITS.MAX_PROFILE_TAGS && !selectedTags.includes(tag)}
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