import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet, authenticatedPatch, authenticatedDelete } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, Clock, Target, Edit, Trash2, Save, X, Globe } from "lucide-react";
import { PulseExecutionsTable } from "@/components/PulseExecutionsTable";
import { FarcasterPostEmbed } from "@/components/FarcasterPostEmbed";
import { formatPulseDate, getPulseDurationText, convertDateTimeInputToUTC, formatForDateTimeInput } from "@/lib/dateUtils";
import { useTimezone } from "@/contexts/TimezoneContext";
import { cn } from "@/lib/utils";
import { getCardAccentColor, getStatusBadge } from "@/lib/pulseUtils";
import type { PulseType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function PulseDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const { timezoneInfo } = useTimezone();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const pulseId = parseInt(params.id || '0');

  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    urlEmbed: "",
    datetimeStart: "",
    interval: 24,
    description: "",
    points: 1,
    pulseTypeId: 1,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Check current user's member data to determine admin status
  const { data: currentMemberData } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(isAuthenticated && profile?.fid && !isLoading),
  });

  // Check if user is admin based on memberType
  const isAdmin = (currentMemberData as any)?.member?.memberType === 'admin';

  // Fetch pulse types for admin editing
  const { data: pulseTypesData } = useQuery({
    queryKey: ["/api/pulse-types"],
    queryFn: () => authenticatedGet("/api/pulse-types", profile?.fid),
    enabled: Boolean(isAuthenticated && isAdmin && profile?.fid),
  });

  // Fetch pulse execution data - now accessible to all authenticated users
  const { data: pulseData, isLoading: pulseLoading, error: pulseError, refetch } = useQuery({
    queryKey: [`/api/pulse/${pulseId}/executions`, profile?.fid], // Include profile.fid in query key
    queryFn: () => authenticatedGet(`/api/pulse/${pulseId}/executions`, profile?.fid),
    enabled: Boolean(isAuthenticated && profile?.fid && pulseId && !isLoading),
    retry: (failureCount, error) => {
      // Retry up to 3 times for network/auth issues, but not for 404s
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Mutations for admin actions
  const updatePulseMutation = useMutation({
    mutationFn: async (data: { urlEmbed: string; datetimeStart: string; interval: number; description: string; points: number; pulseTypeId: number }) => {
      const utcDateString = convertDateTimeInputToUTC(data.datetimeStart, timezoneInfo.timeZone);
      const dataWithUTC = { ...data, datetimeStart: utcDateString };
      return authenticatedPatch(`/api/pulses/${pulseId}`, dataWithUTC, profile?.fid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pulse/${pulseId}/executions`, profile?.fid] });
      setIsEditing(false);
      toast({ title: "Success", description: "Pulse updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePulseMutation = useMutation({
    mutationFn: async () => {
      return authenticatedDelete(`/api/pulses/${pulseId}`, profile?.fid);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pulse deleted successfully" });
      setLocation('/admin');
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Show loading while auth is initializing or pulse data is loading
  if (isLoading || (pulseLoading && isAuthenticated && profile?.fid)) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">
            {isLoading ? 'Authenticating...' : 'Loading pulse details...'}
          </p>
        </div>
      </div>
    );
  }

  // This check is now moved below to after the error handling

  // Enhanced error handling
  if (pulseError || (!pulseData && !pulseLoading && isAuthenticated && profile?.fid && pulseId)) {
    
    const isAuthError = pulseError?.message?.includes('401') || pulseError?.message?.includes('403');
    const isPulseNotFound = pulseError?.message?.includes('404') || pulseError?.message?.includes('not found');
    
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isAuthError ? 'Authentication Error' : isPulseNotFound ? 'Pulse Not Found' : 'Error Loading Pulse'}
          </h1>
          <p className="text-gray-600 mb-4">
            {isAuthError 
              ? 'Please try refreshing the page or signing in again.' 
              : isPulseNotFound 
              ? 'The requested pulse could not be found.' 
              : 'An error occurred while loading the pulse details.'}
          </p>
          {pulseError && (
            <p className="text-sm text-red-600 mb-4">Error: {pulseError.message}</p>
          )}
          <div className="space-x-2">
            <Button
              onClick={() => refetch()}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
            <Button
              onClick={() => setLocation(isAdmin ? '/admin' : '/pulses')}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isAdmin ? 'Back to Admin Dashboard' : 'Back to Pulses'}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Still loading auth or waiting for proper auth state
  if (!isAuthenticated || !profile?.fid || !pulseData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">
            {!isAuthenticated ? 'Please sign in to continue...' : 'Loading pulse details...'}
          </p>
        </div>
      </div>
    );
  }

  const pulse = pulseData.pulse;
  const executions = pulseData.executions;


  // Find current user's execution status using shared utility
  const currentUserExecution = executions?.find((execution: any) => 
    execution.member?.farcasterFid === profile?.fid
  );
  
  const executionStatus = currentUserExecution?.execution?.actions ? {
    liked: currentUserExecution.execution.actions.liked || false,
    shared: currentUserExecution.execution.actions.shared || false,
    abstained: currentUserExecution.execution.actions.abstained || false,
    hasExecution: Boolean(currentUserExecution)
  } : null;
  

  const getStatusBadgeConfig = () => {
    return getStatusBadge(executionStatus, pulse.datetimeStart, pulse.interval, new Date());
  };

  const getCardAccentColorConfig = () => {
    return getCardAccentColor(executionStatus, pulse.datetimeStart, pulse.interval, new Date());
  };

  // Admin helper functions
  const handleEditStart = () => {
    setEditData({
      urlEmbed: pulse.urlEmbed || "",
      datetimeStart: formatForDateTimeInput(pulse.datetimeStart, timezoneInfo.timeZone),
      interval: pulse.interval || 24,
      description: pulse.description || "",
      points: pulse.points || 1,
      pulseTypeId: (pulse as any).pulseTypeId || 1,
    });
    setIsEditing(true);
  };

  const isFuturePulse = () => {
    const now = new Date();
    const pulseStart = new Date(pulse.datetimeStart);
    return pulseStart > now;
  };

  const canEdit = isAdmin && isFuturePulse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden">
      <div className="container mx-auto max-w-6xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 min-w-0 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button
            onClick={() => setLocation(isAdmin ? '/admin' : '/pulses')}
            variant="outline"
            size="sm"
            className="flex items-center w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdmin ? 'Back to Admin' : 'Back to Pulses'}
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">PULSE #{pulse.id}</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {isAdmin ? 'Manage executions and attestations' : 'View pulse information and execution status'}
            </p>
          </div>
        </div>

        {/* Pulse Information Card */}
        <Card className={cn(
          "border-l-4 bg-white shadow-sm overflow-hidden",
          getCardAccentColorConfig()
        )}>
          <CardContent className="p-4 sm:p-6 min-w-0">
            {/* Header with Status and Admin Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
                  PULSE #{pulse.id}
                </h2>
                {(() => {
                  const badgeConfig = getStatusBadgeConfig();
                  return badgeConfig ? (
                    <Badge className={cn(badgeConfig.className, "w-fit")}>
                      {badgeConfig.text}
                    </Badge>
                  ) : null;
                })()}
              </div>
              
              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditStart}
                    disabled={!canEdit}
                    className="h-8"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Pulse</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-gray-600">
                          Are you sure you want to delete Pulse #{pulse.id}? This action cannot be undone.
                        </p>
                        <div className="flex space-x-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              deletePulseMutation.mutate();
                              setShowDeleteDialog(false);
                            }}
                            disabled={deletePulseMutation.isPending}
                          >
                            {deletePulseMutation.isPending ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
            
            {/* Description */}
            <p className="text-gray-700 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed break-words">
              {pulse.description}
            </p>
            
            {/* Key Information */}
            <div className="space-y-3 mb-4 sm:mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" />
                <span className="font-medium break-words">{formatPulseDate(pulse.datetimeStart, timezoneInfo.timeZone, true)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-sm">
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" />
                  <span>Duration: <span className="font-medium">{getPulseDurationText(pulse.interval)}</span></span>
                </div>
                <div className="flex items-center text-purple-600">
                  <Target className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="font-semibold">{pulse.points} points</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {isAdmin && isEditing && (
          <Card className="bg-blue-50 border-blue-200 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-900">Edit Pulse</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="h-8"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                updatePulseMutation.mutate(editData);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pulse Type
                  </label>
                  <Select 
                    value={editData.pulseTypeId.toString()} 
                    onValueChange={(value) => setEditData({ ...editData, pulseTypeId: parseInt(value) })}
                  >
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
                    value={editData.urlEmbed}
                    onChange={(e) => setEditData({ ...editData, urlEmbed: e.target.value })}
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
                    value={editData.datetimeStart}
                    onChange={(e) => setEditData({ ...editData, datetimeStart: e.target.value })}
                    required
                  />
                  {editData.datetimeStart && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <div className="flex items-center gap-1 text-blue-700">
                        <Globe className="h-3 w-3" />
                        <span className="font-medium">Preview: {timezoneInfo.displayName}</span>
                      </div>
                      <div className="text-blue-600">
                        {formatPulseDate(convertDateTimeInputToUTC(editData.datetimeStart, timezoneInfo.timeZone), timezoneInfo.timeZone, true)}
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
                    value={editData.interval}
                    onChange={(e) => setEditData({ ...editData, interval: parseInt(e.target.value) || 24 })}
                    placeholder="Duration in hours"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
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
                    value={editData.points}
                    onChange={(e) => setEditData({ ...editData, points: parseInt(e.target.value) || 1 })}
                    placeholder="Points awarded for completing this pulse"
                    required
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={updatePulseMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {updatePulseMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Farcaster Post Embed */}
        {pulse.urlEmbed && (
          <FarcasterPostEmbed
            castUrl={pulse.urlEmbed}
            viewerFid={profile?.fid}
            className="shadow-sm"
          />
        )}

        {/* Pulse Executions Table */}
        <Card className="bg-white shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-6 overflow-x-auto min-w-0">
            <PulseExecutionsTable
              pulse={pulse}
              executions={executions}
              profile={profile}
              onRefresh={() => refetch()}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}