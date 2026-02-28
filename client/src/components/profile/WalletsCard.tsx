import { useState } from "react";
import { useWallets, useLinkAccount } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authenticatedGet, authenticatedPost, authenticatedDelete } from "@/lib/api";
import {
  Wallet,
  Copy,
  Check,
  Plus,
  Globe,
} from "lucide-react";

interface WalletsCardProps {
  memberId: number;
  passportWalletAddress?: string;
  ipePassport?: string;
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
  icon: "passport" | "app" | "external";
  tags: string[];
  isActive: boolean;
  canRemove: boolean;
}

export function WalletsCard({ memberId, passportWalletAddress, ipePassport }: WalletsCardProps) {
  const { wallets } = useWallets();
  const { linkWallet } = useLinkAccount();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const externalWallets = wallets.filter(w => w.walletClientType !== 'privy' && w.linked);
  const activeWallet = externalWallets[0] ?? embeddedWallet;

  // Fetch wallets from our DB
  const { data: dbWallets = [] } = useQuery<MemberWallet[]>({
    queryKey: ['member-wallets', memberId],
    queryFn: async () => {
      const res = await authenticatedGet(`/api/v2/members/${memberId}/wallets`);
      return res.wallets;
    },
    enabled: memberId > 0,
  });

  const dbAddressSet = new Set(dbWallets.map(w => w.walletAddress.toLowerCase()));

  const formatWalletType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Build deduplicated rows by address
  const rowMap = new Map<string, WalletRow>();

  // Passport wallet (from member record)
  if (passportWalletAddress && ipePassport) {
    const addr = passportWalletAddress.toLowerCase();
    rowMap.set(addr, {
      address: passportWalletAddress,
      icon: "passport",
      tags: ["Passport"],
      isActive: activeWallet?.address.toLowerCase() === addr,
      canRemove: false,
    });
  }

  // DB-stored wallets
  for (const dbWallet of dbWallets) {
    const addr = dbWallet.walletAddress.toLowerCase();
    const existing = rowMap.get(addr);
    const isPassport = passportWalletAddress?.toLowerCase() === addr;

    if (existing) {
      // Add label/type info if available
      if (dbWallet.label && !existing.tags.includes(dbWallet.label)) {
        existing.tags.push(dbWallet.label);
      }
    } else {
      rowMap.set(addr, {
        address: dbWallet.walletAddress,
        icon: dbWallet.walletType === 'privy_embedded' ? "app" : "external",
        tags: dbWallet.label ? [dbWallet.label] : [dbWallet.walletType === 'privy_embedded' ? "App Wallet" : "External"],
        isActive: activeWallet?.address.toLowerCase() === addr,
        canRemove: !isPassport,
      });
    }
  }

  // Embedded (app) wallet from Privy (always show even if not in DB)
  if (embeddedWallet) {
    const addr = embeddedWallet.address.toLowerCase();
    const existing = rowMap.get(addr);
    if (existing) {
      if (!existing.tags.includes("App Wallet")) {
        existing.tags.push("App Wallet");
      }
    } else {
      rowMap.set(addr, {
        address: embeddedWallet.address,
        icon: "app",
        tags: ["App Wallet"],
        isActive: activeWallet?.address === embeddedWallet.address,
        canRemove: false,
      });
    }
  }

  const rows = Array.from(rowMap.values());

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleConnect = () => {
    linkWallet();
  };

  // Sync Privy wallets to DB after they change
  const syncWalletToDb = async (address: string, walletClientType: string) => {
    if (dbAddressSet.has(address.toLowerCase())) return;

    try {
      await authenticatedPost(`/api/v2/members/${memberId}/wallets`, {
        walletAddress: address,
        walletType: walletClientType === 'privy' ? 'privy_embedded' : 'external',
        label: walletClientType !== 'privy' ? formatWalletType(walletClientType) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['member-wallets', memberId] });
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('409') || message.includes('already linked')) {
        // Unlink from Privy to prevent showing another user's balance
        const privyWallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        if (privyWallet) {
          try {
            await privyWallet.unlink();
          } catch {
            privyWallet.disconnect();
          }
        }
        toast({
          title: "Wallet unavailable",
          description: "This wallet is already linked to another account. It has been disconnected.",
          variant: "destructive",
        });
      }
    }
  };

  // Sync any Privy external wallets not yet in DB
  // This handles the case where linkWallet() succeeded but our POST hasn't been called yet
  for (const wallet of externalWallets) {
    if (!dbAddressSet.has(wallet.address.toLowerCase())) {
      syncWalletToDb(wallet.address, wallet.walletClientType);
      break; // One at a time to avoid race conditions
    }
  }

  const handleRemove = async (row: WalletRow) => {
    try {
      await authenticatedDelete(`/api/v2/members/${memberId}/wallets/${row.address}`);
      queryClient.invalidateQueries({ queryKey: ['member-wallets', memberId] });

      // Also unlink from Privy
      const privyWallet = wallets.find(w => w.address.toLowerCase() === row.address.toLowerCase());
      if (privyWallet) {
        try {
          await privyWallet.unlink();
        } catch {
          privyWallet.disconnect();
        }
      }
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('passport')) {
        toast({
          title: "Cannot remove",
          description: "This is your passport wallet. Change your passport wallet first.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to remove wallet.",
          variant: "destructive",
        });
      }
    }
  };

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Wallet className="h-5 w-5" />
            <span>Wallets</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConnect}
            className="h-7 px-2 text-xs text-gray-500 hover:text-sky-600"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Connect
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-gray-100">
          {rows.map((row) => (
            <div key={row.address} className="flex items-center justify-between py-2.5">
              <div className="flex items-center space-x-3 min-w-0">
                {row.tags.includes("Passport") ? (
                  <Globe className="h-4 w-4 text-lime-600 flex-shrink-0" />
                ) : (
                  <Wallet className={`h-4 w-4 flex-shrink-0 ${row.icon === "external" ? "text-sky-500" : "text-gray-400"}`} />
                )}
                <button
                  onClick={() => copyAddress(row.address)}
                  className={`text-sm font-mono font-medium hover:opacity-80 transition-opacity flex items-center space-x-1 ${
                    row.tags.includes("Passport") ? "text-lime-600" : "text-sky-600"
                  }`}
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
                {row.isActive && (
                  <Badge variant="secondary" className="bg-sky-100 text-sky-800 text-xs px-1.5 py-0">Active</Badge>
                )}
                {row.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className={`text-xs px-1.5 py-0 ${
                      tag === "Passport" ? "bg-lime-100 text-lime-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tag}
                  </Badge>
                ))}
                {row.canRemove && (
                  <button
                    onClick={() => handleRemove(row)}
                    className="text-xs text-gray-400 hover:text-red-600 transition-colors ml-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
