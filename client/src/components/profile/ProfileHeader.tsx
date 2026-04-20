import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  User,
  Globe,
  CheckCircle,
  Camera,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { getMemberTypeInfo } from "@/lib/memberTypeConfig";
import { resizeImageToDataUrl } from "@/lib/avatar";
import { useToast } from "@/hooks/use-toast";

interface ProfileHeaderProps {
  displayName?: string;
  username?: string;
  fid?: number;
  memberId?: number;
  memberType?: string;
  ipePassport?: string;
  passportVerified?: boolean;
  pfpUrl?: string;
  createdAt?: string;
  onAvatarChange?: (dataUrl: string | null) => Promise<void> | void;
  onDisplayNameChange?: (name: string) => Promise<void> | void;
}


export function ProfileHeader({
  displayName,
  username,
  memberId,
  memberType = 'pending',
  ipePassport,
  passportVerified,
  pfpUrl,
  createdAt,
  onAvatarChange,
  onDisplayNameChange,
}: ProfileHeaderProps) {
  const memberTypeInfo = memberType ? getMemberTypeInfo(memberType) : null;
  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName ?? "");
  const [isSavingName, setSavingName] = useState(false);

  useEffect(() => {
    if (pfpUrl !== undefined) setPreview(null);
  }, [pfpUrl]);

  useEffect(() => {
    if (!editingName) setNameDraft(displayName ?? "");
  }, [displayName, editingName]);

  const handleFile = async (file: File) => {
    if (!onAvatarChange) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please pick an image.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPreview(dataUrl);
      await onAvatarChange(dataUrl);
    } catch (err) {
      setPreview(null);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not process image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveName = async () => {
    if (!onDisplayNameChange) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await onDisplayNameChange(trimmed);
      setEditingName(false);
    } catch (err) {
      toast({
        title: "Couldn't save name",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingName(false);
    }
  };

  // Format join date
  const memberSince = createdAt ? new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  }) : null;

  const imgSrc = preview || pfpUrl;

  return (
    <div className="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
      <div className="flex items-center space-x-3 md:space-x-4">
        <div className="relative group flex-shrink-0">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={`${displayName || username || 'User'} profile picture`}
              className="h-12 w-12 md:h-16 md:w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              {displayName || username ? (
                <span className="text-white text-lg md:text-2xl font-semibold">
                  {(displayName || username || '?')[0].toUpperCase()}
                </span>
              ) : (
                <User className="h-6 w-6 md:h-8 md:w-8 text-white" />
              )}
            </div>
          )}

          {onAvatarChange && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                aria-label="Change profile photo"
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 hover:bg-black/40 transition-colors text-white opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editingName && onDisplayNameChange ? (
            <div className="flex items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setNameDraft(displayName ?? "");
                    setEditingName(false);
                  }
                }}
                className="h-9 text-xl md:text-2xl font-bold"
              />
              <Button size="sm" onClick={saveName} disabled={isSavingName} className="h-9 px-2">
                {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-2"
                onClick={() => {
                  setNameDraft(displayName ?? "");
                  setEditingName(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {displayName || username}
              </h1>
              {onDisplayNameChange && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-gray-400 hover:text-slate-900"
                  onClick={() => setEditingName(true)}
                  aria-label="Edit display name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <p className="text-xs md:text-sm text-gray-500">
            Member ID: {memberId}{memberSince && <span className="text-gray-400"> • Member since {memberSince}</span>}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            {memberTypeInfo && (
              <div className="group relative">
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${memberTypeInfo.color} cursor-pointer`}>
                  <memberTypeInfo.icon className="h-4 w-4" />
                  <span>{memberTypeInfo.label}</span>
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-medium">{memberTypeInfo.label}</div>
                  <div className="text-xs text-gray-300 mt-1">{memberTypeInfo.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-2 lg:flex-shrink-0">
        {/* Passport Info Box */}
        {ipePassport && passportVerified && (
          <div className="inline-block px-3 py-3 bg-lime-50 border border-lime-200 border-l-4 border-l-lime-500 rounded-lg">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-lime-600" />
              <span className="text-sm font-medium text-gray-700">Ipê Passport</span>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>
            <div className="mt-1">
              <p className="text-lime-600 font-semibold text-base">
                {ipePassport}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
