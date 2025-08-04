import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, ExternalLink } from "lucide-react";
import { PulseExecutionsTable } from "@/components/PulseExecutionsTable";

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
              onClick={() => setLocation(isAdmin ? '/admin' : '/')}
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

  const formatDateTime = (dateTimeStr: string) => {
    return new Date(dateTimeStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getEndDateTime = (startDateTime: string, intervalHours: number) => {
    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + intervalHours * 60 * 60 * 1000);
    return end;
  };

  const isPulseActive = () => {
    const now = new Date();
    const start = new Date(pulse.datetimeStart);
    const end = getEndDateTime(pulse.datetimeStart, pulse.interval);
    return now >= start && now <= end;
  };

  const isPulseEnded = () => {
    const now = new Date();
    const end = getEndDateTime(pulse.datetimeStart, pulse.interval);
    return now > end;
  };

  const getPulseStatus = () => {
    if (isPulseActive()) {
      return { status: 'Active', className: 'bg-green-100 text-green-800' };
    } else if (isPulseEnded()) {
      return { status: 'Ended', className: 'bg-gray-100 text-gray-800' };
    } else {
      return { status: 'Scheduled', className: 'bg-blue-100 text-blue-800' };
    }
  };

  const pulseStatus = getPulseStatus();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setLocation(isAdmin ? '/admin' : '/')}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isAdmin ? 'Back to Admin' : 'Back to Pulses'}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pulse Detail</h1>
            <p className="text-gray-600">
              {isAdmin ? 'Manage executions and attestations' : 'View pulse information and execution status'}
            </p>
          </div>
        </div>
      </div>

      {/* Pulse Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-semibold">PULSE #{pulse.id}</h2>
              <span className={`px-3 py-1 text-sm rounded-full font-medium ${pulseStatus.className}`}>
                {pulseStatus.status}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-4">{pulse.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Start Time</div>
              <div className="font-medium">{formatDateTime(pulse.datetimeStart)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Duration</div>
              <div className="font-medium">{pulse.interval} hours</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-5 flex items-center justify-center bg-purple-100 rounded text-purple-600 text-xs font-bold">
              P
            </div>
            <div>
              <div className="text-sm text-gray-500">Points Reward</div>
              <div className="font-medium">{pulse.points} points</div>
            </div>
          </div>
        </div>

        {pulse.urlEmbed && (
          <div className="mt-6 pt-6 border-t">
            <div className="text-sm text-gray-500 mb-2">Source Post</div>
            <a
              href={pulse.urlEmbed}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 break-all flex items-center gap-2"
            >
              {pulse.urlEmbed}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {/* Pulse Executions Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <PulseExecutionsTable
          pulse={pulse}
          executions={executions}
          profile={profile}
          onRefresh={() => refetch()}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}