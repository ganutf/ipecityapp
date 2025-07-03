import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, Member } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { useAccount } from "wagmi";
// Removed useAddSubname hook - using direct API calls instead

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function AdminPage() {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Wallet connection for subdomain reservation
  const { address, isConnected } = useAccount();

  // Initialize all state hooks first (must be at top level)
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

  // Check if user is admin (FID 2790)
  const isAdmin = profile?.fid === 2790;

  // Fetch all pulses - must be called before any returns
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch all members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/members"],
    enabled: isAuthenticated && isAdmin,
  });

  // All mutations must also be declared before returns
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: { farcasterUrl: string; date: string; description: string }) => {
      const response = await fetch("/api/pulses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pulse),
      });
      if (!response.ok) throw new Error("Failed to create pulse");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setNewPulse({ farcasterUrl: "", date: "", description: "" });
      toast({ title: "Success", description: "Pulse created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePulseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { farcasterUrl: string; date: string; description: string } }) => {
      const response = await fetch(`/api/pulses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update pulse");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setEditingPulse(null);
      toast({ title: "Success", description: "Pulse updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveMemberMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      const response = await fetch("/api/admin/approve-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterFid }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to approve member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Member approved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const denyMemberMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      const response = await fetch("/api/admin/deny-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterFid }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to deny member");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Member denied successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approvePassportClaimMutation = useMutation({
    mutationFn: async (member: Member) => {
      if (!isConnected || !address) {
        throw new Error("Admin wallet must be connected to create subdomains");
      }

      if (!member.passportClaimSubdomain || !member.passportClaimWalletAddress) {
        throw new Error("Missing subdomain claim or wallet address for this member");
      }

      console.log("=== ADMIN SUBDOMAIN RESERVATION ===");
      console.log(`Reserving subdomain: ${member.passportClaimSubdomain}.ipecity.eth`);
      console.log(`Will be owned by: ${member.passportClaimWalletAddress}`);
      console.log(`Admin wallet (API caller): ${address}`);

      // Step 1: Reserve subdomain using JustaName API
      const reserveResponse = await fetch('https://api.justaname.id/ens/v1/subname/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_JUSTANAME_API_KEY}`,
        },
        body: JSON.stringify({
          username: member.passportClaimSubdomain.toLowerCase(),
          ensDomain: "ipecity.eth",
          chainId: 1,
        }),
      });

      if (!reserveResponse.ok) {
        const errorData = await reserveResponse.json();
        throw new Error(`Failed to reserve subdomain: ${errorData.error || reserveResponse.statusText}`);
      }

      const reserveData = await reserveResponse.json();
      console.log("✓ Subdomain reserved successfully:", reserveData);
      console.log("Step 2: Approving passport claim in backend...");

      // Step 2: Approve in backend
      const response = await fetch("/api/passport/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterFid: member.farcasterFid }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve passport claim");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ 
        title: "Success", 
        description: "Passport claim approved successfully!" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const denyPassportClaimMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      const response = await fetch("/api/passport/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterFid }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to deny passport claim");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Passport claim denied successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Admin access required.</p>
        </div>
      </div>
    );
  }

  // Helper functions
  const handleEditStart = (pulse: Pulse) => {
    setEditingPulse(pulse.id);
    setEditData({
      farcasterUrl: pulse.farcasterUrl,
      date: pulse.date,
      description: pulse.description,
    });
  };

  const isFuturePulse = (pulse: Pulse) => {
    const today = new Date().toISOString().split('T')[0];
    return pulse.date > today;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage pulses and community members</p>
      </div>

      {/* Wallet Connection Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Admin Wallet</h3>
            <p className="text-blue-700 text-sm">
              {isConnected 
                ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` 
                : "Connect wallet to create subdomains for passport claims"}
            </p>
          </div>
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
      
      <div className="space-y-8">
        {/* Create Pulse Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Pulse</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createPulseMutation.mutate(newPulse);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Farcaster URL
              </label>
              <Input
                value={newPulse.farcasterUrl}
                onChange={(e) => setNewPulse({ ...newPulse, farcasterUrl: e.target.value })}
                placeholder="https://warpcast.com/username/0x123..."
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
                onChange={(e) => setNewPulse({ ...newPulse, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Textarea
                value={newPulse.description}
                onChange={(e) => setNewPulse({ ...newPulse, description: e.target.value })}
                placeholder="Describe the pulse activity..."
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={createPulseMutation.isPending}
              className="w-full"
            >
              {createPulseMutation.isPending ? "Creating..." : "Create Pulse"}
            </Button>
          </form>
        </div>
      </div>

      {/* Pulses List */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Manage Pulses</h2>
        </div>
        <div className="p-6">
          {pulsesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading pulses...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(pulsesData as any)?.pulses?.map((pulse: Pulse) => {
                const isEditing = editingPulse === pulse.id;
                const canEdit = isFuturePulse(pulse);
                const today = new Date().toISOString().split('T')[0];
                const isPast = pulse.date < today;
                const isToday = pulse.date === today;
                
                return (
                  <div key={pulse.id} className={`border rounded-lg p-4 ${
                    isToday
                      ? "border-green-300 bg-green-50"
                      : isPast
                        ? "border-gray-200 bg-gray-50"
                        : "border-blue-200 bg-blue-50"
                  }`}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={editData.farcasterUrl}
                          onChange={(e) => setEditData({ ...editData, farcasterUrl: e.target.value })}
                          placeholder="Farcaster URL"
                        />
                        <Input
                          type="date"
                          value={editData.date}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        />
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Description"
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updatePulseMutation.mutate({ id: pulse.id, data: editData });
                            }}
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
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold">{pulse.date}</h3>
                          <p className="text-gray-600 mb-2">{pulse.description}</p>
                          <p className="text-sm text-blue-600 break-all">{pulse.farcasterUrl}</p>
                        </div>
                        <div className="ml-4">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Community Members</h2>
        </div>
        <div className="p-6">
          {membersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading members...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
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
                <tbody className="bg-white divide-y divide-gray-200">
                  {(membersData as any)?.members?.map((member: Member) => {
                    const memberStatus = (member as any).status || 'unknown';
                    const claimSubdomain = member.passportClaimSubdomain;
                    const hasPendingClaim = memberStatus === 'pending_claim' && claimSubdomain;
                    
                    return (
                      <tr key={member.id}>
                        <td className="py-2">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.name || `FID ${member.farcasterFid}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              FID: {member.farcasterFid}
                            </div>
                          </div>
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            memberStatus === 'member' 
                              ? 'bg-green-100 text-green-800'
                              : memberStatus === 'pending_claim'
                                ? 'bg-yellow-100 text-yellow-800'
                                : memberStatus === 'email_verified'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}>
                            {memberStatus === 'member' ? 'Member' :
                             memberStatus === 'pending_claim' ? 'Pending Claim' :
                             memberStatus === 'email_verified' ? 'Email Verified' :
                             'Pending Signer'}
                          </span>
                        </td>
                        <td className="py-2">
                          {claimSubdomain ? (
                            <span className="text-sm font-mono">
                              {claimSubdomain}.ipecity.eth
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2">
                          {hasPendingClaim ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => approvePassportClaimMutation.mutate(member)}
                                disabled={!isConnected || approvePassportClaimMutation.isPending || denyPassportClaimMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                                title={!isConnected ? "Connect wallet to approve claims" : ""}
                              >
                                {approvePassportClaimMutation.isPending 
                                  ? "Reserving..." 
                                  : !isConnected 
                                    ? "Need Wallet" 
                                    : "Approve & Reserve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => denyPassportClaimMutation.mutate(member.farcasterFid)}
                                disabled={approvePassportClaimMutation.isPending || denyPassportClaimMutation.isPending}
                              >
                                {denyPassportClaimMutation.isPending ? "..." : "Deny"}
                              </Button>
                            </div>
                          ) : memberStatus === 'member' ? (
                            <span className="text-sm text-gray-500">Completed</span>
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
    </div>
  );
}