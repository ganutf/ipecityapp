import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Edit3, Save, X } from "lucide-react";
import { PROFILE_TAGS } from "@/constants/profileTags";

interface ProfileTagsSectionProps {
  profileTags?: string[];
  isEditable?: boolean;
  onSave?: (tags: string[]) => void;
  isLoading?: boolean;
}

export function ProfileTagsSection({ 
  profileTags = [], 
  isEditable = false, 
  onSave, 
  isLoading = false 
}: ProfileTagsSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(profileTags);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = () => {
    if (onSave) {
      onSave(selectedTags);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setSelectedTags(profileTags);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">
            Profile Tags
          </CardTitle>
          {isEditable && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
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
                onClick={handleSave}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="flex-1 sm:flex-none"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profileTags && profileTags.length > 0 ? (
              profileTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))
            ) : (
              <p className="text-gray-500 text-sm">
                No tags selected yet.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}