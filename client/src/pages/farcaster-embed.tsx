import { useState, useEffect } from "react";
import { SignInButton, useProfile } from "@farcaster/auth-kit";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Pulse, Member } from "@shared/schema";

export default function FarcasterEmbed() {
  const { isAuthenticated, profile } = useProfile();
  const queryClient = useQueryClient();
  const viewerFid = profile?.fid;

  // Check if user is approved member
  const { data: memberCheck } = useQuery({
    queryKey: [`/api/members/check/${viewerFid}`],
    enabled: isAuthenticated && !!viewerFid,
  });

  // Get current pulse
  const { data: currentPulseData, isLoading: pulseLoading } = useQuery({
    queryKey: ["/api/pulses/current"],
    enabled: isAuthenticated && memberCheck?.isMember,
  });

  // Get all pulses for fallback
  const { data: allPulsesData } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && memberCheck?.isMember && !currentPulseData?.pulse,
  });

  const isAdmin = profile?.username === "jeanhansen" || profile?.displayName?.toLowerCase().includes("jean hansen");

  if (!isAuthenticated) {
    return (
      <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
        <header className="w-full max-w-lg flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ipê City Pulse</h1>
          <SignInButton />
        </header>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Welcome to Ipê City Pulse</p>
          <p className="text-gray-500">Please sign in to access community engagement activities.</p>
        </div>
      </main>
    );
  }

  if (!memberCheck?.isMember && !memberCheck?.approved) {
    return (
      <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
        <header className="w-full max-w-lg flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ipê City Pulse</h1>
          <SignInButton>
            <img 
              src={profile?.pfpUrl} 
              alt={profile?.displayName || profile?.username || 'Profile'}
              className="w-10 h-10 rounded-full border-2 border-purple-600 cursor-pointer hover:border-purple-700 transition-colors"
            />
          </SignInButton>
        </header>
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Access Restricted</p>
          <p className="text-gray-500">This application is for approved community members only.</p>
          <p className="text-gray-500 mt-2">Contact an administrator if you believe this is an error.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="w-full max-w-lg flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ipê City Pulse</h1>
        <div className="flex items-center space-x-4">
          <nav className="flex space-x-2">
            <Link href="/pulses">
              <a className="text-sm text-gray-600 hover:text-purple-600 px-2 py-1 rounded">
                History
              </a>
            </Link>
            {isAdmin && (
              <Link href="/admin">
                <a className="text-sm text-gray-600 hover:text-purple-600 px-2 py-1 rounded">
                  Admin
                </a>
              </Link>
            )}
          </nav>
          <SignInButton>
            <img 
              src={profile?.pfpUrl} 
              alt={profile?.displayName || profile?.username || 'Profile'}
              className="w-10 h-10 rounded-full border-2 border-purple-600 cursor-pointer hover:border-purple-700 transition-colors"
            />
          </SignInButton>
        </div>
      </header>
      
      {pulseLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : currentPulseData?.pulse ? (
        <PostTool pulse={currentPulseData.pulse} member={memberCheck.member} />
      ) : (
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <h2 className="text-lg font-semibold mb-4">No Active Pulse Today</h2>
            <p className="text-gray-600 mb-6">There's no community engagement activity scheduled for today.</p>
            
            <Link href="/pulses">
              <a className="inline-block bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
                View All Pulses
              </a>
            </Link>
            
            {allPulsesData?.pulses?.length > 0 && (
              <div className="mt-6 text-left">
                <h3 className="font-medium mb-3">Recent & Upcoming Pulses:</h3>
                <div className="space-y-2">
                  {allPulsesData.pulses.slice(0, 3).map((pulse: Pulse) => (
                    <div key={pulse.id} className="text-sm text-gray-600 border-l-2 border-gray-200 pl-3">
                      <p className="font-medium">{pulse.description}</p>
                      <p className="text-xs">{new Date(pulse.date).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function PostTool({ pulse, member }: { pulse: Pulse; member: Member }) {
  const { profile } = useProfile();
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
  const [actionLoading, setActionLoading] = useState<{ like: boolean; recast: boolean }>({ like: false, recast: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function checkQuoteRecast(castHash: string, viewerFid: number): Promise<boolean> {
    try {
      const quoteRes = await fetch(`/api/neynar/cast/${castHash}/quotes/${viewerFid}`);
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
    mutationFn: async ({ actionType }: { actionType: 'like' | 'recast' }) => {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pulseId: pulse.id,
          memberFarcasterFid: viewerFid,
          actionType
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record execution');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/executions/${viewerFid}`] });
    },
  });

  async function handleCheck() {
    if (!pulse.farcasterUrl || !viewerFid) return;
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(`/api/neynar/cast/${encodeURIComponent(pulse.farcasterUrl)}/${viewerFid}?type=url`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${res.status}`);
      }
      
      const { cast } = await res.json();
      setCastData(cast);
      
      const regularRecast = !!cast.viewer_context?.recasted;
      const liked = !!cast.viewer_context?.liked;
      const quotedRecast = cast.hash ? await checkQuoteRecast(cast.hash, viewerFid) : false;
      
      setStats({
        liked: liked,
        recasted: regularRecast || quotedRecast,
        regularRecast: regularRecast,
        quotedRecast: quotedRecast,
      });
    } catch (error) {
      console.error("Error fetching cast:", error);
      setError(`Failed to fetch cast: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(type: 'like' | 'recast') {
    if (!castData || !viewerFid) return;

    setActionLoading(prev => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const signerUuid = import.meta.env.VITE_NEYNAR_SIGNER_UUID;
      
      if (!signerUuid) {
        setError('Signer UUID not configured. Please check your environment variables.');
        return;
      }

      if (type === 'like') {
        const response = await fetch('/api/neynar/reaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            reaction_type: 'like',
            target: castData.hash
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Like failed: ${errorData.message || 'API Error'}`);
        }
      } 
      else if (type === 'recast') {
        const response = await fetch('/api/neynar/cast', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text: '',
            embeds: [{
              cast_id: {
                hash: castData.hash,
                fid: castData.author.fid
              }
            }]
          })
        });

        const responseData = await response.json().catch(() => ({}));
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('API authentication failed. Please check your Neynar API key configuration.');
          }
          throw new Error(`Recast failed: ${responseData.message || 'API Error'}`);
        }
      }

      if (type === 'like') {
        setStats(prev => prev ? {
          ...prev,
          liked: !prev.liked
        } : null);
      } else if (type === 'recast') {
        setStats(prev => prev ? {
          ...prev,
          recasted: true,
          regularRecast: true,
          quotedRecast: prev.quotedRecast
        } : null);
      }

      // Record the execution in database
      recordExecutionMutation.mutate({ actionType: type });

      setSuccessMessage(`Post ${type}d successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
      setTimeout(() => handleCheck(), 2000);
      
    } catch (error) {
      console.error(`Error ${type}ing cast:`, error);
      setError(`Failed to ${type} post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [type]: false }));
    }
  }

  // Auto-load the current pulse
  useEffect(() => {
    if (pulse.farcasterUrl) {
      setUrl(pulse.farcasterUrl);
      handleCheck();
    }
  }, [pulse.farcasterUrl]);

  return (
    <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl">
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <h3 className="font-medium text-purple-800 mb-1">Today's Pulse</h3>
        <p className="text-sm text-purple-700">{pulse.description}</p>
        <p className="text-xs text-purple-600 mt-1">
          Date: {new Date(pulse.date).toLocaleDateString()}
        </p>
      </div>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Farcaster URL will load automatically"
        className="w-full border rounded-lg px-3 py-2 mb-3"
        readOnly
      />
      <button
        onClick={handleCheck}
        disabled={!url || checking}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg w-full disabled:bg-purple-300 mb-4"
      >
        {checking ? "Loading…" : "Refresh Post"}
      </button>

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

      {stats && (
        <div className="mt-4 text-sm text-gray-800 space-y-1">
          <p>❤️ Liked: {stats.liked ? "yes" : "no"}</p>
          <p>🔄 Recasted: {stats.recasted ? "yes" : "no"}</p>
          {stats.recasted && (
            <div className="ml-4 text-xs text-gray-600">
              {stats.regularRecast && <span>• Regular recast</span>}
              {stats.quotedRecast && <span>• Quote recast</span>}
            </div>
          )}
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
              <p className="text-sm text-gray-500">@{castData.author.username}</p>
            </div>
          </div>
          <p className="text-gray-800 mb-4">{castData.text}</p>
          
          {castData.embeds && castData.embeds.length > 0 && (
            <div className="mb-4">
              {castData.embeds.map((embed: any, index: number) => (
                embed.url && embed.url.match(/\.(jpeg|jpg|gif|png)$/i) && (
                  <img 
                    key={index}
                    src={embed.url} 
                    alt="Embedded content"
                    className="max-w-full h-auto rounded-lg mb-2"
                  />
                )
              ))}
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
                onClick={() => handleReaction('like')}
                disabled={actionLoading.like}
                className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  stats?.liked 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                }`}
              >
                {actionLoading.like ? '⏳' : '❤️'} {
                  actionLoading.like ? 'Liking...' : 
                  stats?.liked ? 'Liked' : 'Like'
                }
              </button>
              <button
                onClick={() => handleReaction('recast')}
                disabled={actionLoading.recast}
                className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  stats?.recasted 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                }`}
              >
                {actionLoading.recast ? '⏳' : '🔄'} {
                  actionLoading.recast ? 'Recasting...' : 
                  stats?.recasted ? 'Recasted' : 'Recast'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}