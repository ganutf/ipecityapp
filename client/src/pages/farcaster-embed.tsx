import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Pulse, Member } from "@shared/schema";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { SignInButton } from "@farcaster/auth-kit";

const SIGNER_KEY = "ipe.signer"; // localStorage slot for signer_uuid

/* ------------------------------------------------------------------ */
/*  ⬇ Main page component                                             */
/* ------------------------------------------------------------------ */
export default function FarcasterEmbed() {
  const { isAuthenticated, profile } = usePersistentAuth();
  const viewerFid = profile?.fid;

  /* -- membership --------------------------------------------------- */
  const { data: memberCheck } = useQuery({
    queryKey: [`/api/members/check/${viewerFid}`],
    enabled: Boolean(isAuthenticated && viewerFid),
  });

  /* -- signer creation / retrieval ---------------------------------- */
  const { data: signerData } = useQuery({
    queryKey: [`/api/neynar/signer/${viewerFid}`],
    enabled: Boolean(isAuthenticated && viewerFid && memberCheck?.isMember),
    staleTime: Infinity,
    onSuccess(data) {
      // ① persist for future page-loads
      if (data?.signer_uuid) {
        localStorage.setItem(SIGNER_KEY, data.signer_uuid);
      }
    },
  });

  // ② choose live signer (if query resolved) or cached one
  const signerUuid =
    signerData?.signer_uuid || localStorage.getItem(SIGNER_KEY) || null;

  /* -- pulses & executions ------------------------------------------ */
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: Boolean(isAuthenticated && memberCheck?.isMember),
  });

  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: [`/api/executions/${viewerFid}`],
    enabled: Boolean(isAuthenticated && viewerFid && memberCheck?.isMember),
  });

  /* -- date helpers -------------------------------------------------- */
  const isToday = (d: string) =>
    new Date().toISOString().slice(0, 10) === new Date(d).toISOString().slice(0, 10);

  const isPastDate = (d: string) =>
    new Date(d).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);

  const getUserExecutionStatus = (pulseId: number) => {
    if (!executionsData?.executions) return { liked: false, recasted: false };
    const ex = executionsData.executions.filter((e: any) => e.pulseId === pulseId);
    return {
      liked: ex.some((e: any) => e.actionType === "like"),
      recasted: ex.some((e: any) => e.actionType === "recast"),
    };
  };

  const activePulse = pulsesData?.pulses?.find((p: Pulse) => isToday(p.date));

  /* -- guards -------------------------------------------------------- */
  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Welcome to Ipê City Pulse</p>
        <p className="text-gray-500">Please sign in to access community engagement activities.</p>
      </div>
    );
  }

  if (!memberCheck?.isMember && !memberCheck?.approved) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Access Restricted</p>
        <p className="text-gray-500">This application is for approved community members only.</p>
      </div>
    );
  }

  if (pulsesLoading || executionsLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                           */
  /* ------------------------------------------------------------------ */
  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Active Pulse */}
      {activePulse ? (
        <div className="mb-8">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h2 className="text-xl font-bold text-green-800 mb-2">🎯 Today's Active Pulse</h2>
            <p className="text-green-700">Complete your engagement task for today!</p>
          </div>
          {/* pass signerUuid so PostTool can write immediately */}
          <PostTool
            pulse={activePulse}
            member={memberCheck.member}
            signerUuid={signerUuid}
          />
        </div>
      ) : (
        <div className="mb-8">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No Active Pulse Today</h2>
            <p className="text-gray-600">Check back tomorrow for new community engagement activities!</p>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold mb-1">Community Pulses</h3>
        </div>

        <div className="p-6">
          {pulsesData?.pulses?.length ? (
            <div className="space-y-4">
              {pulsesData.pulses.map((pulse: Pulse) => {
                const status = getUserExecutionStatus(pulse.id);
                const past = isPastDate(pulse.date);
                const today = isToday(pulse.date);
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
                      <div>
                        <h4 className="font-semibold">{pulse.description}</h4>
                        <p className="text-sm text-gray-600 mb-1">
                          {new Date(pulse.date).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <a
                          href={pulse.farcasterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 break-all"
                        >
                          {pulse.farcasterUrl}
                        </a>
                      </div>
                      <span
                        className={`px-3 py-1 text-sm rounded-full ${
                          today
                            ? "bg-green-100 text-green-800"
                            : past
                            ? "bg-gray-100 text-gray-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {today ? "Active Today" : past ? "Completed" : "Upcoming"}
                      </span>
                    </div>

                    {(past || today) && (
                      <div className="flex items-center space-x-6 text-sm">
                        <StatusDot ok={status.liked} label="Liked" color="red" />
                        <StatusDot ok={status.recasted} label="Recasted" color="green" />
                        {today && (
                          <span className="text-xs text-green-600">
                            → Use embedded post above to interact
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No pulses available yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ⬇ Helper for status indicators                                    */
/* ------------------------------------------------------------------ */
function StatusDot({
  ok,
  label,
  color,
}: {
  ok: boolean;
  label: string;
  color: "red" | "green";
}) {
  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center ${
          ok ? `bg-${color}-500` : "bg-gray-200 border-2 border-gray-300"
        }`}
      >
        {ok && <span className="text-white text-xs font-bold">✓</span>}
      </div>
      <span className={`font-medium ${ok ? `text-${color}-600` : "text-gray-500"}`}>
        {ok ? label : `${label} pending`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ⬇ PostTool – receives signerUuid                                  */
/* ------------------------------------------------------------------ */
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

  const [castData, setCastData] = useState<any>(null);
  const [stats, setStats] = useState<{
    liked: boolean;
    recasted: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ like: boolean; recast: boolean }>({
    like: false,
    recast: false,
  });

  /* -- fetch viewer status ----------------------------------------- */
  async function refreshStatus() {
    if (!pulse.farcasterUrl || !viewerFid) return;
    try {
      const res = await fetch(
        `/api/neynar/cast/${encodeURIComponent(pulse.farcasterUrl)}/${viewerFid}?type=url`,
      );
      const { cast } = await res.json();
      setCastData(cast);
      setStats({
        liked: !!cast.viewer_context?.liked,
        recasted:
          !!cast.viewer_context?.recasted ||
          (await fetch(`/api/neynar/cast/${cast.hash}/quotes/${viewerFid}`)).ok,
      });
    } catch (e: any) {
      setError(e.message ?? "Failed to fetch cast");
    }
  }

  useEffect(() => {
    refreshStatus();
  }, [pulse.farcasterUrl]);

  /* -- record execution -------------------------------------------- */
  const record = useMutation({
    mutationFn: (actionType: "like" | "recast") =>
      fetch("/api/executions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pulseId: pulse.id,
          memberFarcasterFid: viewerFid,
          actionType,
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [`/api/executions/${viewerFid}`] }),
  });

  /* -- like / recast ------------------------------------------------ */
  async function act(type: "like" | "recast") {
    if (!castData || !viewerFid || !signerUuid) return;
    setLoading((p) => ({ ...p, [type]: true }));
    try {
      if (type === "like") {
        await fetch("/api/neynar/reaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            reaction_type: "like",
            target: castData.hash,
          }),
        });
      } else {
        await fetch("/api/neynar/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text: "",
            embeds: [
              {
                cast_id: { hash: castData.hash, fid: castData.author.fid },
              },
            ],
          }),
        });
      }
      record.mutate(type);
      await refreshStatus();
    } catch (e: any) {
      setError(e.message ?? `Failed to ${type}`);
    } finally {
      setLoading((p) => ({ ...p, [type]: false }));
    }
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  if (!castData || !stats) return null;

  return (
    <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl">
      <p className="mb-4">{castData.text}</p>
      <div className="flex space-x-2">
        <button
          disabled={loading.like}
          onClick={() => act("like")}
          className={`px-3 py-1 rounded text-sm ${
            stats.liked ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {loading.like ? "⏳" : "❤️"} {stats.liked ? "Liked" : "Like"}
        </button>
        <button
          disabled={loading.recast}
          onClick={() => act("recast")}
          className={`px-3 py-1 rounded text-sm ${
            stats.recasted ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
          }`}
        >
          {loading.recast ? "⏳" : "🔄"} {stats.recasted ? "Recasted" : "Recast"}
        </button>
      </div>
    </div>
  );
}
