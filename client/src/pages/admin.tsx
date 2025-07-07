import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, Member } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Save, X, Eye } from "lucide-react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { useAddMAppPermission } from "@justaname.id/react";

export default function AdminPage() {
  /* ───── auth & utils ───── */
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ───── wallet ───── */
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  /* hook that will add TRANSFER permission later */
  const { addMAppPermission } = useAddMAppPermission({
    chainId: 1,
    mApp: address ?? "0x7582Cde92962A71143185A6f8F397F52cC86ECFf",
  });

  /* ───── local state ───── */
  const [newPulse, setNewPulse] = useState({
    farcasterUrl: "",
    date: "",
    description: "",
  });
  const [editingPulse, setEditingPulse] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    farcasterUrl: "",
    date: "",
    description: "",
  });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  /* ───── admin check ───── */
  const isAdmin = profile?.fid === 1109894;

  /* ───── queries ───── */
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && isAdmin,
  });
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/members"],
    enabled: isAuthenticated && isAdmin,
  });
  const { data: pendingRenewalsData, isLoading: renewalsLoading } = useQuery({
    queryKey: ["/api/admin/pending-wallet-renewals"],
    enabled: isAuthenticated && isAdmin,
  });

  /* ───── mutations ───── */
  const createPulseMutation = useMutation({
    /* … unchanged … */
  });

  const updatePulseMutation = useMutation({
    /* … unchanged … */
  });

  /* APPROVE MEMBER ➊ reserve + ➋ add TRANSFER permission */
  const approveMemberMutation = useMutation({
    mutationFn: async (member: {
      farcasterFid: number;
      ipeUsername: string;
      userWalletAddress?: string;
    }) => {
      const r = await fetch("/api/admin/approve-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(member),
      });
      if (!r.ok) throw new Error((await r.json()).message ?? "reserve failed");
      return member;                // we need username later
    },

    /** 👇 made async so we can await inside */
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });

      /* immediately grant TRANSFER to admin wallet */
      try {
        if (!address) throw new Error("Admin wallet not connected");

        await addMAppPermission({
          ens: `${variables.ipeUsername}.ipecity.eth`,
          permission: "TRANSFER",
          applicationKey: address,
        });

        toast({
          title: "Success",
          description:
            "Member approved, sub-domain reserved and TRANSFER permission granted.",
        });
      } catch (e: any) {
        toast({
          title: "Warning",
          description:
            e?.message ??
            "Reserved sub-domain, but failed to add TRANSFER permission.",
          variant: "destructive",
        });
      }
    },

    onError: (err: any) =>
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      }),
  });

  const denyMemberMutation = useMutation({
    /* … unchanged … */
  });

  const approveWalletRenewalMutation = useMutation({
    /* … unchanged … */
  });

  /* ───── loading / access guard ───── */
  if (isLoading)
    return (
      /* … unchanged … */
    );
  if (!isAuthenticated || !isAdmin)
    return (
      /* … unchanged … */
    );

  /* ───── helper fns ───── */
  const handleEditStart = (pulse: Pulse) => {
    setEditingPulse(pulse.id);
    setEditData({
      farcasterUrl: pulse.farcasterUrl,
      date: pulse.date,
      description: pulse.description,
    });
  };
  const isFuturePulse = (pulse: Pulse) =>
    pulse.date > new Date().toISOString().split("T")[0];

  /* ─────  JSX  (omitted for brevity – unchanged from your version) ───── */
  return (
    /* … the rest of your JSX stays exactly the same … */
  );
}
