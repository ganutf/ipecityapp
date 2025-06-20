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
  /* ------------- identities ------------- */
  const { isAuthenticated, profile } = useProfile();
  const viewerFid = profile?.fid;

  /* ------------- local state ------------- */
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<null | { liked: boolean; recasted: boolean }>(null);
  const [castData, setCastData] = useState<any>(null);

  async function handleCheck() {
    if (!url) return;
    setChecking(true);

    try {
      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(
          url
        )}&type=url&viewer_fid=${viewerFid}`,
        { headers: { "x-api-key": "NEYNAR_API_DOCS" } }
      );
      const { cast } = await res.json();
      setCastData(cast);
      setStats({
        liked: !!cast.viewer_context?.liked,
        recasted: !!cast.viewer_context?.recasted,
      });
    } catch (error) {
      console.error("Error fetching cast:", error);
    } finally {
      setChecking(false);
    }
  }

  if (!isAuthenticated)
    return <p className="text-gray-600">➡️ Please sign in first.</p>;

  return (
    <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl">
      {/* Note: Neynar Auth will be added once component issues are resolved */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">Connected as: {profile?.displayName || profile?.username}</p>
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

      {stats && (
        <div className="mt-4 text-sm text-gray-800 space-y-1">
          <p>❤️ Liked: {stats.liked ? "yes" : "no"}</p>
          <p>🔄 Recasted: {stats.recasted ? "yes" : "no"}</p>
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
          <p className="text-gray-800 mb-3">{castData.text}</p>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>❤️ {castData.reactions.likes_count}</span>
            <span>🔄 {castData.reactions.recasts_count}</span>
            <span>💬 {castData.replies.count}</span>
          </div>
        </div>
      )}
    </div>
  );
}
