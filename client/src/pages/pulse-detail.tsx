import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Clock, Target } from "lucide-react";
import { PulseExecutionsTable } from "@/components/PulseExecutionsTable";
import { FarcasterPostEmbed } from "@/components/FarcasterPostEmbed";
import { formatPulseDate, getPulseDurationText } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { getCardAccentColor, getStatusBadge, hasUserExecuted, extractExecutionStatus } from "@/lib/pulseUtils";

export default function PulseDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  
  const pulseId = parseInt(params.id || '0');

  // Check current user's member data to determine admin status
  const { data: currentMemberData } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(isAuthenticated && profile?.fid && !isLoading),
  });

  // Check if user is admin based on memberType
  const isAdmin = (currentMemberData as any)?.member?.memberType === 'admin';


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
  
  // Check if current user has executed this pulse using shared utility
  const hasCurrentUserExecuted = hasUserExecuted(executionStatus);

  const getStatusBadgeConfig = () => {
    return getStatusBadge(executionStatus, pulse.datetimeStart, pulse.interval);
  };

  const getCardAccentColorConfig = () => {
    return getCardAccentColor(executionStatus, pulse.datetimeStart, pulse.interval);
  };

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
            {/* Header with Status */}
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
            </div>
            
            {/* Description */}
            <p className="text-gray-700 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed break-words">
              {pulse.description}
            </p>
            
            {/* Key Information */}
            <div className="space-y-3 mb-4 sm:mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" />
                <span className="font-medium break-words">{formatPulseDate(new Date(pulse.datetimeStart))}</span>
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