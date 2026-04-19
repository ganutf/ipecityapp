import { Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WalletList } from "./WalletList";

export function WalletStep() {
  const { member, memberId } = useAuth();

  if (!memberId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-slate-900" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Choose Your Wallet</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Your passport is tied to one wallet. Link a self-custody wallet you
          own, or use the app wallet we created for you.
        </p>
      </div>
      <WalletList
        memberId={memberId}
        passportWalletAddress={member?.walletAddress ?? null}
      />
    </div>
  );
}
