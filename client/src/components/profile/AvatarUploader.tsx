import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resizeImageToDataUrl } from "@/lib/avatar";

interface AvatarUploaderProps {
  currentUrl?: string | null;
  fallbackUrl: string;
  displayName?: string | null;
  size?: "sm" | "md" | "lg";
  onChange: (dataUrl: string | null) => Promise<void> | void;
  disabled?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarUploaderProps["size"]>, string> = {
  sm: "h-16 w-16",
  md: "h-20 w-20",
  lg: "h-24 w-24 md:h-28 md:w-28",
};

export function AvatarUploader({
  currentUrl,
  fallbackUrl,
  displayName,
  size = "md",
  onChange,
  disabled,
}: AvatarUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isBusy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  // Clear local preview once the server-confirmed value matches (or diverges).
  useEffect(() => {
    if (currentUrl !== undefined) setPreview(null);
  }, [currentUrl]);

  const imgSrc = preview || currentUrl || fallbackUrl;

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPreview(dataUrl);
      await onChange(dataUrl);
    } catch (err) {
      setPreview(null);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not process image.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      setPreview(null);
      await onChange(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`relative ${SIZE_CLASSES[size]} rounded-full overflow-hidden ring-2 ring-white shadow-sm bg-gray-100 flex-shrink-0`}>
        <img
          src={imgSrc}
          alt={displayName ? `${displayName} avatar` : "Avatar"}
          className="h-full w-full object-cover"
        />
        {isBusy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isBusy}
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="h-4 w-4 mr-2" />
          {currentUrl ? "Change photo" : "Upload photo"}
        </Button>
        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isBusy}
            onClick={handleClear}
            className="text-gray-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
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
      </div>
    </div>
  );
}
