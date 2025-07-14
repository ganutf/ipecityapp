import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, Member } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Save, X, Eye } from "lucide-react";
import { useAccount } from "wagmi";
// Removed useAddSubname hook - using direct API calls instead

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { authenticatedPost, authenticatedGet, authenticatedPatch } from "@/lib/api";

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

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Check current user's member data to determine admin status
  const { data: currentMemberData } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(profile?.fid),
  });

  // Check if user is admin based on memberType
  const isAdmin = (currentMemberData as any)?.member?.memberType === 'admin';

  // Fetch all pulses - must be called before any returns
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    queryFn: () => authenticatedGet("/api/pulses", profile?.fid),
    enabled: Boolean(isAuthenticated && isAdmin && profile?.fid),
  });

  // Fetch all members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/members"],
    queryFn: () => authenticatedGet("/api/members", profile?.fid),
    enabled: Boolean(isAuthenticated && isAdmin && profile?.fid),
  });

  // All mutations must also be declared before returns
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: { farcasterUrl: string; date: string; description: string }) => {
      return authenticatedPost("/api/pulses", pulse, profile?.fid);
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
      return authenticatedPatch(`/api/pulses/${id}`, data, profile?.fid);
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
    mutationFn: async (member: { farcasterFid: number; ipeUsername?: string; userWalletAddress?: string }) => {
      return authenticatedPost("/api/admin/approve-member", { 
        farcasterFid: member.farcasterFid,
        ipeUsername: member.ipeUsername,
        userWalletAddress: member.userWalletAddress
      }, profile?.fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Member approved and subdomain reserved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const denyMemberMutation = useMutation({
    mutationFn: async (farcasterFid: number) => {
      return authenticatedPost("/api/admin/deny-member", { farcasterFid }, profile?.fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Success", description: "Member denied successfully" });
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
    console.log('Admin access check:', { isAuthenticated, isAdmin, profileFid: profile?.fid });
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Admin access required.</p>
          <p className="text-sm text-gray-500 mt-2">
            Auth: {isAuthenticated ? 'Yes' : 'No'}, Admin: {isAdmin ? 'Yes' : 'No'}, FID: {profile?.fid}
          </p>
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
                    const claimSubdomain = (member as any).ipeUsername;
                    const hasPendingApplication = memberStatus === 'pending_application' && claimSubdomain;
                    const needsApproval = hasPendingApplication;
                    
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMember(member)}>
                        <td className="py-2">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {(member as any).farcasterUsername || `FID ${member.farcasterFid}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                FID: {member.farcasterFid}
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            memberStatus === 'active_member'
                              ? 'bg-green-100 text-green-800'
                              : memberStatus === 'pending_application'
                                ? 'bg-orange-100 text-orange-800'
                                : memberStatus === 'approved_application'
                                  ? 'bg-blue-100 text-blue-800'
                                  : memberStatus === 'denied_application'
                                    ? 'bg-red-100 text-red-800'
                                    : memberStatus === 'pending_acceptance'
                                      ? 'bg-purple-100 text-purple-800'
                                      : memberStatus === 'pending_id_verification'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-gray-100 text-gray-800'
                          }`}>
                            {memberStatus === 'active_member' ? 'Active Member' :
                             memberStatus === 'pending_application' ? 'Pending Application' :
                             memberStatus === 'approved_application' ? 'Approved Application' :
                             memberStatus === 'denied_application' ? 'Denied Application' :
                             memberStatus === 'pending_acceptance' ? 'Pending Acceptance' :
                             memberStatus === 'pending_id_verification' ? 'Pending Verification' :
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
                          {needsApproval ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  console.log("Approving member:", member);
                                  console.log("Wallet address:", member.walletAddress);
                                  console.log("Username:", (member as any).ipeUsername || claimSubdomain);
                                  approveMemberMutation.mutate({
                                    farcasterFid: member.farcasterFid,
                                    ipeUsername: (member as any).ipeUsername || claimSubdomain,
                                    userWalletAddress: member.walletAddress || undefined
                                  });
                                }}
                                disabled={approveMemberMutation.isPending || denyMemberMutation.isPending}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                              >
                                {approveMemberMutation.isPending 
                                  ? "Reserving..." 
                                  : "Approve & Reserve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => denyMemberMutation.mutate(member.farcasterFid)}
                                disabled={approveMemberMutation.isPending || denyMemberMutation.isPending}
                              >
                                {denyMemberMutation.isPending ? "..." : "Deny"}
                              </Button>
                            </div>
                          ) : memberStatus === 'active_member' ? (
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

      {/* Member Application Details Modal */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Farcaster FID</label>
                  <p className="text-sm">{selectedMember.farcasterFid}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Username</label>
                  <p className="text-sm">{(selectedMember as any).ipeUsername || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      (selectedMember as any).status === 'active_member'
                        ? 'bg-green-100 text-green-800'
                        : (selectedMember as any).status === 'pending_application'
                          ? 'bg-orange-100 text-orange-800'
                          : (selectedMember as any).status === 'pending_claim'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(selectedMember as any).status === 'active_member' ? 'Active Member' :
                       (selectedMember as any).status === 'pending_application' ? 'Pending Application' :
                       (selectedMember as any).status === 'pending_claim' ? 'Pending Claim' :
                       'Pending Signer'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Member Type</label>
                  <p className="text-sm">{selectedMember.memberType || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{selectedMember.email || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email Verified</label>
                  <p className="text-sm">{selectedMember.emailVerified ? '✓ Yes' : '✗ No'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Passport Claim</label>
                  <p className="text-sm">
                    {(selectedMember as any).ipeUsername ? 
                      `${(selectedMember as any).ipeUsername}.ipecity.eth` : 
                      'Not claimed'}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Wallet Address</label>
                  <p className="text-sm font-mono text-xs">{selectedMember.walletAddress || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Registration Date</label>
                  <p className="text-sm">
                    {(selectedMember as any).createdAt ? 
                      new Date((selectedMember as any).createdAt).toLocaleDateString() : 
                      'Unknown'}
                  </p>
                </div>
              </div>
              
              {(selectedMember as any).bio && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Bio</label>
                  <p className="text-sm mt-1">{(selectedMember as any).bio}</p>
                </div>
              )}
              
              {(selectedMember as any).socials && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Social Links</label>
                  <p className="text-sm mt-1">{(selectedMember as any).socials}</p>
                </div>
              )}
              
              {(selectedMember as any).profileTags && (selectedMember as any).profileTags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Profile Tags</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedMember as any).profileTags.map((tag: string, index: number) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons for pending applications */}
              {((selectedMember as any).status === 'pending_application' || (selectedMember as any).status === 'pending_claim') && 
               (selectedMember as any).ipeUsername && (
                <div className="flex space-x-2 pt-4 border-t">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveMemberMutation.mutate({
                        farcasterFid: selectedMember.farcasterFid,
                        ipeUsername: (selectedMember as any).ipeUsername,
                        userWalletAddress: selectedMember.walletAddress || undefined
                      });
                      setSelectedMember(null);
                    }}
                    disabled={approveMemberMutation.isPending || denyMemberMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {approveMemberMutation.isPending ? "Reserving..." : "Approve & Reserve"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      denyMemberMutation.mutate(selectedMember.farcasterFid);
                      setSelectedMember(null);
                    }}
                    disabled={approveMemberMutation.isPending || denyMemberMutation.isPending}
                  >
                    {denyMemberMutation.isPending ? "..." : "Deny"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}