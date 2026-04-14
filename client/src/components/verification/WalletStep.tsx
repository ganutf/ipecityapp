import { motion } from "framer-motion";
import { Wallet, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectWallet } from "@privy-io/react-auth";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { useAuth } from "@/contexts/AuthContext";

export function WalletStep() {
  const { member } = useAuth();
  const { connectWallet } = useConnectWallet();
  const { activeWallet, isExternalWallet, disconnectExternalWallet } = useActiveWallet();
  const address = activeWallet?.address || member?.walletAddress;
  const isConnected = !!activeWallet || !!member?.walletAddress;

  if (isConnected) {
    return (
      <div className="text-center space-y-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <CheckCircle className="h-14 w-14 text-lime-500 mx-auto" />
        </motion.div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Wallet Connected</h2>
          <p className="text-sm text-gray-500">
            {address?.slice(0, 6)}...{address?.slice(-4)}
            {isExternalWallet && (
              <span className="ml-1.5 text-lime-600 font-medium">external</span>
            )}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {isExternalWallet && disconnectExternalWallet && (
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnectExternalWallet}
              className="text-xs text-gray-400 hover:text-red-600"
            >
              Disconnect
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => connectWallet()}
            className="text-xs text-gray-400"
          >
            Change Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
        <Wallet className="h-8 w-8 text-slate-900" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-slate-900">Connect Your Wallet</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Link an Ethereum wallet to your account to continue verification.
        </p>
      </div>
      <Button
        onClick={() => connectWallet()}
        className="bg-slate-900 hover:bg-slate-800 text-white px-8"
      >
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    </div>
  );
}
