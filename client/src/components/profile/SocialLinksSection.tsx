import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Edit3, 
  Save, 
  X, 
  Mail, 
  Twitter, 
  Linkedin, 
  Instagram,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface SocialLinksSectionProps {
  email?: string;
  emailVerified?: boolean;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
  isEditable?: boolean;
  onSave?: (data: { twitter?: string; linkedin?: string; instagram?: string }) => void;
  isLoading?: boolean;
  showEmailVerification?: boolean;
  EmailVerificationComponent?: React.ComponentType<any>;
  farcasterFid?: number;
}

export function SocialLinksSection({ 
  email, 
  emailVerified, 
  twitter, 
  linkedin, 
  instagram,
  isEditable = false,
  onSave,
  isLoading = false,
  showEmailVerification = false,
  EmailVerificationComponent,
  farcasterFid
}: SocialLinksSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [twitterValue, setTwitterValue] = useState(twitter || "");
  const [linkedinValue, setLinkedinValue] = useState(linkedin || "");
  const [instagramValue, setInstagramValue] = useState(instagram || "");

  const handleSave = () => {
    if (onSave) {
      onSave({
        twitter: twitterValue,
        linkedin: linkedinValue,
        instagram: instagramValue,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTwitterValue(twitter || "");
    setLinkedinValue(linkedin || "");
    setInstagramValue(instagram || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base md:text-lg">
            Social Links
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
            {/* Email Section with Verification */}
            {showEmailVerification && EmailVerificationComponent && (
              <div>
                <EmailVerificationComponent
                  farcasterFid={farcasterFid || 0}
                  currentEmail={email}
                  isVerified={emailVerified || false}
                  allowChange={true}
                />
              </div>
            )}

            {showEmailVerification && <Separator />}

            {/* Social Media Links */}
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="twitter"
                  className="flex items-center space-x-1"
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </Label>
                <Input
                  id="twitter"
                  value={twitterValue}
                  onChange={(e) => setTwitterValue(e.target.value)}
                  placeholder="@username"
                  className="mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="linkedin"
                  className="flex items-center space-x-1"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </Label>
                <Input
                  id="linkedin"
                  value={linkedinValue}
                  onChange={(e) => setLinkedinValue(e.target.value)}
                  placeholder="linkedin.com/in/username"
                  className="mt-1"
                />
              </div>

              <div>
                <Label
                  htmlFor="instagram"
                  className="flex items-center space-x-1"
                >
                  <Instagram className="h-4 w-4" />
                  <span>Instagram</span>
                </Label>
                <Input
                  id="instagram"
                  value={instagramValue}
                  onChange={(e) => setInstagramValue(e.target.value)}
                  placeholder="@username"
                  className="mt-1"
                />
              </div>
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
          <div className="space-y-3">
            {/* Email Display */}
            {showEmailVerification && (
              <>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {email || "No email provided"}
                  </span>
                  {emailVerified ? (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-yellow-100 text-yellow-800"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Social Links Display */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Twitter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {twitter || "Not provided"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Linkedin className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {linkedin || "Not provided"}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Instagram className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">
                  {instagram || "Not provided"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}