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

  // Debug: Add logging to track authentication state
  console.log('Pulse Detail Debug:', {
    isAuthenticated,
    isLoading,
    profileFid: profile?.fid,
    pulseId,
    timestamp: new Date().toISOString()
  });

  // Fetch pulse execution data - now accessible to all authenticated users
  const { data: pulseData, isLoading: pulseLoading, error: pulseError, refetch } = useQuery({
    queryKey: [`/api/pulse/${pulseId}/executions`, profile?.fid], // Include profile.fid in query key
    queryFn: () => {
      console.log('API Call - Pulse executions:', { pulseId, profileFid: profile?.fid });
      return authenticatedGet(`/api/pulse/${pulseId}/executions`, profile?.fid);
    },
    enabled: Boolean(isAuthenticated && profile?.fid && pulseId && !isLoading),
    retry: (failureCount, error) => {
      console.log('Query retry attempt:', { failureCount, error: error?.message });
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

  // Enhanced error handling with better debugging
  if (pulseError || (!pulseData && !pulseLoading && isAuthenticated && profile?.fid && pulseId)) {
    console.error('Pulse detail error:', { pulseError, pulseData, pulseLoading, isAuthenticated, profileFid: profile?.fid, pulseId });
    
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

  const getStatusBadge = () => {
    const now = new Date();
    const startTime = new Date(pulse.datetimeStart);
    const endTime = new Date(startTime.getTime() + (pulse.interval * 60 * 60 * 1000));
    
    const baseClasses = "px-3 py-1.5 text-sm font-semibold rounded-full";
    
    if (now >= startTime && now <= endTime) {
      return (
        <Badge className={cn(baseClasses, "bg-orange-500 text-white")}>
          Active
        </Badge>
      );
    } else if (now > endTime) {
      return (
        <Badge className={cn(baseClasses, "bg-gray-500 text-white")}>
          Ended
        </Badge>
      );
    } else {
      return (
        <Badge className={cn(baseClasses, "bg-blue-500 text-white")}>
          Scheduled
        </Badge>
      );
    }
  };

  const getCardAccentColor = () => {
    const now = new Date();
    const startTime = new Date(pulse.datetimeStart);
    const endTime = new Date(startTime.getTime() + (pulse.interval * 60 * 60 * 1000));
    
    if (now >= startTime && now <= endTime) {
      return "border-l-orange-500";
    } else if (now > endTime) {
      return "border-l-gray-400";
    } else {
      return "border-l-blue-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation(isAdmin ? '/admin' : '/pulses')}
            variant="outline"
            size="sm"
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdmin ? 'Back to Admin' : 'Back to Pulses'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PULSE #{pulse.id}</h1>
            <p className="text-gray-600 text-sm">
              {isAdmin ? 'Manage executions and attestations' : 'View pulse information and execution status'}
            </p>
          </div>
        </div>

        {/* Pulse Information Card */}
        <Card className={cn(
          "border-l-4 bg-white shadow-sm",
          getCardAccentColor()
        )}>
          <CardContent className="p-6">
            {/* Header with Status */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-gray-900">
                  PULSE #{pulse.id}
                </h2>
                {getStatusBadge()}
              </div>
            </div>
            
            {/* Description */}
            <p className="text-gray-700 text-base mb-6 leading-relaxed">
              {pulse.description}
            </p>
            
            {/* Key Information */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-3 text-gray-400" />
                <span className="font-medium">{formatPulseDate(new Date(pulse.datetimeStart))}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-3 text-gray-400" />
                  <span>Duration: <span className="font-medium">{getPulseDurationText(pulse.interval)}</span></span>
                </div>
                <div className="flex items-center text-purple-600">
                  <Target className="h-4 w-4 mr-2" />
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
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6">
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