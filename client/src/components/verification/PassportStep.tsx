import { Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";

interface PassportStepProps {
  onComplete: () => void;
}

export function PassportStep({ onComplete }: PassportStepProps) {
  const { member, memberId, refreshMember } = useAuth();
  const { activeWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Globe className="h-8 w-8 text-slate-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ipe Passport</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Verify your ENS subdomain or apply for membership.
        </p>
      </div>
      <PassportVerificationSection
        memberId={memberId || 0}
        memberData={{
          isMember: true,
          status: member?.status,
          member: member
            ? {
                id: member.id,
                email: member.email,
                status: member.status,
                ipeUsername: member.ipeUsername,
                walletAddress: member.walletAddress || address,
                memberType: member.memberType,
                ipePassport: member.ipePassport,
              }
            : undefined,
        }}
        currentPassport={member?.ipePassport || undefined}
        isVerified={member?.status === "active_member"}
        context="id-verification"
        variant="wizard"
        onVerificationComplete={() => {
          refreshMember();
          onComplete();
        }}
      />
    </div>
  );
}
