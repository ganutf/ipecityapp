import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet } from "@/lib/api";
import { getPulseTimingInfo } from "@/lib/pulseUtils";
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
    enabled: Boolean(profile?.fid),
  });

  // Check if user is admin based on memberType
  const isAdmin = (currentMemberData as any)?.member?.memberType === 'admin';

  // Fetch pulse execution data
  const { data: pulseData, isLoading: pulseLoading, refetch } = useQuery({
    queryKey: [`/api/pulse/${pulseId}/executions`],
    queryFn: () => authenticatedGet(`/api/pulse/${pulseId}/executions`, profile?.fid),
    enabled: Boolean(isAuthenticated && isAdmin && profile?.fid && pulseId),
  });

  // Show loading while auth is initializing
  if (isLoading || pulseLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading pulse details...</p>
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

  if (!pulseData || !pulseId) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pulse Not Found</h1>
          <p className="text-gray-600">The requested pulse could not be found.</p>
          <Button
            onClick={() => setLocation('/admin')}
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Dashboard
          </Button>
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

  const getPulseTimingStatus = () => {
    return getPulseTimingInfo(pulse.datetimeStart, pulse.interval);
  };

  const isPulseActive = () => {
    return getPulseTimingStatus().isActive;
  };

  const isPulseEnded = () => {
    return getPulseTimingStatus().isEnded;
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
            onClick={() => setLocation('/admin')}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pulse Detail</h1>
            <p className="text-gray-600">Manage executions and attestations</p>
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
        />
      </div>
    </div>
  );
}