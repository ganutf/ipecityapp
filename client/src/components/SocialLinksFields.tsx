import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import { Control } from "react-hook-form";

interface SocialLinksFieldsProps {
  control: Control<any>;
  layout?: "grid" | "vertical";
}

export function SocialLinksFields({ control, layout = "vertical" }: SocialLinksFieldsProps) {
  const containerClass = layout === "grid" 
    ? "grid grid-cols-1 md:grid-cols-3 gap-4" 
    : "space-y-4";

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Social Links</div>
      <div className={containerClass}>
        <FormField
          control={control}
          name="twitter"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-500" />
                Twitter Handle
              </FormLabel>
              <FormControl>
                <Input placeholder="username (without @)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="linkedin"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-600" />
                LinkedIn Profile
              </FormLabel>
              <FormControl>
                <Input placeholder="https://linkedin.com/in/username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="instagram"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                Instagram Handle
              </FormLabel>
              <FormControl>
                <Input placeholder="username (without @)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}