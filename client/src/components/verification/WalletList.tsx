import { useRef, useState } from "react";
import { useWallets, useLinkAccount } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Wallet, Plus, Globe, Copy, Check } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  authenticatedGet,
  authenticatedPost,
  authenticatedPatch,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface WalletListProps {
  memberId: number;
  passportWalletAddress: string | null;
  onContinue?: () => void;
}

interface MemberWallet {
  id: number;
  memberId: number;
  walletAddress: string;
  walletType: string;
  label: string | null;
  linkedAt: string;
}

interface WalletRow {
  address: string;
  type: "embedded" | "external";
  label?: string;
  isPassport: boolean;
}

export function WalletList({
  memberId,
  passportWalletAddress,
  onContinue,
}: WalletListProps) {
  const { wallets } = useWallets();
  const { toast } = useToast();
  const { refreshMember } = useAuth();
  const queryClient = useQueryClient();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const memberIdRef = useRef(memberId);
  memberIdRef.current = memberId;

  const { linkWallet } = useLinkAccount({
    onSuccess: async ({ linkedAccount }) => {
      if (linkedAccount.type !== "wallet") return;
      const address = linkedAccount.address;
      const isEmbedded = linkedAccount.walletClientType === "privy";
      try {
        await authenticatedPost(`/api/v2/members/${memberIdRef.current}/wallets`, {
          walletAddress: address,
          walletType: isEmbedded ? "privy_embedded" : "external",
          label: !isEmbedded
            ? formatWalletType(linkedAccount.walletClientType ?? "external")
            : undefined,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.members.wallets(memberIdRef.current),
        });
        // Default the passport selection to the wallet the user just linked.
        setSelectedAddress(address.toLowerCase());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes("409") ||
          message.toLowerCase().includes("already linked")
        ) {
          const privyWallet = wallets.find(
            (w) => w.address.toLowerCase() === address.toLowerCase()
          );
          if (privyWallet) {
            try {
              await privyWallet.unlink();
            } catch {
              privyWallet.disconnect();
            }
          }
          toast({
            title: "Wallet unavailable",
            description: "This wallet is already linked to another account.",
            variant: "destructive",
          });
        }
      }
    },
  });

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy") ?? null;
  const externalWallets = wallets.filter(
    (w) => w.walletClientType !== "privy" && w.linked
  );

  const { data: dbWallets = [] } = useQuery<MemberWallet[]>({
    queryKey: queryKeys.members.wallets(memberId),
    queryFn: async () => {
      const res = await authenticatedGet(`/api/v2/members/${memberId}/wallets`);
      return res.wallets;
    },
    enabled: memberId > 0,
  });

  const dbAddressSet = new Set(dbWallets.map((w) => w.walletAddress.toLowerCase()));

  const rowMap = new Map<string, WalletRow>();
  const passportLower = passportWalletAddress?.toLowerCase() ?? null;

  for (const dbWallet of dbWallets) {
    const addr = dbWallet.walletAddress.toLowerCase();
    rowMap.set(addr, {
      address: dbWallet.walletAddress,
      type: dbWallet.walletType === "privy_embedded" ? "embedded" : "external",
      label: dbWallet.label ?? undefined,
      isPassport: passportLower === addr,
    });
  }

  if (embeddedWallet) {
    const addr = embeddedWallet.address.toLowerCase();
    if (!rowMap.has(addr)) {
      rowMap.set(addr, {
        address: embeddedWallet.address,
        type: "embedded",
        isPassport: passportLower === addr,
      });
    }
  }

  for (const wallet of externalWallets) {
    const addr = wallet.address.toLowerCase();
    if (!rowMap.has(addr)) {
      rowMap.set(addr, {
        address: wallet.address,
        type: "external",
        label: formatWalletType(wallet.walletClientType),
        isPassport: passportLower === addr,
      });
    }
  }

  const rows = Array.from(rowMap.values());
  const hasMultiple = rows.length > 1;

  // Sync any Privy external wallets not yet in our DB so they're visible in
  // the list. Does NOT promote to passport — selection is explicit via the
  // radio + Continue flow.
  for (const wallet of externalWallets) {
    if (!dbAddressSet.has(wallet.address.toLowerCase())) {
      syncWalletToDb(wallet.address, wallet.walletClientType);
      break;
    }
  }

  async function syncWalletToDb(address: string, walletClientType: string) {
    try {
      await authenticatedPost(`/api/v2/members/${memberId}/wallets`, {
        walletAddress: address,
        walletType: walletClientType === "privy" ? "privy_embedded" : "external",
        label:
          walletClientType !== "privy" ? formatWalletType(walletClientType) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.members.wallets(memberId) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("409") || message.toLowerCase().includes("already linked")) {
        const privyWallet = wallets.find(
          (w) => w.address.toLowerCase() === address.toLowerCase()
        );
        if (privyWallet) {
          try {
            await privyWallet.unlink();
          } catch {
            privyWallet.disconnect();
          }
        }
        toast({
          title: "Wallet unavailable",
          description: "This wallet is already linked to another account.",
          variant: "destructive",
        });
      }
    }
  }

  // Default passport selection: current passport, else the most recently-
  // added external wallet (users typically prefer self-custody), else the
  // only wallet available.
  const defaultSelection =
    passportLower ??
    rows.find((r) => r.type === "external")?.address.toLowerCase() ??
    rows[0]?.address.toLowerCase() ??
    null;
  const activeSelection = selectedAddress ?? defaultSelection;

  async function handleContinue() {
    if (isSaving || rows.length === 0) return;
    const target = activeSelection;
    if (!target) return;

    if (target !== passportLower) {
      setIsSaving(true);
      try {
        await authenticatedPatch(`/api/v2/members/${memberId}/wallet`, {
          walletAddress: target,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.members.wallets(memberId) });
        await refreshMember();
      } catch (err) {
        toast({
          title: "Could not set passport wallet",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    onContinue?.();
  }

  function copyAddress(address: string) {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  }

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="space-y-5">
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-6 px-4 text-center text-sm text-gray-500">
            No wallets linked yet.
          </div>
        ) : (
          rows.map((row) => {
            const addrLower = row.address.toLowerCase();
            const isSelected = hasMultiple && activeSelection === addrLower;
            const clickable = hasMultiple;
            return (
              <motion.div
                key={row.address}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={clickable ? () => setSelectedAddress(addrLower) : undefined}
                className={cn(
                  "flex items-center justify-between py-3 px-4 transition-colors",
                  clickable && "cursor-pointer hover:bg-gray-50",
                  isSelected && "bg-lime-50"
                )}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {hasMultiple && (
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        isSelected
                          ? "border-lime-500 bg-lime-500"
                          : "border-gray-300 bg-white"
                      )}
                      aria-hidden="true"
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  )}
                  {row.isPassport ? (
                    <Globe className="h-4 w-4 text-lime-600 flex-shrink-0" />
                  ) : (
                    <Wallet
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        row.type === "external" ? "text-sky-500" : "text-gray-400"
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyAddress(row.address);
                    }}
                    className={cn(
                      "text-sm font-mono font-medium hover:opacity-80 transition-opacity flex items-center space-x-1",
                      row.isPassport ? "text-lime-600" : "text-sky-600"
                    )}
                    title="Click to copy full address"
                  >
                    <span>{truncate(row.address)}</span>
                    {copiedAddress === row.address ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  {row.isPassport && (
                    <Badge
                      variant="secondary"
                      className="bg-lime-100 text-lime-800 text-xs px-1.5 py-0"
                    >
                      Passport
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0"
                  >
                    {row.type === "embedded" ? "App Wallet" : row.label ?? "External"}
                  </Badge>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => linkWallet()}
          variant="outline"
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Link self-custody wallet
        </Button>
        <Button
          onClick={handleContinue}
          disabled={isSaving || !activeSelection}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isSaving ? "Saving..." : "Continue"}
        </Button>
        {hasMultiple && (
          <p className="text-xs text-gray-500 text-center">
            Select the wallet to use as your passport, then continue.
          </p>
        )}
      </div>
    </div>
  );
}

function formatWalletType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
