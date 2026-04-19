import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { defaultAvatarUrl } from "@/lib/avatar";

interface ProfileStepProps {
  onComplete: () => void;
}

export function ProfileStep({ onComplete }: ProfileStepProps) {
  const { member, memberId, getAccessToken, refreshMember } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setDisplayName(member.displayName || member.ipeUsername || member.email?.split("@")[0] || "");
      setAvatarUrl(member.profileImageUrl ?? null);
    }
  }, [member]);

  const saveMutation = useMutation({
    mutationFn: async (data: { displayName?: string; profileImageUrl?: string | null }) => {
      const token = await getAccessToken();
      return apiRequest(`/api/v2/members/${memberId}/profile`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    },
  });

  const handleAvatar = async (dataUrl: string | null) => {
    setAvatarUrl(dataUrl);
    await saveMutation.mutateAsync({ profileImageUrl: dataUrl });
    refreshMember();
  };

  const handleContinue = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast({ title: "Display name required", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({ displayName: trimmed });
    refreshMember();
    onComplete();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
          <UserCircle2 className="h-8 w-8 text-slate-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Your profile</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Pick a display name and photo so the community can recognize you.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <AvatarUploader
          currentUrl={avatarUrl}
          fallbackUrl={defaultAvatarUrl(memberId)}
          displayName={displayName}
          size="lg"
          onChange={handleAvatar}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName" className="text-sm text-gray-700">
          Display name
        </Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Jean"
          maxLength={100}
          autoFocus
        />
      </div>

      <Button
        onClick={handleContinue}
        disabled={saveMutation.isPending || !displayName.trim()}
        className="w-full"
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
          </>
        ) : (
          <>
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
