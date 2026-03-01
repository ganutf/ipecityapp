import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Pulse } from "@shared/schema";
import type { PulsesResponse, SignerResponse, ExecutionDetailsResponse } from "@shared/types";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, History, CheckCircle2, Users, Trophy } from "lucide-react";
import { PulseCard } from "@/components/PulseCard";
import { PostTool } from "@/components/pulse";
import { hasUserExecuted, extractExecutionStatus } from "@/lib/pulseUtils";

export default function PulseDashboard() {
  const {
    isAuthenticated,
    member,
    memberId,
    isMember,
    isLoading: authLoading,
  } = useAuth();
  const [, setLocation] = useLocation();

  // Authentication check - redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
      return;
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Tab state for pulse organization
  const [activeTab, setActiveTab] = useState("upcoming");

  // Check if user is admin based on memberType from auth context
  const isAdmin = member?.memberType === 'admin';

  const {
    data: signerData,
    isLoading: signerLoading,
    refetch: refetchSigner,
  } = useQuery<SignerResponse>({
    queryKey: queryKeys.signers.byMember(memberId),
    queryFn: () => authenticatedGet("/api/v2/farcaster/signer"),
    enabled: Boolean(
      isAuthenticated &&
      !!memberId &&
      isMember &&
      !authLoading,
    ),
    staleTime: 1000, // Keep data fresh
    refetchInterval: (query) => {
      // Poll every 2 seconds if signer is pending approval, otherwise don't poll
      const needsPolling =
        query.state.data?.status === "pending_approval" ||
        query.state.data?.status === "generated";
      return needsPolling ? 2000 : false;
    },
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const signerUuid = signerData?.signer_uuid || null;
  const signerStatus = signerData?.status || "pending_approval";
  const approvalUrl = signerData?.signer_approval_url;

  // QR code generation is now handled by the dedicated /signer-approval page

  // Get all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery<PulsesResponse>({
    queryKey: queryKeys.pulses.list(),
    queryFn: () => authenticatedGet("/api/v2/pulses"),
    enabled: Boolean(
      isAuthenticated && isMember && !authLoading,
    ),
    retry: 2, // Limit retries
    staleTime: 2 * 60 * 1000, // 2 minutes for more dynamic data
    refetchOnWindowFocus: false,
  });

  // Get user's executions with detailed information including attestations
  const { data: executionsData, isLoading: executionsLoading, error: executionsError } = useQuery<ExecutionDetailsResponse>({
    queryKey: queryKeys.executions.details(memberId),
    queryFn: () => authenticatedGet(`/api/v2/executions/${memberId}/details`),
    enabled: Boolean(
      isAuthenticated &&
      !!memberId &&
      !authLoading,
    ),
    retry: (failureCount, error) => {
      // Don't retry on authentication errors (401) or forbidden (403)
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }
      // Only retry up to 2 times for other errors
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });

  // Helper functions for date comparison
  const isToday = (date: string | Date) => {
    const today = new Date();
    const pulseDate = new Date(date);

    // Normalize both dates to compare only the date part (YYYY-MM-DD)
    const todayStr = today.toISOString().split("T")[0];
    const pulseDateStr = pulseDate.toISOString().split("T")[0];

    return todayStr === pulseDateStr;
  };

  const isPastDate = (date: string | Date) => {
    const today = new Date();
    const pulseDate = new Date(date);

    // Normalize both dates to compare only the date part (YYYY-MM-DD)
    const todayStr = today.toISOString().split("T")[0];
    const pulseDateStr = pulseDate.toISOString().split("T")[0];

    return pulseDateStr < todayStr;
  };

  // Calculate total points earned from all executions
  const totalPoints = executionsData?.executionDetails?.reduce(
    (total: number, detail) => total + (detail.execution ? detail.pointsEarned : 0),
    0
  ) || 0;

  const getUserExecutionStatus = (pulseId: number) => {
    return extractExecutionStatus(executionsData, pulseId);
  };

  // Find today's active pulse
  const activePulse = pulsesData?.pulses?.find((pulse: Pulse) => {
    const now = new Date();
    const pulseStart = new Date(pulse.datetimeStart);
    const pulseEnd = new Date(pulseStart.getTime() + (pulse.interval || 24) * 60 * 60 * 1000);
    return now >= pulseStart && now <= pulseEnd;
  });

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Initializing...</p>
        </div>
      </div>
    );
  }

  // Authentication is now handled by AuthGuard at the route level
  // This component assumes the user is authenticated

  // Signer approval is now handled by the dedicated /signer-approval route
  // AuthGuard will redirect users to /signer-approval when needed

  // Verification status and routing is now handled by AuthGuard
  // AuthGuard will redirect users to appropriate verification pages

  if (
    authLoading ||
    (isAuthenticated &&
      isMember &&
      (pulsesLoading || executionsLoading))
  ) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading pulse data...</p>
        </div>
      </div>
    );
  }

  // Show authentication error if executions loading failed
  if (executionsError && (executionsError as Error).message.includes('401')) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">
            Authentication error occurred. Please refresh the page and sign in again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Active Pulse Section */}
      {activePulse ? (
        <div className="mb-12 flex justify-center">
          <div className="w-full max-w-lg">
            <PostTool
              pulse={activePulse}
              member={member!}
              signerUuid={signerUuid}
            />
          </div>
        </div>
      ) : (
        <div className="mb-12 flex justify-center">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center max-w-lg">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              No Active Pulse Today
            </h2>
            <p className="text-gray-600">
              Check back tomorrow for new community engagement activities!
            </p>
          </div>
        </div>
      )}

      {/* Pulse Tabs Section */}
      {pulsesData?.pulses?.length && pulsesData.pulses.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Community Pulses</span>
              </CardTitle>
              {totalPoints > 0 && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-lime-50 border border-lime-200 rounded-full">
                  <Trophy className="h-4 w-4 text-lime-600" />
                  <span className="text-lime-700 font-semibold text-sm">
                    {totalPoints} Points
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upcoming" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming ({(() => {
                    const upcomingPulses = pulsesData!.pulses.filter((pulse: Pulse) => {
                      const now = new Date();
                      const pulseStart = new Date(pulse.datetimeStart);
                      return pulseStart > now;
                    });
                    return upcomingPulses.length;
                  })()})
                </TabsTrigger>
                <TabsTrigger value="past" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Past ({(() => {
                    const pastPulses = pulsesData!.pulses.filter((pulse: Pulse) =>
                      !isToday(pulse.datetimeStart) && isPastDate(pulse.datetimeStart)
                    );
                    return pastPulses.length;
                  })()})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  My Completed ({(() => {
                    const completedPulses = pulsesData!.pulses.filter((pulse: Pulse) => {
                      const isPast = !isToday(pulse.datetimeStart) && isPastDate(pulse.datetimeStart);
                      const executionStatus = getUserExecutionStatus(pulse.id);
                      return isPast && hasUserExecuted(executionStatus);
                    });
                    return completedPulses.length;
                  })()})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-6">
                {(() => {
                  const upcomingPulses = pulsesData!.pulses
                    .filter((pulse: Pulse) => {
                      const now = new Date();
                      const pulseStart = new Date(pulse.datetimeStart);
                      return pulseStart > now;
                    })
                    .sort((a: Pulse, b: Pulse) =>
                      new Date(a.datetimeStart).getTime() - new Date(b.datetimeStart).getTime()
                    );

                  if (upcomingPulses.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No upcoming pulses scheduled</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {upcomingPulses.map((pulse: Pulse) => (
                        <PulseCard
                          key={pulse.id}
                          pulse={pulse}
                          clickable={true}
                          isAdmin={isAdmin}
                          className="border-blue-200 bg-blue-50"
                        />
                      ))}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="past" className="mt-6">
                {(() => {
                  const pastPulses = pulsesData!.pulses
                    .filter((pulse: Pulse) =>
                      !isToday(pulse.datetimeStart) && isPastDate(pulse.datetimeStart)
                    )
                    .sort((a: Pulse, b: Pulse) => new Date(b.datetimeStart).getTime() - new Date(a.datetimeStart).getTime());

                  if (pastPulses.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No past pulses available</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {pastPulses.map((pulse: Pulse) => {
                        const executionStatus = getUserExecutionStatus(pulse.id);

                        return (
                          <PulseCard
                            key={pulse.id}
                            pulse={pulse}
                            executionStatus={executionStatus}
                            showExecutionStatus={true}
                            clickable={true}
                            isAdmin={isAdmin}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="completed" className="mt-6">
                {(() => {
                  const completedPulses = pulsesData!.pulses
                    .filter((pulse: Pulse) => {
                      const isPast = !isToday(pulse.datetimeStart) && isPastDate(pulse.datetimeStart);
                      const executionStatus = getUserExecutionStatus(pulse.id);
                      return isPast && hasUserExecuted(executionStatus);
                    })
                    .sort((a: Pulse, b: Pulse) => new Date(b.datetimeStart).getTime() - new Date(a.datetimeStart).getTime());

                  if (completedPulses.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p>No completed pulses yet</p>
                        <p className="text-sm mt-1">Start participating in pulses to see your activity here!</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {completedPulses.map((pulse: Pulse) => {
                        const executionStatus = getUserExecutionStatus(pulse.id);

                        return (
                          <PulseCard
                            key={pulse.id}
                            pulse={pulse}
                            executionStatus={executionStatus}
                            showExecutionStatus={true}
                            clickable={true}
                            isAdmin={isAdmin}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
