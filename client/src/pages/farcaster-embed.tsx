import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { Pulse, Member } from "@shared/schema";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet } from "@/lib/api";
import { getEasScanUrl } from "@/lib/easUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, History, CheckCircle2, Users, Trophy, Heart, Repeat, Ban, X, ArrowRight, CheckCircle, XCircle, Target } from "lucide-react";
import { PulseCard } from "@/components/PulseCard";
import { getCardAccentColor, hasUserExecuted, extractExecutionStatus, getPulseTimingInfo } from "@/lib/pulseUtils";

// Helper functions for contextual timing information
const formatTimeDifference = (diffMs: number): string => {
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
};

const getContextualTimingInfo = (pulse: Pulse, currentTime: Date = new Date()) => {
  const startTime = new Date((pulse as any).datetimeStart);
  const endTime = new Date(startTime.getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000);

  const isEnded = currentTime >= endTime;
  const isActive = currentTime >= startTime && currentTime < endTime;
  const isFuture = currentTime < startTime;

  if (isFuture) {
    const timeUntilStart = formatTimeDifference(startTime.getTime() - currentTime.getTime());
    const duration = (pulse as any).interval || 24;
    return `⏰ Starts in ${timeUntilStart} • Duration: ${duration}h`;
  }

  if (isActive) {
    const timeStarted = formatTimeDifference(currentTime.getTime() - startTime.getTime());
    const timeRemaining = formatTimeDifference(endTime.getTime() - currentTime.getTime());
    return `🔥 Started ${timeStarted} ago • ${timeRemaining} remaining`;
  }

  // Ended
  const timeEnded = formatTimeDifference(currentTime.getTime() - endTime.getTime());
  const duration = (pulse as any).interval || 24;
  return `✅ Ended ${timeEnded} ago • Was active for ${duration}h`;
};

const getActivePulseTimingInfo = (pulse: Pulse, currentTime: Date = new Date()) => {
  const startTime = new Date((pulse as any).datetimeStart);
  const endTime = new Date(startTime.getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000);
  const timeRemaining = formatTimeDifference(endTime.getTime() - currentTime.getTime());

  const startDateStr = startTime.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `Started ${startDateStr} • ${timeRemaining} remaining`;
};

// below your other imports / constants
const SIGNER_KEY = "ipe.signer"; // ← NEW: cache for signer_uuid

export default function FarcasterEmbed() {
  const {
    isAuthenticated,
    profile,
    isLoading: authLoading,
  } = usePersistentAuth();
  // QR code state removed - handled by /signer-approval page

  // Tab state for pulse organization
  const [activeTab, setActiveTab] = useState("upcoming");

  const viewerFid = profile?.fid;
  const queryClient = useQueryClient();

  // Only proceed with queries if we have a valid FID
  const hasValidFid =
    !!viewerFid && typeof viewerFid === "number" && !isNaN(viewerFid);

  // Check if user is approved member
  const { data: memberCheck } = useQuery({
    queryKey: [`/api/members/check/${viewerFid}`],
    enabled: Boolean(isAuthenticated && hasValidFid && !authLoading),
    retry: 2, // Limit retries
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Check if user is admin based on memberType
  const isAdmin = (memberCheck as any)?.member?.memberType === 'admin';

  const {
    data: signerData,
    isLoading: signerLoading,
    refetch: refetchSigner,
  } = useQuery({
    queryKey: [`/api/neynar/signer/${viewerFid}`],
    enabled: Boolean(
      isAuthenticated &&
      !!viewerFid &&
      (memberCheck as any)?.isMember &&
      !authLoading,
    ),
    staleTime: 1000, // Keep data fresh
    refetchInterval: (data) => {
      // Poll every 2 seconds if signer is pending approval, otherwise don't poll
      const needsPolling =
        (data as any)?.status === "pending_approval" ||
        (data as any)?.status === "generated";
      return needsPolling ? 2000 : false;
    },
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const signerUuid = (signerData as any)?.signer_uuid || null;
  const signerStatus = (signerData as any)?.status || "pending_approval";
  const approvalUrl = (signerData as any)?.signer_approval_url;

  // QR code generation is now handled by the dedicated /signer-approval page

  // Get all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: Boolean(
      isAuthenticated && (memberCheck as any)?.isMember && !authLoading,
    ),
    retry: 2, // Limit retries
    staleTime: 2 * 60 * 1000, // 2 minutes for more dynamic data
    refetchOnWindowFocus: false,
  });

  // Get user's executions with detailed information including attestations
  const { data: executionsData, isLoading: executionsLoading, error: executionsError } = useQuery({
    queryKey: [`/api/executions/${(memberCheck as any)?.member?.id}/details`],
    queryFn: () => authenticatedGet(`/api/executions/${(memberCheck as any)?.member?.id}/details`, viewerFid),
    enabled: Boolean(
      isAuthenticated &&
      hasValidFid &&
      (memberCheck as any)?.member?.id &&
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
  const isToday = (date: string) => {
    const today = new Date();
    const pulseDate = new Date(date);

    // Normalize both dates to compare only the date part (YYYY-MM-DD)
    const todayStr = today.toISOString().split("T")[0];
    const pulseDateStr = pulseDate.toISOString().split("T")[0];

    return todayStr === pulseDateStr;
  };

  const isPastDate = (date: string) => {
    const today = new Date();
    const pulseDate = new Date(date);

    // Normalize both dates to compare only the date part (YYYY-MM-DD)
    const todayStr = today.toISOString().split("T")[0];
    const pulseDateStr = pulseDate.toISOString().split("T")[0];

    return pulseDateStr < todayStr;
  };

  // Calculate total points earned from all executions
  const totalPoints = (executionsData as any)?.executionDetails?.reduce(
    (total: number, detail: any) => total + (detail.execution ? detail.pointsEarned : 0),
    0
  ) || 0;

  const getUserExecutionStatus = (pulseId: number) => {
    return extractExecutionStatus(executionsData, pulseId);
  };

  // Find today's active pulse
  const activePulse = (pulsesData as any)?.pulses?.find((pulse: Pulse) => {
    const now = new Date();
    const pulseStart = new Date((pulse as any).datetimeStart);
    const pulseEnd = new Date(pulseStart.getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000);
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

  // This component is now for authenticated users only
  // Unauthenticated users should be handled by the HomePage component
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  // Signer approval is now handled by the dedicated /signer-approval route
  // AuthGuard will redirect users to /signer-approval when needed

  // Verification status and routing is now handled by AuthGuard
  // AuthGuard will redirect users to appropriate verification pages

  if (
    authLoading ||
    (isAuthenticated &&
      hasValidFid &&
      (!memberCheck || pulsesLoading || executionsLoading))
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
              member={(memberCheck as any)?.member}
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
      {(pulsesData as any)?.pulses?.length > 0 && (
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
                    const upcomingPulses = (pulsesData as any).pulses.filter((pulse: Pulse) => {
                      const now = new Date();
                      const pulseStart = new Date((pulse as any).datetimeStart);
                      return pulseStart > now;
                    });
                    return upcomingPulses.length;
                  })()})
                </TabsTrigger>
                <TabsTrigger value="past" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Past ({(() => {
                    const pastPulses = (pulsesData as any).pulses.filter((pulse: Pulse) =>
                      !isToday((pulse as any).datetimeStart) && isPastDate((pulse as any).datetimeStart)
                    );
                    return pastPulses.length;
                  })()})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  My Completed ({(() => {
                    const completedPulses = (pulsesData as any).pulses.filter((pulse: Pulse) => {
                      const isPast = !isToday((pulse as any).datetimeStart) && isPastDate((pulse as any).datetimeStart);
                      const executionStatus = getUserExecutionStatus(pulse.id);
                      return isPast && hasUserExecuted(executionStatus);
                    });
                    return completedPulses.length;
                  })()})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="mt-6">
                {(() => {
                  const upcomingPulses = (pulsesData as any).pulses
                    .filter((pulse: Pulse) => {
                      const now = new Date();
                      const pulseStart = new Date((pulse as any).datetimeStart);
                      return pulseStart > now;
                    })
                    .sort((a: Pulse, b: Pulse) =>
                      new Date((a as any).datetimeStart).getTime() - new Date((b as any).datetimeStart).getTime()
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
                  const pastPulses = (pulsesData as any).pulses
                    .filter((pulse: Pulse) =>
                      !isToday((pulse as any).datetimeStart) && isPastDate((pulse as any).datetimeStart)
                    )
                    .sort((a: Pulse, b: Pulse) => (b as any).datetimeStart.localeCompare((a as any).datetimeStart));

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
                  const completedPulses = (pulsesData as any).pulses
                    .filter((pulse: Pulse) => {
                      const isPast = !isToday((pulse as any).datetimeStart) && isPastDate((pulse as any).datetimeStart);
                      const executionStatus = getUserExecutionStatus(pulse.id);
                      return isPast && hasUserExecuted(executionStatus);
                    })
                    .sort((a: Pulse, b: Pulse) => (b as any).datetimeStart.localeCompare((a as any).datetimeStart));

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

function PostTool({
  pulse,
  member,
  signerUuid,
}: {
  pulse: Pulse;
  member: Member;
  signerUuid: string | null;
}) {
  const { profile } = usePersistentAuth();
  const viewerFid = profile?.fid;
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get user's executions for this component
  const { data: executionsData, error: componentExecutionsError } = useQuery({
    queryKey: [`/api/executions/by-fid/${viewerFid}`],
    queryFn: () => authenticatedGet(`/api/executions/by-fid/${viewerFid}`, viewerFid),
    enabled: Boolean(viewerFid),
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

  // Show authentication error if present
  if (componentExecutionsError && (componentExecutionsError as Error).message.includes('401')) {
    return (
      <div className="w-full max-w-lg bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700 text-sm">
          Authentication required. Please refresh the page and sign in again.
        </p>
      </div>
    );
  }

  // Helper function to get execution status for this component
  const getUserExecutionStatus = (pulseId: number) => {
    return extractExecutionStatus(executionsData, pulseId);
  };

  // Track execution status for pulse actions - initialize with current status
  const currentExecutionStatus = getUserExecutionStatus(pulse.id);
  const [executionStatus, setExecutionStatus] = useState<{
    liked: boolean;
    shared: boolean;
    abstained: boolean;
  }>(currentExecutionStatus);

  // Update execution status when data changes
  useEffect(() => {
    const status = getUserExecutionStatus(pulse.id);
    setExecutionStatus(status);
  }, [executionsData, pulse.id]);

  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<null | {
    liked: boolean;
    recasted: boolean;
    quotedRecast: boolean;
    regularRecast: boolean;
  }>(null);

  const [castData, setCastData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{
    like: boolean;
    recast: boolean;
    abstain: boolean;
  }>({ like: false, recast: false, abstain: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Circuit breaker state for preventing infinite loops
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);
  const [isCircuitOpen, setIsCircuitOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const MAX_RETRIES = 3;
  const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

  // Update countdown timer when circuit breaker is open
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCircuitOpen && lastFailureTime) {
      interval = setInterval(() => {
        const timeLeft = Math.ceil((CIRCUIT_BREAKER_TIMEOUT - (Date.now() - lastFailureTime)) / 1000);
        setCountdown(Math.max(0, timeLeft));

        if (timeLeft <= 0) {
          setIsCircuitOpen(false);
          setRetryCount(0);
          setLastFailureTime(null);
          setCountdown(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCircuitOpen, lastFailureTime]);

  // Record pulse execution mutation
  const recordExecutionMutation = useMutation({
    mutationFn: async ({ actions }: { actions: { liked: boolean; shared: boolean; abstained: boolean } }) => {
      if (!viewerFid) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/executions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-farcaster-fid": viewerFid.toString(),
        },
        body: JSON.stringify({
          pulseId: pulse.id,
          actions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to record execution");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related cache keys for pulse execution data
      queryClient.invalidateQueries({ queryKey: [`/api/executions/${member?.id}/details`] });
      queryClient.invalidateQueries({ queryKey: [`/api/executions/by-fid/${viewerFid}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      // Also invalidate the specific pulse execution endpoint
      queryClient.invalidateQueries({ queryKey: [`/api/pulse/${pulse.id}/executions`] });
    },
  });

  // Handle pulse-specific actions (separate from Farcaster interactions)
  async function handlePulseAction(action: 'like' | 'share' | 'abstain') {
    if (!pulse) return;

    setActionLoading(prev => ({ ...prev, [action === 'share' ? 'recast' : action]: true }));

    try {
      // Update execution status based on action
      let newActions = { ...executionStatus };

      if (action === 'abstain') {
        // Toggle abstain - if already abstained, cancel it and reset to default state
        if (executionStatus.abstained) {
          newActions = { liked: false, shared: false, abstained: false };
        } else {
          // Abstain is exclusive - clear other actions
          newActions = { liked: false, shared: false, abstained: true };
        }
      } else {
        // Like or share - clear abstain and toggle the specific action
        newActions = {
          ...executionStatus,
          abstained: false,
          [action === 'share' ? 'shared' : 'liked']: !executionStatus[action === 'share' ? 'shared' : 'liked']
        };
      }

      // Record the execution in database
      await recordExecutionMutation.mutateAsync({ actions: newActions });

      // Update local state
      setExecutionStatus(newActions);

      const actionName = action === 'share' ? 'shared' : action === 'like' ? 'liked' : 'abstained';
      setSuccessMessage(`Pulse ${actionName} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error) {
      console.error(`Error recording pulse ${action}:`, error);
      setError(
        `Failed to record pulse ${action}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading(prev => ({ ...prev, [action === 'share' ? 'recast' : action]: false }));
    }
  }

  async function checkQuoteRecast(
    castHash: string,
    viewerFid: number,
  ): Promise<boolean> {
    try {
      const quoteRes = await fetch(
        `/api/neynar/cast/${castHash}/quotes/${viewerFid}`,
      );
      if (quoteRes.ok) {
        const { hasQuoted } = await quoteRes.json();
        console.log("Quote status:", hasQuoted);
        return hasQuoted;
      }
    } catch (error) {
      console.error("Error checking quote status:", error);
    }
    return false;
  }


  // Circuit breaker helper function
  const checkCircuitBreaker = () => {
    const now = Date.now();

    // If circuit is open, check if timeout has passed
    if (isCircuitOpen && lastFailureTime) {
      if (now - lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
        console.log("Circuit breaker timeout expired, resetting");
        setIsCircuitOpen(false);
        setRetryCount(0);
        setLastFailureTime(null);
        return false; // Circuit is now closed
      }
      return true; // Circuit is still open
    }

    return false; // Circuit is closed
  };

  // Sync execution status with Farcaster reality
  async function syncExecutionWithFarcaster(farcasterLiked: boolean, farcasterShared: boolean) {
    // Only sync if pulse is active (reuse existing utility)
    const timingInfo = getPulseTimingInfo(pulse.datetimeStart, pulse.interval);
    if (!timingInfo.isActive) {
      console.log("Pulse not active, skipping sync");
      return;
    }
    
    console.log("=== FARCASTER SYNC DEBUG ===");
    console.log("1. Input from Farcaster:", { farcasterLiked, farcasterShared });
    console.log("2. Current executionStatus state (potentially stale):", executionStatus);
    
    // Get fresh execution status directly from data source
    const freshExecutionStatus = getUserExecutionStatus(pulse.id);
    console.log("3. Fresh execution status from database:", freshExecutionStatus);
    
    // Compare with current database execution status (use fresh data)
    const dbLiked = freshExecutionStatus.liked;
    const dbShared = freshExecutionStatus.shared;
    const dbAbstained = freshExecutionStatus.abstained;
    
    // Determine what the database should be based on Farcaster
    const shouldHaveExecution = farcasterLiked || farcasterShared;
    const hasExecution = dbLiked || dbShared || dbAbstained;
    
    console.log("4. Computed values:", {
      shouldHaveExecution,
      hasExecution,
      dbLiked,
      dbShared, 
      dbAbstained
    });
    
    let targetActions = null;
    
    if (shouldHaveExecution) {
      console.log("5. Branch: shouldHaveExecution = true");
      // User has actions on Farcaster, ensure database matches
      targetActions = {
        liked: farcasterLiked,
        shared: farcasterShared,
        abstained: false
      };
    } else if (hasExecution && !dbAbstained) {
      console.log("5. Branch: hasExecution && !dbAbstained = true");
      // User has no Farcaster actions but has database execution (not abstain)
      // Delete the execution by setting all actions to false
      targetActions = {
        liked: false,
        shared: false,
        abstained: false
      };
    } else {
      console.log("5. Branch: No action needed");
    }
    
    console.log("6. Target actions:", targetActions);
    
    const needsUpdate = targetActions && 
        (targetActions.liked !== dbLiked || 
         targetActions.shared !== dbShared || 
         targetActions.abstained !== dbAbstained);
         
    console.log("7. Needs update?", needsUpdate);
    console.log("=== END FARCASTER SYNC DEBUG ===");
    
    // Only update if different from current state
    if (needsUpdate && targetActions) {
      try {
        console.log("EXECUTING SYNC: Updating database with Farcaster status:", targetActions);
        // Reuse existing mutation and action handling
        await recordExecutionMutation.mutateAsync({ actions: targetActions });
        setExecutionStatus(targetActions);
        
        const hasAnyAction = targetActions.liked || targetActions.shared || targetActions.abstained;
        if (hasAnyAction) {
          setSuccessMessage("Pulse status synchronized with Farcaster");
        } else {
          setSuccessMessage("Pulse execution removed (no Farcaster actions found)");
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Sync with Farcaster failed:', error);
        // Fail silently, don't disrupt user experience
      }
    }
  }

  async function handleCheck() {
    if (!(pulse as any).urlEmbed || !viewerFid) return;

    // Check circuit breaker
    if (checkCircuitBreaker()) {
      console.log("Circuit breaker is open, skipping cast check");
      setError(`Cast checking temporarily disabled due to repeated failures. Will retry in ${Math.ceil((CIRCUIT_BREAKER_TIMEOUT - (Date.now() - (lastFailureTime || 0))) / 1000)} seconds.`);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      console.log("Checking cast:", (pulse as any).urlEmbed, "for viewer:", viewerFid);

      const res = await fetch(
        `/api/neynar/cast/${encodeURIComponent((pulse as any).urlEmbed)}/${viewerFid}?type=url`,
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${res.status}`);
      }

      const { cast } = await res.json();
      setCastData(cast);

      const regularRecast = !!cast.viewer_context?.recasted;
      const liked = !!cast.viewer_context?.liked;
      const quotedRecast = cast.hash
        ? await checkQuoteRecast(cast.hash, viewerFid)
        : false;

      setStats({
        liked: liked,
        recasted: regularRecast || quotedRecast,
        regularRecast: regularRecast,
        quotedRecast: quotedRecast,
      });

      // Sync execution status with Farcaster reality
      await syncExecutionWithFarcaster(liked, regularRecast || quotedRecast);

      // Reset circuit breaker on success
      setRetryCount(0);
      setLastFailureTime(null);
      setIsCircuitOpen(false);

      console.log("Cast check successful");
    } catch (error) {
      console.error("Error fetching cast:", error);

      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setLastFailureTime(Date.now());

      // Open circuit breaker if max retries exceeded
      if (newRetryCount >= MAX_RETRIES) {
        console.warn(`Circuit breaker opening after ${MAX_RETRIES} failures`);
        setIsCircuitOpen(true);
        setError(
          `Failed to load cast data after ${MAX_RETRIES} attempts. Please check your connection and try again later.`
        );
      } else {
        setError(
          `Failed to fetch cast (attempt ${newRetryCount}/${MAX_RETRIES}): ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(type: "like" | "recast") {
    if (!castData || !viewerFid || !signerUuid) return;

    setActionLoading((prev) => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const signer_uuid = signerUuid;

      if (type === "like") {
        const response = await fetch("/api/neynar/reaction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-farcaster-fid": viewerFid.toString(),
          },
          body: JSON.stringify({
            signer_uuid: signer_uuid,
            reaction_type: "like",
            target: castData.hash,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Like failed: ${errorData.message || "API Error"}`);
        }
      } else if (type === "recast") {
        const response = await fetch("/api/neynar/cast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-farcaster-fid": viewerFid.toString(),
          },
          body: JSON.stringify({
            signer_uuid: signer_uuid,
            text: "",
            embeds: [
              {
                cast_id: {
                  hash: castData.hash,
                  fid: castData.author.fid,
                },
              },
            ],
          }),
        });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error(
              "API authentication failed. Please check your Neynar API key configuration.",
            );
          }
          throw new Error(
            `Recast failed: ${responseData.message || "API Error"}`,
          );
        }
      }

      if (type === "like") {
        setStats((prev) =>
          prev
            ? {
              ...prev,
              liked: !prev.liked,
            }
            : null,
        );
        // Record pulse action for like
        if (pulse) {
          await handlePulseAction('like');
        }
      } else if (type === "recast") {
        setStats((prev) =>
          prev
            ? {
              ...prev,
              recasted: true,
              regularRecast: true,
              quotedRecast: prev.quotedRecast,
            }
            : null,
        );
        // Record pulse action for share
        if (pulse) {
          await handlePulseAction('share');
        }
      }

      setSuccessMessage(`Post ${type}d successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

      // Only retry if circuit breaker is not open and we haven't had recent failures
      if (!isCircuitOpen && retryCount === 0) {
        setTimeout(() => handleCheck(), 2000);
      } else {
        console.log("Skipping automatic retry due to circuit breaker or recent failures");
      }
    } catch (error) {
      console.error(`Error ${type}ing cast:`, error);
      setError(
        `Failed to ${type} post: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [type]: false }));
    }
  }


  // Auto-load the current pulse
  useEffect(() => {
    if ((pulse as any).urlEmbed && viewerFid && !isCircuitOpen) {
      // Add a delay to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        handleCheck();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [(pulse as any).urlEmbed, viewerFid]);

  const handleHeaderClick = () => {
    setLocation(`/pulse/${pulse.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHeaderClick();
    }
  };

  // Check if pulse has been executed using shared utility
  const hasExecution = hasUserExecuted(executionStatus);
  
  // Get execution status display (matching PulseCard logic)
  const getExecutionDisplay = () => {
    if (!hasExecution) {
      return (
        <div className="flex items-center justify-center py-2 px-4 bg-red-50 border border-red-200 rounded-lg mt-4">
          <XCircle className="h-4 w-4 text-red-500 mr-2" />
          <span className="text-red-700 font-medium text-sm">Not Executed</span>
        </div>
      );
    }
    
    const actions = [];
    if (executionStatus.liked) actions.push("Liked");
    if (executionStatus.shared) actions.push("Shared");
    if (executionStatus.abstained) actions.push("Abstained");
    
    return (
      <div className="flex items-center justify-between py-2 px-4 bg-green-50 border border-green-200 rounded-lg mt-4">
        <div className="flex items-center">
          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
          <span className="text-green-700 font-medium text-sm">
            Executed - {actions.join("/") || "Completed"}
          </span>
        </div>
        <div className="flex items-center text-purple-600">
          <Target className="h-4 w-4 mr-2" />
          <span className="font-semibold">{pulse.points} points</span>
        </div>
      </div>
    );
  };

  // Get container border accent color using shared utility
  const getContainerBorderColor = () => {
    return getCardAccentColor(executionStatus, pulse.datetimeStart, pulse.interval);
  };

  return (
    <div className={`w-full max-w-lg bg-white border border-gray-200 shadow rounded-xl border-l-4 ${getContainerBorderColor()}`}>
      <div 
        className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl cursor-pointer hover:bg-gray-100 transition-colors duration-200"
        onClick={handleHeaderClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View details for Pulse #${pulse.id}`}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-between">
          <span className="flex items-center">
            🎯 PULSE #{pulse.id} - Active Now
          </span>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </h2>
        <p className="text-gray-700 text-sm mb-2">{pulse.description}</p>
        <p className="text-sm font-medium text-gray-600 mb-2">
          {getActivePulseTimingInfo(pulse)}
        </p>
      </div>

      {/* Execution Status Display */}
      <div className="px-6">
        {getExecutionDisplay()}
      </div>

      <div className="p-6">
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex justify-between items-start">
              <p className="text-sm text-red-700 flex-1">{error}</p>
              {isCircuitOpen ? (
                <div className="ml-2 text-xs text-red-500">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Retry in {countdown}s</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    handleCheck();
                  }}
                  className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-lime-50 border border-lime-200 rounded-lg">
            <p className="text-sm text-lime-700">{successMessage}</p>
          </div>
        )}


        {checking && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-blue-700">Loading post...</p>
          </div>
        )}

        {castData && (
          <div className="mt-6 p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <img
                src={castData.author.pfp_url}
                alt={castData.author.display_name}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold">{castData.author.display_name}</p>
                <p className="text-sm text-gray-500">
                  @{castData.author.username}
                </p>
              </div>
            </div>
            <p className="text-gray-800 mb-4">{castData.text}</p>

            {castData.embeds && castData.embeds.length > 0 && (
              <div className="mb-4">
                {castData.embeds.map(
                  (embed: any, index: number) =>
                    embed.url &&
                    embed.url.match(/\.(jpeg|jpg|gif|png)$/i) && (
                      <img
                        key={index}
                        src={embed.url}
                        alt="Embedded content"
                        className="max-w-full h-auto rounded-lg mb-2"
                      />
                    ),
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>❤️ {castData.reactions.likes_count}</span>
                <span>🔄 {castData.reactions.recasts_count}</span>
                <span>💬 {castData.replies.count}</span>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleReaction("like")}
                  disabled={actionLoading.like || executionStatus.abstained}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${stats?.liked
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700 hover:bg-red-50"
                    }`}
                >
                  {actionLoading.like ? (
                    "⏳ Liking..."
                  ) : (
                    <span className="flex items-center">
                      <Heart className={`h-4 w-4 mr-1 ${stats?.liked ? "text-red-600" : "text-gray-500"}`} />
                      {stats?.liked ? "Liked" : "Like"}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleReaction("recast")}
                  disabled={actionLoading.recast || executionStatus.abstained}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${stats?.recasted
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700 hover:bg-blue-50"
                    }`}
                >
                  {actionLoading.recast ? (
                    "⏳ Recasting..."
                  ) : (
                    <span className="flex items-center">
                      <Repeat className={`h-4 w-4 mr-1 ${stats?.recasted ? "text-blue-600" : "text-gray-500"}`} />
                      {stats?.recasted ? "Shared" : "Share"}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handlePulseAction('abstain')}
                  disabled={actionLoading.abstain || (stats?.liked || stats?.recasted)}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${executionStatus.abstained
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700 hover:bg-yellow-50"
                    }`}
                >
                  {actionLoading.abstain ? (
                    "⏳ Recording..."
                  ) : (
                    <span className="flex items-center">
                      {executionStatus.abstained ? (
                        <X className="h-4 w-4 mr-1 text-yellow-600" />
                      ) : (
                        <Ban className="h-4 w-4 mr-1 text-gray-500" />
                      )}
                      {executionStatus.abstained ? "Cancel" : "Abstain"}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
