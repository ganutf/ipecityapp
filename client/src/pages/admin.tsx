import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, PulseType, Member, MemberType } from "@shared/schema";
import type { PulsesResponse, PulseTypesResponse, MembersResponse, MemberWithStats } from "@shared/types";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Eye, Clock, Globe, Wallet, Loader2, Mail, Twitter, Linkedin, Instagram, Tag, Calendar, Fingerprint, ShieldCheck, Check, UserCircle2, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMemberTypeInfo } from "@/lib/memberTypeConfig";
import { useConnectWallet } from "@privy-io/react-auth";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { useLocation } from "wouter";
import { PulseCard } from "@/components/PulseCard";
import { authenticatedPost, authenticatedGet, authenticatedPatch } from "@/lib/api";
import { useTimezone } from "@/contexts/TimezoneContext";
import { convertDateTimeInputToUTC, formatPulseDate, getCurrentUTC } from "@/lib/dateUtils";

export default function AdminPage() {
  const { isAuthenticated, member, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { timezoneInfo } = useTimezone();

  const { connectWallet } = useConnectWallet();
  const { activeWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;
  const isConnected = !!activeWallet;

  // Initialize all state hooks first (must be at top level)
  const [newPulse, setNewPulse] = useState({
    urlEmbed: "",
    datetimeStart: "",
    interval: 24,
    description: "",
    points: 1,
    pulseTypeId: 1, // Default to first pulse type
  });


  const [selectedMember, setSelectedMember] = useState<MemberWithStats | null>(null);
  const [selectedMemberType, setSelectedMemberType] = useState<MemberType>('architect');
  const [isEditingMemberType, setIsEditingMemberType] = useState(false);
  const [editMemberType, setEditMemberType] = useState<MemberType>('architect');
  const [approvingMemberIds, setApprovingMemberIds] = useState<Set<number>>(new Set());
  const [denyingMemberIds, setDenyingMemberIds] = useState<Set<number>>(new Set());

  // Check if user is admin based on memberType from auth context
  const isAdmin = member?.memberType === 'admin';

  // Member type configuration

  // Fetch pulse types
  const { data: pulseTypesData, isLoading: pulseTypesLoading } = useQuery<PulseTypesResponse>({
    queryKey: queryKeys.pulseTypes.list(),
    queryFn: () => authenticatedGet("/api/v2/pulse-types"),
    enabled: Boolean(isAuthenticated && isAdmin),
  });

  // Fetch all pulses - must be called before any returns
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery<PulsesResponse>({
    queryKey: queryKeys.pulses.list(),
    queryFn: () => authenticatedGet("/api/v2/pulses"),
    enabled: Boolean(isAuthenticated && isAdmin),
  });

  // Fetch all members
  const { data: membersData, isLoading: membersLoading } = useQuery<MembersResponse>({
    queryKey: queryKeys.members.list(),
    queryFn: () => authenticatedGet("/api/v2/admin/members"),
    enabled: Boolean(isAuthenticated && isAdmin),
  });

  // All mutations must also be declared before returns
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: { urlEmbed: string; datetimeStart: string; interval: number; description: string; points: number; pulseTypeId: number }) => {
      // Convert local datetime input to UTC for server storage
      const utcDateString = convertDateTimeInputToUTC(pulse.datetimeStart, timezoneInfo.timeZone);
      
      const pulseWithUTC = {
        ...pulse,
        datetimeStart: utcDateString
      };
      
      return authenticatedPost("/api/v2/pulses", pulseWithUTC);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pulses.list() });
      setNewPulse({ urlEmbed: "", datetimeStart: "", interval: 24, description: "", points: 1, pulseTypeId: 1 });
      toast({ title: "Success", description: "Pulse created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });


  const approveMemberMutation = useMutation({
    mutationFn: async (data: { memberId: number; ipeUsername?: string; userWalletAddress?: string; memberType?: MemberType }) => {
      return authenticatedPost("/api/v2/admin/approve-member", {
        memberId: data.memberId,
        ipeUsername: data.ipeUsername,
        userWalletAddress: data.userWalletAddress,
        memberType: data.memberType
      });
    },
    onMutate: (variables) => {
      setApprovingMemberIds(prev => new Set(prev).add(variables.memberId));
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list() });
      toast({ title: "Success", description: "Member approved — passport created on-chain" });
      setSelectedMember(prev => prev?.id === variables.memberId ? null : prev);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: (_data, _error, variables) => {
      setApprovingMemberIds(prev => {
        const next = new Set(prev);
        next.delete(variables.memberId);
        return next;
      });
    },
  });

  const denyMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      return authenticatedPost("/api/v2/admin/deny-member", { memberId });
    },
    onMutate: (memberId) => {
      setDenyingMemberIds(prev => new Set(prev).add(memberId));
    },
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list() });
      toast({ title: "Success", description: "Member denied successfully" });
      setSelectedMember(prev => prev?.id === memberId ? null : prev);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
    onSettled: (_data, _error, memberId) => {
      setDenyingMemberIds(prev => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    },
  });

  const updateMemberTypeMutation = useMutation({
    mutationFn: async ({ memberId, memberType }: { memberId: number; memberType: MemberType }) => {
      return authenticatedPatch(`/api/v2/admin/update-member-type`, { memberId, memberType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list() });
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
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Admin access required.</p>
          <p className="text-sm text-gray-500 mt-2">
            Auth: {isAuthenticated ? 'Yes' : 'No'}, Admin: {isAdmin ? 'Yes' : 'No'}, Member ID: {member?.id}
          </p>
        </div>
      </div>
    );
  }


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
          {!isConnected ? (
            <Button
              onClick={() => connectWallet()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
          )}
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
                  {pulseTypesData?.pulseTypes?.map((type: PulseType) => (
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
              {/* Timezone Preview */}
              {newPulse.datetimeStart && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <Globe className="h-4 w-4" />
                    <span className="font-medium">Timezone Preview:</span>
                  </div>
                  <div className="mt-1 space-y-1 text-xs text-blue-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatPulseDate(convertDateTimeInputToUTC(newPulse.datetimeStart, timezoneInfo.timeZone), timezoneInfo.timeZone, true)}</span>
                    </div>
                    <div className="text-gray-600">
                      Stored as UTC: {new Date(convertDateTimeInputToUTC(newPulse.datetimeStart, timezoneInfo.timeZone)).toISOString()}
                    </div>
                  </div>
                </div>
              )}
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
              {pulsesData?.pulses?.map((pulse: Pulse) => (
                <PulseCard
                  key={pulse.id}
                  pulse={pulse}
                  clickable={true}
                  isAdmin={true}
                />
              ))}
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
                  {membersData?.members?.map((member: MemberWithStats) => {
                    const memberStatus = member.status || 'unknown';
                    const claimSubdomain = member.ipePassport || (member.ipeUsername ? `${member.ipeUsername}.ipecity.eth` : null);
                    const hasPendingApplication = memberStatus === 'pending_application_review' && member.ipeUsername;
                    const needsApproval = hasPendingApplication;
                    
                    return (
                      <tr key={member.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedMember(member)}>
                        <td className="py-2">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {member.ipeUsername || member.email || `Member #${member.id}`}
                              </div>
                              <div className="text-sm text-gray-500">
                                <span>ID: {member.id}</span>
                                {member.email && (
                                  <>
                                    <span className="mx-1.5 text-gray-300">·</span>
                                    <span>{member.email}</span>
                                  </>
                                )}
                              </div>
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
                            getMemberTypeInfo(member.memberType).color
                          }`}>
                            {getMemberTypeInfo(member.memberType).label}
                          </span>
                        </td>
                        <td className="py-2">
                          {claimSubdomain ? (
                            <span className="text-sm font-mono">
                              {claimSubdomain}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2" onClick={(e) => e.stopPropagation()}>
                          {approvingMemberIds.has(member.id) ? (
                            <span className="inline-flex items-center text-xs text-gray-600">
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Approving…
                            </span>
                          ) : denyingMemberIds.has(member.id) ? (
                            <span className="inline-flex items-center text-xs text-gray-600">
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Denying…
                            </span>
                          ) : needsApproval ? (
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
      {selectedMember && (() => {
        const statusBadgeClass =
          selectedMember.status === 'active_member' ? 'bg-lime-100 text-lime-800 border-lime-200' :
          selectedMember.status === 'pending_application_review' ? 'bg-amber-100 text-amber-800 border-amber-200' :
          selectedMember.status === 'approved_application' ? 'bg-sky-100 text-sky-800 border-sky-200' :
          selectedMember.status === 'denied_application' ? 'bg-red-100 text-red-800 border-red-200' :
          selectedMember.status === 'pending_id_verification' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
          selectedMember.status === 'passport_revoked' ? 'bg-red-100 text-red-800 border-red-200' :
          'bg-gray-100 text-gray-700 border-gray-200';
        const statusLabel =
          selectedMember.status === 'active_member' ? 'Active Member' :
          selectedMember.status === 'pending_application_review' ? 'Pending Review' :
          selectedMember.status === 'approved_application' ? 'Approved' :
          selectedMember.status === 'denied_application' ? 'Denied' :
          selectedMember.status === 'pending_id_verification' ? 'Pending Verification' :
          selectedMember.status === 'passport_revoked' ? 'Passport Revoked' :
          selectedMember.status;
        const formattedDate = selectedMember.createdAt
          ? new Date(selectedMember.createdAt).toLocaleString("en-US", {
              month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true, year: "numeric",
            })
          : 'Unknown';
        const passportDisplay = selectedMember.ipePassport
          || (selectedMember.ipeUsername ? `${selectedMember.ipeUsername}.ipecity.eth` : null);
        const hasProfile = selectedMember.bio || (selectedMember.profileTags && selectedMember.profileTags.length > 0);
        const hasSocial = selectedMember.twitter || selectedMember.linkedin || selectedMember.instagram;
        const socialHandle = (url: string): string => {
          try {
            const u = new URL(url);
            const last = u.pathname.split('/').filter(Boolean).pop();
            return last ? `@${last}` : u.hostname;
          } catch {
            return url;
          }
        };
        return (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <UserCircle2 className="h-5 w-5 text-slate-600" />
                Application Details
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Member #{selectedMember.id}
                </span>
                <span className="text-gray-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formattedDate}
                </span>
              </div>
            </DialogHeader>
            <div className="space-y-6">
              {/* Identity — username headline + status */}
              <section className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Username</div>
                  <div className="flex items-center gap-2 text-xl font-semibold text-slate-900 truncate">
                    <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{selectedMember.ipeUsername || 'Not provided'}</span>
                  </div>
                </div>
                <Badge variant="outline" className={cn("flex-shrink-0", statusBadgeClass)}>
                  {statusLabel}
                </Badge>
              </section>

              {/* Member Type + Contact */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Tag className="h-3.5 w-3.5" /> Member Type
                  </div>
                  {selectedMember.status === 'pending_application_review' || selectedMember.status === 'pending_claim' ? (
                    <Select
                      value={selectedMemberType}
                      onValueChange={(value) => setSelectedMemberType(value as MemberType)}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="architect">Architect</SelectItem>
                        <SelectItem value="explorer">Explorer</SelectItem>
                        <SelectItem value="org_team">Org Team</SelectItem>
                        <SelectItem value="core_team">Core Team</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : isEditingMemberType ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={editMemberType}
                        onValueChange={(value) => setEditMemberType(value as MemberType)}
                      >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                          updateMemberTypeMutation.mutate({ memberId: selectedMember.id, memberType: editMemberType });
                        }}
                        disabled={updateMemberTypeMutation.isPending}
                        className="px-2"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingMemberType(false)} className="px-2">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={getMemberTypeInfo(selectedMember.memberType).color}>
                        {getMemberTypeInfo(selectedMember.memberType).label}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditMemberType(selectedMember.memberType as MemberType);
                          setIsEditingMemberType(true);
                        }}
                        className="h-7 px-2 text-xs text-gray-500 hover:text-slate-900"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-900 truncate">{selectedMember.email || 'Not provided'}</span>
                    {selectedMember.email && (
                      selectedMember.emailVerified ? (
                        <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200 gap-1">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                          Unverified
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              </section>

              {/* Passport & Wallet */}
              <section className="space-y-3 pt-4 border-t border-gray-100">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Passport &amp; Wallet</div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Fingerprint className="h-3.5 w-3.5" /> Passport Claim
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-slate-900">
                        {passportDisplay || 'Not claimed'}
                      </span>
                      {passportDisplay && (
                        selectedMember.passportVerified ? (
                          <Badge variant="outline" className="bg-lime-50 text-lime-700 border-lime-200 gap-1">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                            Unverified
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      <Wallet className="h-3.5 w-3.5" /> Wallet Address
                    </div>
                    <span className="text-xs font-mono text-slate-700 break-all">
                      {selectedMember.walletAddress || 'Not provided'}
                    </span>
                  </div>
                  {selectedMember.farcasterFid != null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <Hash className="h-3.5 w-3.5" /> Farcaster FID
                      </div>
                      <span className="text-sm text-slate-900">{selectedMember.farcasterFid}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Profile */}
              {hasProfile && (
                <section className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Profile</div>
                  {selectedMember.bio && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-gray-500">Bio</div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedMember.bio}</p>
                    </div>
                  )}
                  {selectedMember.profileTags && selectedMember.profileTags.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <Tag className="h-3.5 w-3.5" /> Skills &amp; Interests
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMember.profileTags.map((tag: string, index: number) => (
                          <Badge key={index} variant="secondary" className="bg-sky-50 text-sky-700 border-sky-100 font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Social */}
              {hasSocial && (
                <section className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Social</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {selectedMember.twitter && (
                      <a
                        href={selectedMember.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-colors min-w-0"
                      >
                        <Twitter className="h-4 w-4 text-sky-500 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{socialHandle(selectedMember.twitter)}</span>
                      </a>
                    )}
                    {selectedMember.linkedin && (
                      <a
                        href={selectedMember.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-colors min-w-0"
                      >
                        <Linkedin className="h-4 w-4 text-sky-600 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{socialHandle(selectedMember.linkedin)}</span>
                      </a>
                    )}
                    {selectedMember.instagram && (
                      <a
                        href={selectedMember.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 hover:border-sky-300 hover:bg-sky-50 transition-colors min-w-0"
                      >
                        <Instagram className="h-4 w-4 text-pink-500 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{socialHandle(selectedMember.instagram)}</span>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {/* Action buttons for pending applications */}
              {(selectedMember.status === 'pending_application_review' || selectedMember.status === 'pending_claim') &&
               selectedMember.ipeUsername && (() => {
                const isApproving = approvingMemberIds.has(selectedMember.id);
                const isDenying = denyingMemberIds.has(selectedMember.id);
                const isBusy = isApproving || isDenying;
                return (
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  {isApproving && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-sky-50 border border-sky-100 text-xs text-sky-800">
                      <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-sky-600 flex-shrink-0" />
                      <span>Minting passport on-chain — this can take up to 2 minutes. You can close this window and review other applications in the meantime.</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMemberMutation.mutate({
                          memberId: selectedMember.id,
                          ipeUsername: selectedMember.ipeUsername || undefined,
                          userWalletAddress: selectedMember.walletAddress || undefined,
                          memberType: selectedMemberType
                        });
                      }}
                      disabled={isBusy}
                      className="bg-lime-500 hover:bg-lime-600 text-slate-900 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving…
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Approve Application
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        denyMemberMutation.mutate(selectedMember.id);
                      }}
                      disabled={isBusy}
                    >
                      {isDenying ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Denying…
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Deny
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
        );
      })()}
    </div>
  );
}