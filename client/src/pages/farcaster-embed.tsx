import { useState } from "react";
import {
  NeynarContextProvider,
  useNeynarContext,
  Theme,
} from "@neynar/react";
import "@neynar/react/dist/style.css";

export default function FarcasterEmbed() {
  return (
    <NeynarContextProvider
      settings={{
        clientId: import.meta.env.VITE_NEYNAR_CLIENT_ID!,
        defaultTheme: Theme.Light,
      }}
    >
      <Main />
    </NeynarContextProvider>
  );
}

function Main() {
  const { user } = useNeynarContext();

  return (
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="fixed top-4 right-4">
        <div className="bg-white rounded-lg p-2 shadow">
          {/* Temporarily using fallback button while debugging NeynarAuthButton */}
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">
            {user ? `@${user.username}` : 'Sign In'}
          </button>
        </div>
      </header>

      <h1 className="text-2xl font-bold mb-6 mt-16">Farcaster Post Embed</h1>

      {user ? (
        <PostTool user={user} />
      ) : (
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in with Neynar to continue</p>
          <p className="text-sm text-gray-500">Note: NeynarAuthButton integration in progress</p>
        </div>
      )}
    </main>
  );
}

function PostTool({ user }: { user: any }) {
  const viewerFid = user.fid;
  const signerUuid = user.signer_uuid;

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
  const [loading, setLoading] = useState<{ like: boolean; recast: boolean }>({ like: false, recast: false });
  const [success, setSuccess] = useState<string | null>(null);

  async function checkQuoteRecast(hash: string): Promise<boolean> {
    const r = await fetch(`/api/neynar/cast/${hash}/quotes/${viewerFid}`);
    if (!r.ok) return false;
    const { hasQuoted } = await r.json();
    return hasQuoted;
  }

  async function handleCheck() {
    if (!url) return;
    setChecking(true);
    setError(null);

    try {
      const r = await fetch(`/api/neynar/cast/${encodeURIComponent(url)}/${viewerFid}?type=url`);
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      const { cast } = await r.json();
      setCastData(cast);

      const regular = !!cast.viewer_context?.recasted;
      const liked = !!cast.viewer_context?.liked;
      const quoted = await checkQuoteRecast(cast.hash);

      setStats({
        liked,
        recasted: regular || quoted,
        regularRecast: regular,
        quotedRecast: quoted,
      });
    } catch (e: any) {
      setError(`Failed to fetch cast: ${e.message}`);
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(kind: "like" | "recast") {
    if (!castData) return;
    setLoading(p => ({ ...p, [kind]: true }));
    setError(null);

    try {
      if (kind === "like") {
        await fetch("/api/neynar/reaction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            reaction_type: "like",
            target: castData.hash,
          }),
        });
        setStats(s => s && { ...s, liked: !s.liked });
      } else {
        await fetch("/api/neynar/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signer_uuid: signerUuid,
            text: "",
            embeds: [{ cast_id: { hash: castData.hash, fid: castData.author.fid } }],
          }),
        });
        setStats(s => s && { ...s, recasted: true, regularRecast: true });
      }

      setSuccess(`Post ${kind}d!`);
      setTimeout(() => setSuccess(null), 2500);
      setTimeout(handleCheck, 1500);
    } catch (e: any) {
      setError(`Failed to ${kind}: ${e.message}`);
    } finally {
      setLoading(p => ({ ...p, [kind]: false }));
    }
  }

  return (
    <div className="w-full max-w-lg bg-white shadow p-6 rounded-xl">
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">Connected as: {user.display_name || user.username}</p>
        <p className="text-xs text-blue-600">FID: {viewerFid}</p>
      </div>

      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800">All interactions available</p>
      </div>

      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
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

      {error && <Alert color="red" msg={error} />}
      {success && <Alert color="green" msg={success} />}

      {stats && (
        <div className="mt-4 text-sm text-gray-800 space-y-1">
          <p>❤️ Liked: {stats.liked ? "yes" : "no"}</p>
          <p>🔄 Recasted: {stats.recasted ? "yes" : "no"}</p>
          {stats.recasted && (
            <div className="ml-4 text-xs text-gray-600">
              {stats.regularRecast && <span>• Regular recast </span>}
              {stats.quotedRecast && <span>• Quote recast</span>}
            </div>
          )}
        </div>
      )}

      {castData && <CastCard cast={castData} />}

      <div className="flex space-x-2 mt-4">
        <ActionButton
          label={stats?.liked ? "Liked" : "Like"}
          icon="❤️"
          active={stats?.liked}
          loading={loading.like}
          onClick={() => handleReaction("like")}
        />
        <ActionButton
          label={stats?.recasted ? "Recasted" : "Recast"}
          icon="🔄"
          active={stats?.recasted}
          loading={loading.recast}
          onClick={() => handleReaction("recast")}
        />
      </div>
    </div>
  );
}

function Alert({ color, msg }: { color: "red" | "green"; msg: string }) {
  return (
    <div className={`mt-4 p-3 bg-${color}-50 border border-${color}-200 rounded-lg`}>
      <p className={`text-sm text-${color}-700`}>{msg}</p>
    </div>
  );
}

function ActionButton(props: {
  label: string;
  icon: string;
  active?: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const base = props.active
    ? "bg-green-100 text-green-700"
    : "bg-gray-100 text-gray-700 hover:bg-green-50";
  return (
    <button
      onClick={props.onClick}
      disabled={props.loading}
      className={`px-3 py-1 rounded text-sm transition-colors duration-200 disabled:opacity-50 ${base}`}
    >
      {props.loading ? "⏳" : props.icon} {props.loading ? props.label + "…" : props.label}
    </button>
  );
}

function CastCard({ cast }: { cast: any }) {
  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center space-x-3 mb-3">
        <img src={cast.author.pfp_url} alt={cast.author.display_name} className="w-10 h-10 rounded-full" />
        <div>
          <p className="font-semibold">{cast.author.display_name}</p>
          <p className="text-sm text-gray-500">@{cast.author.username}</p>
        </div>
      </div>
      <p className="text-gray-800 mb-4">{cast.text}</p>

      {cast.embeds?.filter((e: any) => e.url?.match(/\.(jpeg|jpg|gif|png)$/i)).map((e: any, i: number) => (
        <img key={i} src={e.url} alt="embed" className="max-w-full h-auto rounded-lg mb-2" />
      ))}

      <div className="flex items-center space-x-4 text-sm text-gray-500">
        <span>❤️ {cast.reactions.likes_count}</span>
        <span>🔄 {cast.reactions.recasts_count}</span>
        <span>💬 {cast.replies.count}</span>
      </div>
    </div>
  );
}