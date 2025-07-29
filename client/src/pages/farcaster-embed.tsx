import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { SignInButton } from "@farcaster/auth-kit";
import type { Pulse, Member } from "@shared/schema";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { authenticatedGet } from "@/lib/api";
import { getEasScanUrl } from "@/lib/easUtils";

// below your other imports / constants
const SIGNER_KEY = "ipe.signer"; // ← NEW: cache for signer_uuid

export default function FarcasterEmbed() {
  const {
    isAuthenticated,
    profile,
    isLoading: authLoading,
  } = usePersistentAuth();
  // QR code state removed - handled by /signer-approval page

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

  const getUserExecutionStatus = (pulseId: number) => {
    if (!(executionsData as any)?.executionDetails)
      return { liked: false, shared: false, abstained: false };

    // Find the execution record for this pulse (new structure has execution details)
    const executionDetail = (executionsData as any).executionDetails.find(
      (detail: any) => detail.pulse.id === pulseId,
    );

    // If no execution found, return default values
    if (!executionDetail || !executionDetail.execution?.actions) {
      return { liked: false, shared: false, abstained: false };
    }

    // Extract actions from the execution
    const actions = executionDetail.execution.actions;
    return {
      liked: actions.liked || false,
      shared: actions.shared || false,
      abstained: actions.abstained || false,
    };
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

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-6 text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Ipê City
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Your community engagement tracking platform
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="space-y-2">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800">Pulse</h3>
              <p className="text-sm text-gray-600">
                Engage in collective activities to help Ipê move forward.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl mb-2">✨</div>
              <h3 className="font-semibold text-gray-800">Collaborate</h3>
              <p className="text-sm text-gray-600">
                Monitor your reputation whitin the community.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl mb-2">🌟</div>
              <h3 className="font-semibold text-gray-800">Connect</h3>
              <p className="text-sm text-gray-600">
                Meet Ipê members and learn about their projects.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">
            Ready to Join?
          </h3>
          <p className="text-purple-700 mb-4">
            Connect your Farcaster account to start participating in community
            pulses
          </p>
          <div className="flex justify-center">
            <SignInButton />
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <p>Ipê City • A Network State community</p>
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
          <PostTool
            pulse={activePulse}
            member={(memberCheck as any)?.member}
            signerUuid={signerUuid}
          />
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

      {/* Upcoming and Previous Pulses */}
      {(pulsesData as any)?.pulses?.length > 0 && (
        <div className="space-y-8">
          {/* Upcoming Pulses */}
          {(() => {
            const upcomingPulses = (pulsesData as any).pulses
              .filter(
                (pulse: Pulse) => {
                  const now = new Date();
                  const pulseStart = new Date((pulse as any).datetimeStart);
                  return pulseStart > now;
                }
              )
              .sort((a: Pulse, b: Pulse) => 
                new Date((a as any).datetimeStart).getTime() - new Date((b as any).datetimeStart).getTime()
              ); // Ascending for upcoming

            return (
              upcomingPulses.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold mb-1 text-blue-700">
                      Upcoming Pulses
                    </h3>
                    <p className="text-gray-600">
                      Future community engagement activities
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {upcomingPulses.map((pulse: Pulse) => {
                        const executionStatus = getUserExecutionStatus(
                          pulse.id,
                        );
                        const past = false;
                        const today = false;

                        return (
                          <div
                            key={pulse.id}
                            className={`border rounded-lg p-4 ${
                              today
                                ? "border-green-300 bg-green-50"
                                : past
                                  ? "border-gray-200 bg-gray-50"
                                  : "border-blue-200 bg-blue-50"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  PULSE #{pulse.id}
                                </h4>
                                <p className="text-gray-600 text-sm mb-2">{pulse.description}</p>
                                <p
                                  className={`text-sm font-medium mb-2 ${
                                    past ? "text-gray-500" : "text-blue-700"
                                  }`}
                                >
                                  {new Date((pulse as any).datetimeStart).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })} - {new Date(new Date((pulse as any).datetimeStart).getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                                <a
                                  href={(pulse as any).urlEmbed}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 break-all"
                                >
                                  {(pulse as any).urlEmbed}
                                </a>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`px-3 py-1 text-sm rounded-full font-medium ${
                                    today
                                      ? "bg-green-100 text-green-800"
                                      : past
                                        ? "bg-gray-100 text-gray-800"
                                        : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {today
                                    ? "Active Today"
                                    : past
                                      ? "Completed"
                                      : "Upcoming"}
                                </span>
                              </div>
                            </div>

                            {/* Execution Status */}
                            {(past || today) && (
                              <div className="flex items-center space-x-6 text-sm">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                      executionStatus.liked
                                        ? "bg-red-500"
                                        : "bg-gray-200 border-2 border-gray-300"
                                    }`}
                                  >
                                    {executionStatus.liked && (
                                      <span className="text-white text-xs font-bold">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`font-medium ${
                                      executionStatus.liked
                                        ? "text-red-600"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {executionStatus.liked
                                      ? "Liked"
                                      : "Like pending"}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                      executionStatus.shared
                                        ? "bg-green-500"
                                        : "bg-gray-200 border-2 border-gray-300"
                                    }`}
                                  >
                                    {executionStatus.shared && (
                                      <span className="text-white text-xs font-bold">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`font-medium ${
                                      executionStatus.shared
                                        ? "text-green-600"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {executionStatus.shared
                                      ? "Shared"
                                      : "Share pending"}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                      executionStatus.abstained
                                        ? "bg-yellow-500"
                                        : "bg-gray-200 border-2 border-gray-300"
                                    }`}
                                  >
                                    {executionStatus.abstained && (
                                      <span className="text-white text-xs font-bold">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`font-medium ${
                                      executionStatus.abstained
                                        ? "text-yellow-600"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {executionStatus.abstained
                                      ? "Abstained"
                                      : "Abstain option"}
                                  </span>
                                </div>
                                {today && (
                                  <span className="text-green-600 font-medium text-xs">
                                    → Use embedded post above to interact
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Future Pulse Info */}
                            <div className="text-sm text-blue-700 bg-blue-100 rounded p-2 mt-2">
                              This pulse will be available on{" "}
                              {new Date((pulse as any).datetimeStart).toLocaleDateString()}
                              .
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            );
          })()}

          {/* Previous Pulses */}
          {(() => {
            const previousPulses = (pulsesData as any).pulses
              .filter(
                (pulse: Pulse) =>
                  !isToday((pulse as any).datetimeStart) && isPastDate((pulse as any).datetimeStart),
              )
              .sort((a: Pulse, b: Pulse) => (b as any).datetimeStart.localeCompare((a as any).datetimeStart)); // Descending for previous

            return (
              previousPulses.length > 0 && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-semibold mb-1 text-gray-700">
                      Previous Pulses
                    </h3>
                    <p className="text-gray-600">
                      Past community engagement activities
                    </p>
                    {/* Total Points Summary */}
                    {(() => {
                      const totalPoints = (executionsData as any)?.executionDetails?.reduce(
                        (total: number, detail: any) => total + (detail.execution ? detail.pointsEarned : 0), 
                        0
                      ) || 0;
                      
                      if (totalPoints > 0) {
                        return (
                          <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-bold">Σ</span>
                              </div>
                              <span className="text-purple-700 font-semibold">
                                Total Points Earned: {totalPoints}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {previousPulses.map((pulse: Pulse) => {
                        const executionStatus = getUserExecutionStatus(
                          pulse.id,
                        );
                        const past = true;
                        const today = false;

                        return (
                          <div
                            key={pulse.id}
                            className="border rounded-lg p-4 border-gray-200 bg-gray-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900 mb-1">
                                  PULSE #{pulse.id}
                                </h4>
                                <p className="text-gray-600 text-sm mb-2">{pulse.description}</p>
                                <p className="text-sm font-medium mb-2 text-gray-500">
                                  {new Date((pulse as any).datetimeStart).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })} - {new Date(new Date((pulse as any).datetimeStart).getTime() + ((pulse as any).interval || 24) * 60 * 60 * 1000).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                                <a
                                  href={(pulse as any).urlEmbed}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm break-all"
                                >
                                  {(pulse as any).urlEmbed}
                                </a>
                              </div>
                            </div>

                            {/* Execution Status for Past Pulses */}
                            <div className="flex items-center space-x-6 text-sm">
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                    executionStatus.liked
                                      ? "bg-red-500"
                                      : "bg-gray-200 border-2 border-gray-300"
                                  }`}
                                >
                                  {executionStatus.liked && (
                                    <span className="text-white text-xs font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`font-medium ${
                                    executionStatus.liked
                                      ? "text-red-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {executionStatus.liked
                                    ? "Liked"
                                    : "Not liked"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                    executionStatus.shared
                                      ? "bg-green-500"
                                      : "bg-gray-200 border-2 border-gray-300"
                                  }`}
                                >
                                  {executionStatus.shared && (
                                    <span className="text-white text-xs font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`font-medium ${
                                    executionStatus.shared
                                      ? "text-green-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {executionStatus.shared
                                    ? "Shared"
                                    : "Not shared"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                    executionStatus.abstained
                                      ? "bg-yellow-500"
                                      : "bg-gray-200 border-2 border-gray-300"
                                  }`}
                                >
                                  {executionStatus.abstained && (
                                    <span className="text-white text-xs font-bold">
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`font-medium ${
                                    executionStatus.abstained
                                      ? "text-yellow-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {executionStatus.abstained
                                    ? "Abstained"
                                    : "Not abstained"}
                                </span>
                              </div>
                            </div>

                            {/* Points and Attestation Status */}
                            {(() => {
                              // Get the execution detail for this pulse to show points and attestation status
                              const executionDetail = (executionsData as any)?.executionDetails?.find(
                                (detail: any) => detail.pulse.id === pulse.id,
                              );
                              
                              const hasExecution = executionDetail && executionDetail.execution;
                              const pointsEarned = hasExecution ? executionDetail.pointsEarned : 0;
                              const attestation = executionDetail?.attestation;

                              return (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                      {/* Points Display */}
                                      <div className="flex items-center space-x-2">
                                        <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                                          <span className="text-purple-600 text-xs font-bold">P</span>
                                        </div>
                                        <span className={`text-sm font-medium ${pointsEarned > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                          {pointsEarned > 0 ? `${pointsEarned} points earned` : '0 points'}
                                        </span>
                                      </div>

                                      {/* Attestation Status */}
                                      <div className="flex items-center space-x-2">
                                        {attestation ? (
                                          attestation.status === 'completed' ? (
                                            <>
                                              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">✓</span>
                                              </div>
                                              {attestation.attestationUid ? (
                                                <a
                                                  href={getEasScanUrl(attestation.attestationUid)}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-sm text-green-600 font-medium hover:text-green-800"
                                                  title="View attestation on EAS scan"
                                                >
                                                  ✓ Attestation  View ↗
                                                </a>
                                              ) : (
                                                <span className="text-sm text-green-600 font-medium">✓ Attestation</span>
                                              )}
                                            </>
                                          ) : attestation.status === 'pending' ? (
                                            <>
                                              <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs">⏳</span>
                                              </div>
                                              <span className="text-sm text-yellow-600 font-medium">Attestation Pending</span>
                                            </>
                                          ) : (
                                            <>
                                              <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                                <span className="text-white text-xs">✗</span>
                                              </div>
                                              <span className="text-sm text-red-600 font-medium">Attestation Failed</span>
                                            </>
                                          )
                                        ) : hasExecution ? (
                                          <>
                                            <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center">
                                              <span className="text-gray-600 text-xs">⏸</span>
                                            </div>
                                            <span className="text-sm text-gray-500 font-medium">No Attestation</span>
                                          </>
                                        ) : (
                                          <>
                                            <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center">
                                              <span className="text-gray-400 text-xs">-</span>
                                            </div>
                                            <span className="text-sm text-gray-400 font-medium">Not Executed</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )
            );
          })()}
        </div>
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
    if (!(executionsData as any)?.executionDetails)
      return { liked: false, shared: false, abstained: false };

    // Find the execution record for this pulse (new structure has execution details)
    const executionDetail = (executionsData as any).executionDetails.find(
      (detail: any) => detail.pulse.id === pulseId,
    );

    // If no execution found, return default values
    if (!executionDetail || !executionDetail.execution?.actions) {
      return { liked: false, shared: false, abstained: false };
    }

    // Extract actions from the execution
    const actions = executionDetail.execution.actions;
    return {
      liked: actions.liked || false,
      shared: actions.shared || false,
      abstained: actions.abstained || false,
    };
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

  const [url, setUrl] = useState("");
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
  const EXPONENTIAL_BACKOFF_BASE = 1000; // 1 second

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
      queryClient.invalidateQueries({ queryKey: [`/api/executions/${member?.id}/details`] });
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
      setUrl((pulse as any).urlEmbed);
      
      // Add a delay to prevent rapid successive calls
      const timeoutId = setTimeout(() => {
        handleCheck();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [(pulse as any).urlEmbed, viewerFid]);

  return (
    <div className="w-full max-w-lg bg-green-50 border border-green-200 shadow rounded-xl">
      <div className="p-6 border-b border-green-200 bg-green-100 rounded-t-xl">
        <h2 className="text-xl font-bold text-green-800 mb-2 flex items-center">
          🎯 PULSE #{pulse.id}
        </h2>
        <p className="text-green-700 text-sm mb-2">{pulse.description}</p>
        <p className="text-sm text-green-600">
          Complete your engagement task for today!
        </p>
      </div>

      <div className="p-6">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Farcaster URL will load automatically"
          className="w-full border rounded-lg px-3 py-2 mb-4"
          readOnly
        />

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
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{successMessage}</p>
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
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    stats?.liked
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700 hover:bg-red-50"
                  }`}
                >
                  {actionLoading.like ? "⏳" : "❤️"}{" "}
                  {actionLoading.like
                    ? "Liking..."
                    : stats?.liked
                      ? "Liked"
                      : "Like"}
                </button>
                <button
                  onClick={() => handleReaction("recast")}
                  disabled={actionLoading.recast || executionStatus.abstained}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    stats?.recasted
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-700 hover:bg-green-50"
                  }`}
                >
                  {actionLoading.recast ? "⏳" : "🔄"}{" "}
                  {actionLoading.recast
                    ? "Recasting..."
                    : stats?.recasted
                      ? "Shared"
                      : "Recast"}
                </button>
                <button
                  onClick={() => handlePulseAction('abstain')}
                  disabled={actionLoading.abstain || (executionStatus.liked || executionStatus.shared)}
                  className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                    executionStatus.abstained
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700 hover:bg-yellow-50"
                  }`}
                >
                  {actionLoading.abstain ? "⏳" : executionStatus.abstained ? "✖️" : "🚫"}{" "}
                  {actionLoading.abstain
                    ? "Recording..."
                    : executionStatus.abstained
                      ? "Cancel"
                      : "Abstain"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
