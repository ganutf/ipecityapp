import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, Save, X } from "lucide-react";

interface AboutSectionProps {
  bio?: string;
  isEditable?: boolean;
  onSave?: (bio: string) => void;
  isLoading?: boolean;
}

export function AboutSection({ bio, isEditable = false, onSave, isLoading = false }: AboutSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [bioValue, setBioValue] = useState(bio || "");

  const handleSave = () => {
    if (onSave) {
      onSave(bioValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setBioValue(bio || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">About</CardTitle>
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
          <div className="space-y-3">
            <Textarea
              value={bioValue}
              onChange={(e) => setBioValue(e.target.value)}
              placeholder="Tell us about yourself..."
              className="min-h-[100px]"
            />
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
          <p className="text-gray-700">
            {bio || "No bio provided yet."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}