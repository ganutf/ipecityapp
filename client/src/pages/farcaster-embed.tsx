import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Pulse, Member } from "@shared/schema";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";

// below your other imports / constants
const SIGNER_KEY = "ipe.signer"; // ← NEW: cache for signer_uuid

export default function FarcasterEmbed() {
  const { isAuthenticated, profile, isLoading: authLoading } = usePersistentAuth();
  

  const viewerFid = profile?.fid;
  const queryClient = useQueryClient();

  // Only proceed with queries if we have a valid FID
  const hasValidFid = !!viewerFid && typeof viewerFid === 'number' && !isNaN(viewerFid);

  // Check if user is approved member
  const { data: memberCheck } = useQuery({
    queryKey: [`/api/members/check/${viewerFid}`],
    enabled: isAuthenticated && hasValidFid && !authLoading,
  });

  const { data: oauthStatus } = useQuery({
    queryKey: [`/api/oauth/status/${viewerFid}`],
    enabled:
      isAuthenticated && !!viewerFid && memberCheck?.isMember && !authLoading,
    staleTime: 30000,
  });

  const { data: signerData } = useQuery({
    queryKey: [`/api/neynar/signer/${viewerFid}`],
    enabled:
      isAuthenticated && !!viewerFid && memberCheck?.isMember && !authLoading && !oauthStatus?.connected,
    refetchInterval: (data) => data?.status === 'generated' ? 10000 : false, // Poll every 10s when generated
    refetchIntervalInBackground: false,
    staleTime: 30000,
    onSuccess(data) {
      if (data?.signer_uuid && data?.status === 'approved') {
        localStorage.setItem(SIGNER_KEY, data.signer_uuid);
      }
    },
  });

  const signerUuid = signerData?.signer_uuid || (signerData?.status === 'approved' ? localStorage.getItem(SIGNER_KEY) : null) || null;
  const signerStatus = oauthStatus?.connected ? 'approved' : signerData?.status;
  const approvalUrl = signerData?.approval_url;
  const isConnectedApp = oauthStatus?.connected;

  // Get all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && memberCheck?.isMember && !authLoading,
  });

  // Get user's executions
  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: [`/api/executions/${viewerFid}`],
    enabled: isAuthenticated && hasValidFid && memberCheck?.isMember && !authLoading,
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
    if (!executionsData?.executions) return { liked: false, recasted: false };

    const executions = executionsData.executions.filter(
      (exec: any) => exec.pulseId === pulseId,
    );

    return {
      liked: executions.some((exec: any) => exec.actionType === "like"),
      recasted: executions.some((exec: any) => exec.actionType === "recast"),
    };
  };

  // Find today's active pulse
  const activePulse = pulsesData?.pulses?.find((pulse: Pulse) =>
    isToday(pulse.date),
  );

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
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Welcome to Ipê City Pulse</p>
        <p className="text-gray-500">
          Please sign in to access community engagement activities.
        </p>
      </div>
    );
  }

  // Show signer approval notice if needed
  if (!isConnectedApp && signerStatus !== 'approved') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">Authorize Ipê City Pulse</h2>
          <p className="text-blue-700 mb-6">
            To like and recast posts, you need to authorize this app to post on your behalf. This is a one-time setup using Farcaster's secure signer system.
          </p>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`/api/oauth/connect/${viewerFid}`);
                const data = await response.json();
                if (data.auth_url) {
                  window.open(data.auth_url, '_blank');
                  // Refresh status after user returns
                  setTimeout(() => {
                    window.location.reload();
                  }, 5000);
                }
              } catch (error) {
                console.error('Failed to get approval URL:', error);
              }
            }}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Authorize in Warpcast
          </button>
          <div className="mt-4 text-xs text-blue-600 bg-blue-100 p-3 rounded">
            <p><strong>What this does:</strong></p>
            <ul className="text-left mt-2 space-y-1">
              <li>• Creates a secure signer for your account</li>
              <li>• Allows the app to like and recast posts on your behalf</li>
              <li>• Opens Warpcast where you can approve the signer</li>
              <li>• You maintain full control and can revoke access anytime</li>
            </ul>
          </div>
          
          {signerStatus === 'generated' && signerUuid && (
            <div className="mt-4 text-xs text-blue-600 bg-blue-100 p-3 rounded">
              <p><strong>Status:</strong> Signer created, waiting for approval</p>
              <p><strong>Signer ID:</strong> {signerUuid}</p>
              <p>Return here after approving in Warpcast - status updates every 10 seconds</p>
            </div>
          )}
        </div>
      </div>
    );
  }



  if (isAuthenticated && hasValidFid && !authLoading && memberCheck && (!memberCheck?.isMember || !memberCheck?.approved)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Access Restricted</p>
        <p className="text-gray-500">
          This application is for approved community members only.
        </p>
        <p className="text-gray-500 mt-2">
          Contact an administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  if (authLoading || (isAuthenticated && hasValidFid && (!memberCheck || !memberCheck.member || pulsesLoading || executionsLoading || signerData === undefined))) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading pulse data...</p>
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
            member={memberCheck?.member}
            signerUuid={signerUuid}
            signerStatus={signerStatus}
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
      {pulsesData?.pulses?.length > 0 && (
        <div className="space-y-8">
          {/* Upcoming Pulses */}
          {(() => {
            const upcomingPulses = pulsesData.pulses
              .filter((pulse: Pulse) => !isToday(pulse.date) && !isPastDate(pulse.date))
              .sort((a: Pulse, b: Pulse) => a.date.localeCompare(b.date)); // Ascending for upcoming
            
            return upcomingPulses.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold mb-1 text-blue-700">Upcoming Pulses</h3>
                  <p className="text-gray-600">
                    Future community engagement activities
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {upcomingPulses.map((pulse: Pulse) => {
                      const executionStatus = getUserExecutionStatus(pulse.id);
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
                          {pulse.description}
                        </h4>
                        <p className={`text-sm font-medium mb-2 ${
                          past ? "text-gray-500" : "text-blue-700"
                        }`}>
                          {new Date(
                            pulse.date + "T00:00:00",
                          ).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <a
                          href={pulse.farcasterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 break-all"
                        >
                          {pulse.farcasterUrl}
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
                            {executionStatus.liked ? "Liked" : "Like pending"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              executionStatus.recasted
                                ? "bg-green-500"
                                : "bg-gray-200 border-2 border-gray-300"
                            }`}
                          >
                            {executionStatus.recasted && (
                              <span className="text-white text-xs font-bold">
                                ✓
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-medium ${
                              executionStatus.recasted
                                ? "text-green-600"
                                : "text-gray-500"
                            }`}
                          >
                            {executionStatus.recasted
                              ? "Recasted"
                              : "Recast pending"}
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
                        {new Date(
                          pulse.date + "T00:00:00",
                        ).toLocaleDateString()}
                        .
                      </div>
                    </div>
                  );
                })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Previous Pulses */}
          {(() => {
            const previousPulses = pulsesData.pulses
              .filter((pulse: Pulse) => !isToday(pulse.date) && isPastDate(pulse.date))
              .sort((a: Pulse, b: Pulse) => b.date.localeCompare(a.date)); // Descending for previous
            
            return previousPulses.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold mb-1 text-gray-700">Previous Pulses</h3>
                  <p className="text-gray-600">
                    Past community engagement activities
                  </p>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {previousPulses.map((pulse: Pulse) => {
                      const executionStatus = getUserExecutionStatus(pulse.id);
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
                                {pulse.description}
                              </h4>
                              <p className="text-sm font-medium mb-2 text-gray-500">
                                {new Date(
                                  pulse.date + "T00:00:00",
                                ).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                              <a
                                href={pulse.farcasterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm break-all"
                              >
                                {pulse.farcasterUrl}
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
                                {executionStatus.liked ? "Liked" : "Not liked"}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                  executionStatus.recasted
                                    ? "bg-green-500"
                                    : "bg-gray-200 border-2 border-gray-300"
                                }`}
                              >
                                {executionStatus.recasted && (
                                  <span className="text-white text-xs font-bold">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <span
                                className={`font-medium ${
                                  executionStatus.recasted
                                    ? "text-green-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {executionStatus.recasted ? "Recasted" : "Not recasted"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
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
  signerStatus,
}: {
  pulse: Pulse;
  member: Member;
  signerUuid: string | null;
  signerStatus?: string;
}) {
  const { profile } = usePersistentAuth();
  const viewerFid = profile?.fid;
  const queryClient = useQueryClient();

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
  }>({ like: false, recast: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Record pulse execution
  const recordExecutionMutation = useMutation({
    mutationFn: async ({ actionType }: { actionType: "like" | "recast" }) => {
      const response = await fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pulseId: pulse.id,
          memberFarcasterFid: viewerFid,
          actionType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to record execution");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/executions/${viewerFid}`],
      });
    },
  });

  async function handleCheck() {
    if (!pulse.farcasterUrl || !viewerFid) return;
    
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/neynar/cast/${encodeURIComponent(pulse.farcasterUrl)}/${viewerFid}?type=url`,
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
    } catch (error) {
      console.error("Error fetching cast:", error);
      setError(
        `Failed to fetch cast: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(type: "like" | "recast") {
    if (!castData || !viewerFid || !signerUuid) return;
    
    if (signerStatus !== 'approved') {
      setError('Signer not approved. Please approve your signer first.');
      return;
    }

    setActionLoading((prev) => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const signer_uuid = signerUuid;

      if (type === "like") {
        const response = await fetch("/api/neynar/reaction", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signer_uuid: signer_uuid,
            reaction_type: "like",
            target: castData.hash,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Like response error:", errorData);
          throw new Error(`Like failed: ${errorData.error || errorData.message || "API Error"}`);
        }
      } else if (type === "recast") {
        const response = await fetch("/api/neynar/cast", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
      }

      // Record the execution in database
      recordExecutionMutation.mutate({ actionType: type });

      setSuccessMessage(`Post ${type}d successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setTimeout(() => handleCheck(), 2000);
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
    if (pulse.farcasterUrl && viewerFid) {
      setUrl(pulse.farcasterUrl);
      handleCheck();
    }
  }, [pulse.farcasterUrl, viewerFid]);

  return (
    <div className="w-full max-w-lg bg-green-50 border border-green-200 shadow rounded-xl">
      <div className="p-6 border-b border-green-200 bg-green-100 rounded-t-xl">
        <h2 className="text-xl font-bold text-green-800 mb-2 flex items-center">
          🎯 Today's Active Pulse
        </h2>
        <p className="text-green-700 mb-2">{pulse.description}</p>
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
          <p className="text-sm text-red-700">{error}</p>
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
                disabled={actionLoading.like}
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
                disabled={actionLoading.recast}
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
                    ? "Recasted"
                    : "Recast"}
              </button>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
