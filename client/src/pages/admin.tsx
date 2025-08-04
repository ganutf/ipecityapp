import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, PulseType, Member, MemberType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Eye, BarChart3 } from "lucide-react";
import { useAccount } from "wagmi";
import { useLocation } from "wouter";
import { PulseCard } from "@/components/PulseCard";
// Removed useAddSubname hook - using direct API calls instead

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { authenticatedPost, authenticatedGet, authenticatedPatch } from "@/lib/api";

export default function AdminPage() {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Wallet connection for subdomain reservation
  const { address, isConnected } = useAccount();

  // Initialize all state hooks first (must be at top level)
  const [newPulse, setNewPulse] = useState({
    urlEmbed: "",
    datetimeStart: "",
    interval: 24,
    description: "",
    points: 1,
    pulseTypeId: 1, // Default to first pulse type
  });

  const [editingPulse, setEditingPulse] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    urlEmbed: "",
    datetimeStart: "",
    interval: 24,
    description: "",
    points: 1,
    pulseTypeId: 1,
  });

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedMemberType, setSelectedMemberType] = useState<MemberType>('architect');
  const [isEditingMemberType, setIsEditingMemberType] = useState(false);
  const [editMemberType, setEditMemberType] = useState<MemberType>('architect');

  // Check current user's member data to determine admin status
  const { data: currentMemberData } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(profile?.fid),
  });

  // Check if user is admin based on memberType
  const isAdmin = (currentMemberData as any)?.member?.memberType === 'admin';

  // Member type configuration
  const memberTypeConfig = {
    architect: { label: 'Architect', color: 'bg-purple-100 text-purple-800' },
    explorer: { label: 'Explorer', color: 'bg-blue-100 text-blue-800' },
    admin: { label: 'Admin', color: 'bg-green-100 text-green-800' },
    org_team: { label: 'Org Team', color: 'bg-orange-100 text-orange-800' },
    core_team: { label: 'Core Team', color: 'bg-red-100 text-red-800' },
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800' }
  };

  // Fetch pulse types
  const { data: pulseTypesData, isLoading: pulseTypesLoading } = useQuery({
    queryKey: ["/api/pulse-types"],
    queryFn: () => authenticatedGet("/api/pulse-types", profile?.fid),
    enabled: Boolean(isAuthenticated && isAdmin && profile?.fid),
  });

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
    mutationFn: async (pulse: { urlEmbed: string; datetimeStart: string; interval: number; description: string; points: number; pulseTypeId: number }) => {
      return authenticatedPost("/api/pulses", pulse, profile?.fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setNewPulse({ urlEmbed: "", datetimeStart: "", interval: 24, description: "", points: 1, pulseTypeId: 1 });
      toast({ title: "Success", description: "Pulse created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePulseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { urlEmbed: string; datetimeStart: string; interval: number; description: string; points: number; pulseTypeId: number } }) => {
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
    mutationFn: async (member: { farcasterFid: number; ipeUsername?: string; userWalletAddress?: string; memberType?: MemberType }) => {
      return authenticatedPost("/api/admin/approve-member", { 
        farcasterFid: member.farcasterFid,
        ipeUsername: member.ipeUsername,
        userWalletAddress: member.userWalletAddress,
        memberType: member.memberType
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

  const updateMemberTypeMutation = useMutation({
    mutationFn: async ({ farcasterFid, memberType }: { farcasterFid: number; memberType: MemberType }) => {
      return authenticatedPatch(`/api/admin/update-member-type`, { farcasterFid, memberType }, profile?.fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setIsEditingMemberType(false);
      toast({ title: "Success", description: "Member type updated successfully" });
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
      urlEmbed: (pulse as any).urlEmbed,
      datetimeStart: new Date((pulse as any).datetimeStart).toISOString().slice(0, 16), // Format for datetime-local input
      interval: (pulse as any).interval || 24,
      description: pulse.description,
      points: pulse.points || 1,
      pulseTypeId: (pulse as any).pulseTypeId || 1,
    });
  };

  const isFuturePulse = (pulse: Pulse) => {
    const now = new Date();
    const pulseStart = new Date((pulse as any).datetimeStart);
    return pulseStart > now;
  };

  const isPulseActive = (pulse: Pulse) => {
    const now = new Date();
    const pulseStart = new Date((pulse as any).datetimeStart);
    const pulseEnd = new Date(pulseStart.getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000);
    return now >= pulseStart && now <= pulseEnd;
  };

  const isPulseEnded = (pulse: Pulse) => {
    const now = new Date();
    const pulseStart = new Date((pulse as any).datetimeStart);
    const pulseEnd = new Date(pulseStart.getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000);
    return now > pulseEnd;
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
                Pulse Type
              </label>
              <Select value={newPulse.pulseTypeId.toString()} onValueChange={(value) => setNewPulse({ ...newPulse, pulseTypeId: parseInt(value) })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pulse type" />
                </SelectTrigger>
                <SelectContent>
                  {(pulseTypesData as any)?.pulseTypes?.map((type: PulseType) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Embed
              </label>
              <Input
                value={newPulse.urlEmbed}
                onChange={(e) => setNewPulse({ ...newPulse, urlEmbed: e.target.value })}
                placeholder="https://warpcast.com/username/0x123..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time
              </label>
              <Input
                type="datetime-local"
                value={newPulse.datetimeStart}
                onChange={(e) => setNewPulse({ ...newPulse, datetimeStart: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (hours)
              </label>
              <Input
                type="number"
                min="1"
                max="8760"
                value={newPulse.interval}
                onChange={(e) => setNewPulse({ ...newPulse, interval: parseInt(e.target.value) || 24 })}
                placeholder="Duration in hours"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points
              </label>
              <Input
                type="number"
                min="1"
                max="1000"
                value={newPulse.points}
                onChange={(e) => setNewPulse({ ...newPulse, points: parseInt(e.target.value) || 1 })}
                placeholder="Points awarded for completing this pulse"
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

                if (isEditing) {
                  return (
                    <div key={pulse.id} className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                      <div className="space-y-3">
                        <Select value={editData.pulseTypeId.toString()} onValueChange={(value) => setEditData({ ...editData, pulseTypeId: parseInt(value) })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pulse type" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pulseTypesData as any)?.pulseTypes?.map((type: PulseType) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={editData.urlEmbed}
                          onChange={(e) => setEditData({ ...editData, urlEmbed: e.target.value })}
                          placeholder="URL Embed"
                        />
                        <Input
                          type="datetime-local"
                          value={editData.datetimeStart}
                          onChange={(e) => setEditData({ ...editData, datetimeStart: e.target.value })}
                        />
                        <Input
                          type="number"
                          min="1"
                          max="8760"
                          value={editData.interval}
                          onChange={(e) => setEditData({ ...editData, interval: parseInt(e.target.value) || 24 })}
                          placeholder="Duration (hours)"
                        />
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Description"
                        />
                        <Input
                          type="number"
                          min="1"
                          max="1000"
                          value={editData.points}
                          onChange={(e) => setEditData({ ...editData, points: parseInt(e.target.value) || 1 })}
                          placeholder="Points"
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
                    </div>
                  );
                }

                return (
                  <PulseCard
                    key={pulse.id}
                    pulse={pulse}
                    showAdminActions={canEdit}
                    clickable={true}
                    isAdmin={true}
                    onEdit={canEdit ? () => handleEditStart(pulse) : undefined}
                  />
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
                      Member Type
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
                    const hasPendingApplication = memberStatus === 'pending_application_review' && claimSubdomain;
                    const needsApproval = hasPendingApplication;
                    
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMember(member)}>
                        <td className="py-2">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {(member as any).farcasterUsername || `FID ${member.farcasterFid}`}
                              </div>
                              {(member as any).farcasterUsername && (
                                <div className="text-sm text-gray-500">
                                  FID: {member.farcasterFid}
                                </div>
                              )}
                            </div>
                            <Eye className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            memberStatus === 'active_member'
                              ? 'bg-green-100 text-green-800'
                              : memberStatus === 'pending_application_review'
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
                             memberStatus === 'pending_application_review' ? 'Pending Review' :
                             memberStatus === 'approved_application' ? 'Approved Application' :
                             memberStatus === 'denied_application' ? 'Denied Application' :
                             memberStatus === 'pending_acceptance' ? 'Pending Acceptance' :
                             memberStatus === 'pending_id_verification' ? 'Pending Verification' :
                             'Pending Signer'}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            memberTypeConfig[member.memberType as keyof typeof memberTypeConfig]?.color || 'bg-gray-100 text-gray-800'
                          }`}>
                            {memberTypeConfig[member.memberType as keyof typeof memberTypeConfig]?.label || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-2">
                          {claimSubdomain ? (
                            <span className="text-sm font-mono">
                              {claimSubdomain}.ipecity.eth
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2" onClick={(e) => e.stopPropagation()}>
                          {needsApproval ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMember(member);
                              }}
                              className="text-xs px-3 py-1"
                            >
                              Review
                            </Button>
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
                        : (selectedMember as any).status === 'pending_application_review'
                          ? 'bg-orange-100 text-orange-800'
                          : (selectedMember as any).status === 'pending_claim'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                    }`}>
                      {(selectedMember as any).status === 'active_member' ? 'Active Member' :
                       (selectedMember as any).status === 'pending_application_review' ? 'Pending Review' :
                       (selectedMember as any).status === 'pending_claim' ? 'Pending Claim' :
                       'Pending Signer'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Member Type</label>
                  {(selectedMember as any).status === 'pending_application_review' || (selectedMember as any).status === 'pending_claim' ? (
                    // For pending applications - always editable
                    <Select 
                      value={selectedMemberType} 
                      onValueChange={(value) => setSelectedMemberType(value as MemberType)}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="architect">Architect</SelectItem>
                        <SelectItem value="explorer">Explorer</SelectItem>
                        <SelectItem value="org_team">Org Team</SelectItem>
                        <SelectItem value="core_team">Core Team</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : isEditingMemberType ? (
                    // Edit mode for approved members
                    <div className="flex items-center space-x-2 mt-1">
                      <Select 
                        value={editMemberType} 
                        onValueChange={(value) => setEditMemberType(value as MemberType)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="architect">Architect</SelectItem>
                          <SelectItem value="explorer">Explorer</SelectItem>
                          <SelectItem value="org_team">Org Team</SelectItem>
                          <SelectItem value="core_team">Core Team</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => {
                          updateMemberTypeMutation.mutate({
                            farcasterFid: selectedMember.farcasterFid,
                            memberType: editMemberType
                          });
                        }}
                        disabled={updateMemberTypeMutation.isPending}
                        className="px-2"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingMemberType(false)}
                        className="px-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    // View mode for approved members
                    <div className="flex items-center justify-between mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        memberTypeConfig[selectedMember.memberType as keyof typeof memberTypeConfig]?.color || 'bg-gray-100 text-gray-800'
                      }`}>
                        {memberTypeConfig[selectedMember.memberType as keyof typeof memberTypeConfig]?.label || 'Unknown'}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditMemberType(selectedMember.memberType as MemberType);
                          setIsEditingMemberType(true);
                        }}
                        className="px-2 py-1 h-6 text-xs"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
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
                      new Date((selectedMember as any).createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                        year: "numeric"
                      }) : 
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
              {((selectedMember as any).status === 'pending_application_review' || (selectedMember as any).status === 'pending_claim') && 
               (selectedMember as any).ipeUsername && (
                <div className="flex space-x-2 pt-4 border-t">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      approveMemberMutation.mutate({
                        farcasterFid: selectedMember.farcasterFid,
                        ipeUsername: (selectedMember as any).ipeUsername,
                        userWalletAddress: selectedMember.walletAddress || undefined,
                        memberType: selectedMemberType
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