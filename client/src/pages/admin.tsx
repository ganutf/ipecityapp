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
  /* ─────────────────── utils & auth ─────────────────── */
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ─────────────────── wallet  ─────────────────── */
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  /* hook for TRANSFER permission */
  const { addMAppPermission } = useAddMAppPermission({
    chainId: 1,
    mApp: address ?? "0x0000000000000000000000000000000000000000",
  });

  /* ─────────────────── local state ─────────────────── */
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

  const isAdmin = profile?.fid === 1109894;

  /* ─────────────────── queries ─────────────────── */
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

  /* ─────────────────── mutations ─────────────────── */
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: {
      farcasterUrl: string;
      date: string;
      description: string;
    }) => {
      const res = await fetch("/api/pulses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pulse),
      });
      if (!res.ok) throw new Error("Failed to create pulse");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setNewPulse({ farcasterUrl: "", date: "", description: "" });
      toast({ title: "Success", description: "Pulse created successfully" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updatePulseMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { farcasterUrl: string; date: string; description: string };
    }) => {
      const res = await fetch(`/api/pulses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update pulse");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setEditingPulse(null);
      toast({ title: "Success", description: "Pulse updated successfully" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /* reserve + add TRANSFER */
  const approveMemberMutation = useMutation({
    mutationFn: async (member: {
      farcasterFid: number;
      ipeUsername: string;
      userWalletAddress?: string;
    }) => {
      const res = await fetch("/api/admin/approve-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(member),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to approve member");
      }
      return member; // keep username for onSuccess
    },

    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });

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

    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const denyMemberMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      const res = await fetch("/api/admin/deny-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterFid }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to deny member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Member denied successfully" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  /* ─────────────────── WALLET-RENEWAL mutation ─────────────────── */
  const approveWalletRenewalMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      if (!isConnected || !address) {
        throw new Error("Admin wallet must be connected to approve transfers");
      }

      /* 1️⃣  fetch SIWE challenge */
      const { challenge } = await fetch("/api/justaname/siwe-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminAddress: address,
          origin: window.location.origin,
        }),
      }).then((r) => r.json());

      /* 2️⃣  sign challenge with admin wallet */
      let signature: `0x${string}`;
      try {
        signature = await signMessageAsync({ message: challenge });
      } catch (err: any) {
        if (err.name === "UserRejectedRequestError") {
          throw new Error(
            "Signature rejected. Admin signature required to approve transfer.",
          );
        }
        throw err;
      }

      /* 3️⃣  call your Express route to finish the update */
      const res = await fetch("/api/admin/approve-wallet-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farcasterFid,
          siweSignature: signature,
          siweMessage: challenge,
          adminAddress: address,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to approve wallet renewal");
      }

      return res.json();
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/pending-wallet-renewals"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({
        title: "Success",
        description: "Wallet renewal approved successfully",
      });
    },

    onError: (error: Error) =>
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      }),
  });

  /* ─────────────────── helper ─────────────────── */
  const isFuturePulse = (pulse: Pulse) =>
    pulse.date > new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* ─────────── Header ─────────── */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Manage pulses and community members
        </p>
      </div>

      {/* ─────────── Wallet connection banner ─────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Admin Wallet
            </h3>
            <p className="text-blue-700 text-sm">
              {isConnected
                ? `Connected: ${address?.slice(0, 6)}…${address?.slice(-4)}`
                : "Connect wallet to create sub-domains for passport claims"}
            </p>
          </div>

          {/* RainbowKit custom button */}
          <ConnectButton.Custom>
            {({ openConnectModal, openAccountModal, mounted, account }) => {
              if (!mounted) return null;
              if (!account) {
                return (
                  <Button
                    onClick={openConnectModal}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Connect Wallet
                  </Button>
                );
              }
              return (
                <Button
                  onClick={openAccountModal}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Disconnect
                </Button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>

      {/* ─────────── Create Pulse ─────────── */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Pulse</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPulseMutation.mutate(newPulse);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Farcaster URL
            </label>
            <Input
              value={newPulse.farcasterUrl}
              onChange={(e) =>
                setNewPulse({ ...newPulse, farcasterUrl: e.target.value })
              }
              placeholder="https://warpcast.com/username/0x123…"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <Input
              type="date"
              value={newPulse.date}
              onChange={(e) =>
                setNewPulse({ ...newPulse, date: e.target.value })
              }
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              value={newPulse.description}
              onChange={(e) =>
                setNewPulse({ ...newPulse, description: e.target.value })
              }
              placeholder="Describe the pulse activity…"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={createPulseMutation.isPending}
            className="w-full"
          >
            {createPulseMutation.isPending ? "Creating…" : "Create Pulse"}
          </Button>
        </form>
      </div>

      {/* ─────────── Pulses list ─────────── */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Manage Pulses</h2>
        </div>
        <div className="p-6">
          {pulsesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              <p className="text-gray-600 mt-4">Loading pulses…</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(pulsesData as any)?.pulses?.map((pulse: Pulse) => {
                const isEditing = editingPulse === pulse.id;
                const canEdit = isFuturePulse(pulse);
                const today = new Date().toISOString().split("T")[0];
                const isPast = pulse.date < today;
                const isToday = pulse.date === today;

                return (
                  <div
                    key={pulse.id}
                    className={`border rounded-lg p-4 ${
                      isToday
                        ? "border-green-300 bg-green-50"
                        : isPast
                          ? "border-gray-200 bg-gray-50"
                          : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    {isEditing ? (
                      /* ─ Edit form ─ */
                      <div className="space-y-3">
                        <Input
                          value={editData.farcasterUrl}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              farcasterUrl: e.target.value,
                            })
                          }
                          placeholder="Farcaster URL"
                        />
                        <Input
                          type="date"
                          value={editData.date}
                          onChange={(e) =>
                            setEditData({ ...editData, date: e.target.value })
                          }
                        />
                        <Textarea
                          value={editData.description}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updatePulseMutation.mutate({
                                id: pulse.id,
                                data: editData,
                              })
                            }
                            disabled={updatePulseMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPulse(null)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ─ Display card ─ */
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold">{pulse.date}</h3>
                          <p className="text-gray-600 mb-2">
                            {pulse.description}
                          </p>
                          <p className="text-sm text-blue-600 break-all">
                            {pulse.farcasterUrl}
                          </p>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditStart(pulse)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─────────── Pending wallet-renewals ─────────── */}
      {pendingRenewalsData?.pendingRenewals?.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Pending Wallet Renewals</h2>
          </div>
          <div className="p-6">
            {renewalsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
                <p className="text-gray-600 mt-4">Loading pending renewals…</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRenewalsData.pendingRenewals.map((member: any) => (
                  <div
                    key={member.farcasterFid}
                    className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="font-medium">
                          FID {member.farcasterFid} — Wallet Update Request
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>
                            Current wallet: {member.walletAddress?.slice(0, 6)}…
                            {member.walletAddress?.slice(-4)}
                          </div>
                          <div>
                            Requested wallet:{" "}
                            {member.newWalletAddress?.slice(0, 6)}…
                            {member.newWalletAddress?.slice(-4)}
                          </div>
                          <div>Passport: {member.ipePassport}</div>
                        </div>
                      </div>
                      <Button
                        onClick={() =>
                          approveWalletRenewalMutation.mutate(
                            member.farcasterFid,
                          )
                        }
                        disabled={
                          approveWalletRenewalMutation.isPending || !isConnected
                        }
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                        title={
                          !isConnected
                            ? "Connect admin wallet to approve transfer"
                            : ""
                        }
                      >
                        {approveWalletRenewalMutation.isPending
                          ? "Signing & Approving…"
                          : !isConnected
                            ? "Connect Wallet to Approve"
                            : "Approve Wallet Change"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────── Members table ─────────── */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Community Members</h2>
        </div>
        <div className="p-6">
          {membersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
              <p className="text-gray-600 mt-4">Loading members…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                {/* ─ table head ─ */}
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passport Claim
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* ─ table body ─ */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {(membersData as any)?.members?.map((member: Member) => {
                    const memberStatus = (member as any).status || "unknown";
                    const claimSubdomain = (member as any).ipeUsername;
                    const hasPendingApplication =
                      (memberStatus === "pending_application_review" ||
                        memberStatus === "pending_application") &&
                      claimSubdomain;

                    return (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedMember(member)}
                      >
                        {/* – column: member – */}
                        <td className="py-2">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                FID {member.farcasterFid}
                              </div>
                              {(member as any).farcasterUsername && (
                                <div className="text-sm text-gray-500">
                                  {(member as any).farcasterUsername}
                                </div>
                              )}
                            </div>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>

                        {/* – column: status – */}
                        <td className="py-2">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              memberStatus === "active_member"
                                ? "bg-green-100 text-green-800"
                                : memberStatus === "pending_application" ||
                                    memberStatus ===
                                      "pending_application_review"
                                  ? "bg-orange-100 text-orange-800"
                                  : memberStatus === "approved_application"
                                    ? "bg-blue-100 text-blue-800"
                                    : memberStatus === "denied_application"
                                      ? "bg-red-100 text-red-800"
                                      : memberStatus === "pending_acceptance"
                                        ? "bg-purple-100 text-purple-800"
                                        : memberStatus ===
                                            "pending_id_verification"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {memberStatus === "active_member"
                              ? "Active Member"
                              : memberStatus === "pending_application"
                                ? "Pending Application"
                                : memberStatus === "pending_application_review"
                                  ? "Pending Review"
                                  : memberStatus === "approved_application"
                                    ? "Approved Application"
                                    : memberStatus === "denied_application"
                                      ? "Denied Application"
                                      : memberStatus === "pending_acceptance"
                                        ? "Pending Acceptance"
                                        : memberStatus ===
                                            "pending_id_verification"
                                          ? "Pending Verification"
                                          : "Pending Signer"}
                          </span>
                        </td>

                        {/* – column: passport – */}
                        <td className="py-2">
                          {claimSubdomain ? (
                            <span className="text-sm font-mono">
                              {claimSubdomain}.ipecity.eth
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>

                        {/* – column: actions – */}
                        <td className="py-2">
                          {hasPendingApplication ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMember(member);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedMember && (
        <Dialog
          open={!!selectedMember}
          onOpenChange={() => setSelectedMember(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* ─ basic fields grid ─ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Farcaster FID
                  </label>
                  <p className="text-sm">{selectedMember.farcasterFid}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Username
                  </label>
                  <p className="text-sm font-mono">
                    {(selectedMember as any).ipeUsername || "Not provided"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <p className="text-sm">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        (selectedMember as any).status === "active_member"
                          ? "bg-green-100 text-green-800"
                          : (selectedMember as any).status ===
                              "pending_application_review"
                            ? "bg-orange-100 text-orange-800"
                            : (selectedMember as any).status ===
                                "approved_application"
                              ? "bg-blue-100 text-blue-800"
                              : (selectedMember as any).status ===
                                  "denied_application"
                                ? "bg-red-100 text-red-800"
                                : (selectedMember as any).status ===
                                    "pending_id_verification"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {(selectedMember as any).status === "active_member"
                        ? "Active Member"
                        : (selectedMember as any).status ===
                            "pending_application_review"
                          ? "Pending Application Review"
                          : (selectedMember as any).status ===
                              "approved_application"
                            ? "Approved Application"
                            : (selectedMember as any).status ===
                                "denied_application"
                              ? "Denied Application"
                              : (selectedMember as any).status ===
                                  "pending_id_verification"
                                ? "Pending ID Verification"
                                : "Pending Signer"}
                    </span>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Member Type
                  </label>
                  <p className="text-sm">
                    {selectedMember.memberType || "Not specified"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="text-sm">
                    {selectedMember.email || "Not provided"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Email Verified
                  </label>
                  <p className="text-sm">
                    {selectedMember.emailVerified ? "✓ Yes" : "✗ No"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Passport Claim
                  </label>
                  <p className="text-sm">
                    {(selectedMember as any).ipeUsername
                      ? `${(selectedMember as any).ipeUsername}.ipecity.eth`
                      : "Not claimed"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Passport Verified
                  </label>
                  <p className="text-sm">
                    {selectedMember.passportVerified ? "✓ Yes" : "✗ No"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Wallet Address
                  </label>
                  <p className="text-sm font-mono text-xs">
                    {selectedMember.walletAddress || "Not provided"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Registration Date
                  </label>
                  <p className="text-sm">
                    {(selectedMember as any).createdAt
                      ? new Date(
                          (selectedMember as any).createdAt,
                        ).toLocaleDateString()
                      : "Unknown"}
                  </p>
                </div>
              </div>

              {/* ─ optional bio ─ */}
              {(selectedMember as any).bio && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Bio
                  </label>
                  <p className="text-sm mt-1">{(selectedMember as any).bio}</p>
                </div>
              )}

              {/* ─ optional socials ─ */}
              {(selectedMember as any).socials && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Social Links
                  </label>
                  <p className="text-sm mt-1">
                    {(selectedMember as any).socials}
                  </p>
                </div>
              )}

              {/* ─ profile tags ─ */}
              {(selectedMember as any).profileTags?.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Profile Tags
                  </label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedMember as any).profileTags.map(
                      (tag: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* ─ action buttons when review is needed ─ */}
              {(selectedMember as any).status ===
                "pending_application_review" &&
                (selectedMember as any).ipeUsername && (
                  <div className="flex space-x-2 pt-4 border-t">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMemberMutation.mutate({
                          farcasterFid: selectedMember.farcasterFid,
                          ipeUsername: (selectedMember as any).ipeUsername,
                          userWalletAddress:
                            selectedMember.walletAddress || undefined,
                        });
                        setSelectedMember(null);
                      }}
                      disabled={
                        approveMemberMutation.isPending ||
                        denyMemberMutation.isPending
                      }
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {approveMemberMutation.isPending
                        ? "Approving…"
                        : "Approve"}
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        denyMemberMutation.mutate(selectedMember.farcasterFid);
                        setSelectedMember(null);
                      }}
                      disabled={
                        approveMemberMutation.isPending ||
                        denyMemberMutation.isPending
                      }
                    >
                      {denyMemberMutation.isPending ? "…" : "Deny"}
                    </Button>
                  </div>
                )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  /* ─────────────────── guards ─────────────────── */
  if (isLoading)
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );

  if (!isAuthenticated || !isAdmin)
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">Admin access required.</p>
        </div>
      </div>
    );

  /* ─────────────────── helpers ─────────────────── */
  const handleEditStart = (pulse: Pulse) => {
    setEditingPulse(pulse.id);
    setEditData({
      farcasterUrl: pulse.farcasterUrl,
      date: pulse.date,
      description: pulse.description,
    });
  };
}
