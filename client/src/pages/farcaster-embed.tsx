import { useState } from "react";
import { SignInButton, useProfile } from "@farcaster/auth-kit";

export default function FarcasterEmbed() {
  return (
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="fixed top-4 right-4 flex gap-2">
        <SignInButton />
      </header>
      <h1 className="text-2xl font-bold mb-6 mt-16">Farcaster Post Embed</h1>
      <PostTool />
    </main>
  );
}

function PostTool() {
  const { isAuthenticated, profile } = useProfile();
  const viewerFid = profile?.fid;

  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<null | { liked: boolean; recasted: boolean }>(null);
  const [castData, setCastData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ like: boolean; recast: boolean }>({ like: false, recast: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<{ like: boolean; recast: boolean }>({ like: false, recast: false });

  async function handleCheck() {
    if (!url) return;
    setChecking(true);
    setError(null);

    try {
      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(
          url
        )}&type=url&viewer_fid=${viewerFid}`,
        { headers: { "x-api-key": "NEYNAR_API_DOCS" } }
      );
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }
      
      const { cast } = await res.json();
      setCastData(cast);
      setStats({
        liked: !!cast.viewer_context?.liked,
        recasted: !!cast.viewer_context?.recasted,
      });
    } catch (error) {
      console.error("Error fetching cast:", error);
      setError("Failed to fetch cast. Please check the URL and try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(type: 'like' | 'recast') {
    if (!castData) return;

    setActionLoading(prev => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const signerUuid = import.meta.env.VITE_NEYNAR_SIGNER_UUID;
      const clientId = import.meta.env.VITE_NEYNAR_CLIENT_ID;
      
      if (!signerUuid) {
        setError('Signer UUID not configured. Please check your environment variables.');
        return;
      }

      // For likes, use the server proxy endpoint
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
      // For recasts, use the server proxy endpoint
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
          // If it's an API key issue, provide clearer error message
          if (response.status === 401 || response.status === 403) {
            throw new Error('API authentication failed. Please check your Neynar API key configuration.');
          }
          throw new Error(`Recast failed: ${responseData.message || 'API Error'}`);
        }
      }

      // Mark action as pending (for recasts that take time to propagate)
      setPendingActions(prev => ({ ...prev, [type]: true }));

      // Update local state optimistically
      const isCurrentlyActive = stats?.[type === 'like' ? 'liked' : 'recasted'] || false;
      setStats(prev => prev ? {
        ...prev,
        [type === 'like' ? 'liked' : 'recasted']: !isCurrentlyActive
      } : null);

      // Show success message with network propagation note for recasts
      if (type === 'recast') {
        setSuccessMessage('Recast successful! It may take a few moments to appear in your feed.');
      } else {
        setSuccessMessage('Like successful!');
      }
      setTimeout(() => setSuccessMessage(null), 5000);

      // Multiple refresh attempts for better accuracy
      setTimeout(() => handleCheck(), 2000);
      if (type === 'recast') {
        setTimeout(() => handleCheck(), 8000);
        setTimeout(() => {
          handleCheck();
          setPendingActions(prev => ({ ...prev, [type]: false }));
        }, 15000);
      } else {
        setTimeout(() => {
          setPendingActions(prev => ({ ...prev, [type]: false }));
        }, 3000);
      }
      
    } catch (error) {
      console.error(`Error ${type}ing cast:`, error);
      setError(`Failed to ${type} post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [type]: false }));
    }
  }

  if (!isAuthenticated)
    return <p className="text-gray-600">➡️ Please sign in first.</p>;

  return (
    <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl">
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">Connected as: {profile?.displayName || profile?.username}</p>
        <p className="text-xs text-blue-600">FID: {viewerFid}</p>
      </div>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="paste any Warpcast/Farcaster URL"
        className="w-full border rounded-lg px-3 py-2 mb-3"
      />
      <button
        onClick={handleCheck}
        disabled={!url || checking}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg w-full disabled:bg-purple-300"
      >
        {checking ? "Checking…" : "Fetch"}
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
          {pendingActions.recast && (
            <p className="text-blue-600 text-xs italic">
              Note: Recasts may take 10-30 seconds to appear due to network propagation
            </p>
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
          
          {/* Embedded images */}
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
                  stats?.liked || pendingActions.like
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-red-50'
                }`}
              >
                {actionLoading.like ? '⏳' : '❤️'} {
                  actionLoading.like ? 'Liking...' : 
                  pendingActions.like ? 'Pending...' :
                  stats?.liked ? 'Liked' : 'Like'
                }
              </button>
              <button
                onClick={() => handleReaction('recast')}
                disabled={actionLoading.recast}
                className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  stats?.recasted || pendingActions.recast
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-green-50'
                }`}
              >
                {actionLoading.recast ? '⏳' : '🔄'} {
                  actionLoading.recast ? 'Recasting...' : 
                  pendingActions.recast ? 'Propagating...' :
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
