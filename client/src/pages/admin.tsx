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
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Eye, Users, Calendar, RefreshCw } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { GrantTransferPermission } from "@/components/GrantTransferPermission";
import { apiRequest } from "@/lib/queryClient";

export default function AdminPage() {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { address, isConnected } = useAccount();

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

  const isAdmin = profile?.fid === 2790; // Update to correct admin FID

  // Queries
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

  // Mutations
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: typeof newPulse) => {
      return await apiRequest("/api/pulses", {
        method: "POST",
        body: JSON.stringify(pulse),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pulse created successfully" });
      setNewPulse({ farcasterUrl: "", date: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePulseMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & typeof editData) => {
      return await apiRequest(`/api/pulses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pulse updated successfully" });
      setEditingPulse(null);
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveMemberMutation = useMutation({
    mutationFn: async (member: {
      farcasterFid: number;
      ipeUsername: string;
      userWalletAddress?: string;
    }) => {
      return await apiRequest("/api/admin/approve-member", {
        method: "POST",
        body: JSON.stringify(member),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Member approved and subdomain reserved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const denyMemberMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      return await apiRequest("/api/admin/deny-member", {
        method: "POST",
        body: JSON.stringify({ farcasterFid }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Member application denied" });
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Loading and access guards
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h1>
          <p className="text-gray-600">Please authenticate with an admin account to access this page.</p>
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

  const isFuturePulse = (pulse: Pulse) =>
    pulse.date > new Date().toISOString().split("T")[0];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending_signer: { label: "Pending Signer", className: "bg-yellow-100 text-yellow-800" },
      pending_id_verification: { label: "Pending ID Verification", className: "bg-blue-100 text-blue-800" },
      pending_application: { label: "Pending Application", className: "bg-orange-100 text-orange-800" },
      pending_application_review: { label: "Pending Review", className: "bg-orange-100 text-orange-800" },
      approved_application: { label: "Approved Application", className: "bg-green-100 text-green-800" },
      denied_application: { label: "Denied Application", className: "bg-red-100 text-red-800" },
      active_member: { label: "Active Member", className: "bg-green-100 text-green-800" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
      { label: status, className: "bg-gray-100 text-gray-800" };
    
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getWalletRenewalStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const statusConfig = {
      pending_renewal: { label: "Pending Renewal", className: "bg-yellow-100 text-yellow-800" },
      awaiting_permission_grant: { label: "Awaiting Permission", className: "bg-blue-100 text-blue-800" },
      awaiting_revoke_reserve: { label: "Awaiting Revoke/Reserve", className: "bg-purple-100 text-purple-800" },
      revoking_subdomain: { label: "Processing", className: "bg-blue-100 text-blue-800" },
      awaiting_new_acceptance: { label: "Awaiting Acceptance", className: "bg-green-100 text-green-800" },
      completed: { label: "Completed", className: "bg-green-100 text-green-800" },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
      { label: status, className: "bg-gray-100 text-gray-800" };
    
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const pulses = pulsesData?.pulses || [];
  const members = membersData?.members || [];
  const pendingRenewals = pendingRenewalsData?.pendingRenewals || [];
  
  const pendingMembers = members.filter(m => m.status === "pending_application_review");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Manage pulses, members, and wallet renewals</p>
            </div>
            <div className="flex items-center gap-4">
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Admin wallet connection requirement */}
        {!isConnected && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <RefreshCw className="h-4 w-4" />
              <span className="font-medium">Admin Wallet Required</span>
            </div>
            <p className="text-yellow-700 mt-1">
              Connect your admin wallet to approve members and manage wallet renewals.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create New Pulse */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">Create New Pulse</h2>
            </div>
            
            <div className="space-y-4">
              <Input
                placeholder="Farcaster URL"
                value={newPulse.farcasterUrl}
                onChange={(e) => setNewPulse({ ...newPulse, farcasterUrl: e.target.value })}
              />
              <Input
                type="date"
                value={newPulse.date}
                onChange={(e) => setNewPulse({ ...newPulse, date: e.target.value })}
              />
              <Textarea
                placeholder="Description"
                value={newPulse.description}
                onChange={(e) => setNewPulse({ ...newPulse, description: e.target.value })}
                rows={3}
              />
              <Button
                onClick={() => createPulseMutation.mutate(newPulse)}
                disabled={createPulseMutation.isPending || !newPulse.farcasterUrl || !newPulse.date}
                className="w-full"
              >
                {createPulseMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Pulse"
                )}
              </Button>
            </div>
          </div>

          {/* Pending Member Applications */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Applications ({pendingMembers.length})
              </h2>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {pendingMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No pending applications</p>
              ) : (
                pendingMembers.map((member) => (
                  <div key={member.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{member.farcasterProfile?.displayName || `FID ${member.farcasterFid}`}</div>
                      <Button
                        onClick={() => setSelectedMember(member)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {member.ipeUsername ? `${member.ipeUsername}.ipecity.eth` : "No passport claimed"}
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(member.status)}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveMemberMutation.mutate({
                            farcasterFid: member.farcasterFid,
                            ipeUsername: member.ipeUsername || "",
                            userWalletAddress: member.walletAddress,
                          })}
                          disabled={approveMemberMutation.isPending || !isConnected}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => denyMemberMutation.mutate(member.farcasterFid)}
                          disabled={denyMemberMutation.isPending}
                          size="sm"
                          variant="destructive"
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Wallet Renewals Section */}
        {pendingRenewals.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="h-5 w-5 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Wallet Renewals ({pendingRenewals.length})
              </h2>
            </div>
            
            <div className="space-y-4">
              {pendingRenewals.map((member) => (
                <div key={member.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{member.farcasterProfile?.displayName || `FID ${member.farcasterFid}`}</div>
                      <div className="text-sm text-gray-600">{member.ipeUsername}.ipecity.eth</div>
                    </div>
                    {getWalletRenewalStatusBadge(member.walletRenewalStatus)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Current Wallet:</span>
                      <div className="font-mono">
                        {member.walletAddress?.slice(0, 6)}...{member.walletAddress?.slice(-4)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">New Wallet:</span>
                      <div className="font-mono">
                        {member.newWalletAddress?.slice(0, 6)}...{member.newWalletAddress?.slice(-4)}
                      </div>
                    </div>
                  </div>

                  {member.walletRenewalStatus === "awaiting_permission_grant" && (
                    <GrantTransferPermission
                      username={member.ipeUsername || ""}
                      farcasterFid={member.farcasterFid}
                      onPermissionGranted={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-wallet-renewals"] });
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Pulses */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Manage Pulses</h2>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {pulsesLoading ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-purple-600" />
                <p className="text-gray-500">Loading pulses...</p>
              </div>
            ) : pulses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pulses created yet</p>
            ) : (
              pulses.map((pulse) => (
                <div key={pulse.id} className="border rounded-lg p-4">
                  {editingPulse === pulse.id ? (
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
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updatePulseMutation.mutate({ id: pulse.id, ...editData })}
                          disabled={updatePulseMutation.isPending}
                          size="sm"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          onClick={() => setEditingPulse(null)}
                          size="sm"
                          variant="outline"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{pulse.date}</div>
                        <div className="text-sm text-gray-600">{pulse.description}</div>
                      </div>
                      {isFuturePulse(pulse) && (
                        <Button
                          onClick={() => handleEditStart(pulse)}
                          size="sm"
                          variant="outline"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Member Details Dialog */}
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Member Application Details</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Display Name</label>
                    <div>{selectedMember.farcasterProfile?.displayName || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Username</label>
                    <div>@{selectedMember.farcasterProfile?.username || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">FID</label>
                    <div>{selectedMember.farcasterFid}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div>{getStatusBadge(selectedMember.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div>{selectedMember.email || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email Verified</label>
                    <div>{selectedMember.emailVerified ? "✓ Yes" : "✗ No"}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Ipê Passport</label>
                    <div>{selectedMember.ipeUsername ? `${selectedMember.ipeUsername}.ipecity.eth` : "Not claimed"}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Wallet Address</label>
                    <div className="font-mono text-sm">{selectedMember.walletAddress || "N/A"}</div>
                  </div>
                </div>
                
                {selectedMember.bio && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Bio</label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedMember.bio}</div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    onClick={() => {
                      approveMemberMutation.mutate({
                        farcasterFid: selectedMember.farcasterFid,
                        ipeUsername: selectedMember.ipeUsername || "",
                        userWalletAddress: selectedMember.walletAddress,
                      });
                      setSelectedMember(null);
                    }}
                    disabled={approveMemberMutation.isPending || !isConnected}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve Application
                  </Button>
                  <Button
                    onClick={() => {
                      denyMemberMutation.mutate(selectedMember.farcasterFid);
                      setSelectedMember(null);
                    }}
                    disabled={denyMemberMutation.isPending}
                    variant="destructive"
                  >
                    Deny Application
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}