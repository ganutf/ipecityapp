import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resizeImageToDataUrl } from "@/lib/avatar";
import { projectImageGradient } from "./projectVisuals";

interface ProjectImageUploaderProps {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  fallbackSeed?: string | number | null;
}

export function ProjectImageUploader({
  value,
  onChange,
  disabled,
  fallbackSeed,
}: ProjectImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isBusy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, {
        maxSide: 512,
        maxBytes: 380_000,
        shape: "square",
      });
      onChange(dataUrl);
    } catch (err) {
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

  const gradient = projectImageGradient(fallbackSeed ?? value ?? "project");

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
      <div className="relative h-32 w-32 sm:h-40 sm:w-40 rounded-lg overflow-hidden ring-1 ring-gray-200 shadow-sm bg-gray-100 flex-shrink-0">
        {value ? (
          <img src={value} alt="Project preview" className="h-full w-full object-cover" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <ImageIcon className="h-10 w-10 text-white/70" />
          </div>
        )}
        {isBusy && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
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
          {value ? "Change image" : "Upload image"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isBusy}
            onClick={() => onChange(null)}
            className="text-gray-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
        <p className="text-xs text-gray-500 max-w-xs">
          Square image. PNG, JPEG, or WebP. Optional — a colorful fallback is used if none is set.
        </p>
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
