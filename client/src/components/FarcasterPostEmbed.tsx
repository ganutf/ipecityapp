import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FarcasterPostEmbedProps {
  castUrl: string;
  viewerFid?: number;
  className?: string;
  readonly?: boolean;
}

export function FarcasterPostEmbed({ 
  castUrl, 
  viewerFid, 
  className,
  readonly = true 
}: FarcasterPostEmbedProps) {
  const [castData, setCastData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!castUrl || !viewerFid) return;

    let isMounted = true;

    const fetchCastData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("Fetching cast data for:", castUrl);
        
        const res = await fetch(
          `/api/neynar/cast/${encodeURIComponent(castUrl)}/${viewerFid}?type=url`,
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load cast: ${res.status}`);
        }

        const { cast } = await res.json();
        
        if (isMounted) {
          setCastData(cast);
          console.log("Cast data loaded successfully");
        }
      } catch (error) {
        console.error("Error fetching cast:", error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : "Failed to load post");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Add small delay to prevent rapid successive calls
    const timeoutId = setTimeout(fetchCastData, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [castUrl, viewerFid]);

  if (!castUrl) return null;

  if (loading) {
    return (
      <Card className={cn("border border-gray-200", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mr-3"></div>
            <span className="text-gray-600">Loading post...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border border-red-200 bg-red-50", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-red-700 mb-2">Failed to load Farcaster post</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
            <a
              href={castUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center"
            >
              View Post <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!castData) {
    return (
      <Card className={cn("border border-gray-200", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 text-sm">Farcaster post</span>
            <a
              href={castUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors flex items-center"
            >
              View Post <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border border-gray-200 bg-white", className)}>
      <CardContent className="p-0">
        {/* Header with "Farcaster Post" label and external link */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">f</span>
            </div>
            <span className="text-sm font-medium text-gray-700">Farcaster Post</span>
          </div>
          <a
            href={castUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors flex items-center"
          >
            View Original <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>

        {/* Post Content */}
        <div className="p-6">
          {/* Author Info */}
          <div className="flex items-center space-x-3 mb-4">
            <img
              src={castData.author.pfp_url}
              alt={castData.author.display_name}
              className="w-12 h-12 rounded-full border border-gray-200"
            />
            <div>
              <p className="font-semibold text-gray-900">{castData.author.display_name}</p>
              <p className="text-sm text-gray-500">@{castData.author.username}</p>
            </div>
          </div>

          {/* Post Text */}
          {castData.text && (
            <p className="text-gray-800 mb-4 leading-relaxed">{castData.text}</p>
          )}

          {/* Embedded Images */}
          {castData.embeds && castData.embeds.length > 0 && (
            <div className="mb-4">
              {castData.embeds.map(
                (embed: any, index: number) =>
                  embed.url &&
                  embed.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) && (
                    <img
                      key={index}
                      src={embed.url}
                      alt="Embedded content"
                      className="max-w-full h-auto rounded-lg border border-gray-200 mb-2"
                    />
                  ),
              )}
            </div>
          )}

          {/* Post Stats */}
          <div className="flex items-center space-x-6 text-sm text-gray-500 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-1">
              <span>❤️</span>
              <span>{castData.reactions.likes_count}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>🔄</span>
              <span>{castData.reactions.recasts_count}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>💬</span>
              <span>{castData.replies.count}</span>
            </div>
            <div className="ml-auto text-xs text-gray-400">
              {new Date(castData.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}