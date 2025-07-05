import { useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { Control, useFormContext } from "react-hook-form";

const PROFILE_TAGS = [
  'tech founder', 'student', 'developer', 'lawyer', 'scientist',
  'public servant', 'designer', 'creator', 'technologist', 'researcher'
];

interface ProfileTagsFieldProps {
  control: Control<any>;
  variant?: "checkbox" | "input";
  maxTags?: number;
  onTagsChange?: (tags: string[]) => void;
  currentTags?: string[];
}

export function ProfileTagsField({ 
  control, 
  variant = "checkbox", 
  maxTags = 5,
  onTagsChange,
  currentTags = []
}: ProfileTagsFieldProps) {
  const [tagInput, setTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>(currentTags);

  const addTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !customTags.includes(trimmedTag) && customTags.length < maxTags) {
      const newTags = [...customTags, trimmedTag];
      setCustomTags(newTags);
      setTagInput("");
      onTagsChange?.(newTags);
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = customTags.filter(tag => tag !== tagToRemove);
    setCustomTags(newTags);
    onTagsChange?.(newTags);
  };

  const CheckboxTagsField = () => {
    const form = useFormContext();
    
    const handleTagToggle = (tag: string) => {
      const currentTags = form.getValues("profileTags") || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t: string) => t !== tag)
        : [...currentTags, tag];
      form.setValue("profileTags", newTags);
    };

    return (
      <FormField
        control={form.control}
        name="profileTags"
        render={() => (
          <FormItem>
            <FormLabel>Profile Tags</FormLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PROFILE_TAGS.map((tag) => (
                <div key={tag} className="flex items-center space-x-2">
                  <Checkbox
                    id={tag}
                    checked={(form.watch("profileTags") || []).includes(tag)}
                    onCheckedChange={() => handleTagToggle(tag)}
                  />
                  <Label htmlFor={tag} className="text-sm capitalize cursor-pointer">
                    {tag}
                  </Label>
                </div>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  if (variant === "input") {
    return (
      <div className="space-y-3">
        <FormLabel className="flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Skills & Interests {maxTags && `(max ${maxTags})`}
        </FormLabel>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add a skill or interest..."
            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            disabled={customTags.length >= maxTags}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addTag}
            disabled={!tagInput.trim() || customTags.length >= maxTags}
          >
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {customTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeTag(tag)}
            >
              {tag} ✕
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return <CheckboxTagsField />;
}