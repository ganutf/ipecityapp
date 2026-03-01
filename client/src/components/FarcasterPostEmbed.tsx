import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedPostText } from "./FormattedPostText";

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
        const res = await fetch(
          `/api/v2/farcaster/cast/${encodeURIComponent(castUrl)}?type=url`,
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load cast: ${res.status}`);
        }

        const { cast } = await res.json();
        
        if (isMounted) {
          setCastData(cast);
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
      <Card className={cn("border border-gray-200 overflow-hidden", className)}>
        <CardContent className="p-4 sm:p-6 min-w-0">
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
      <Card className={cn("border border-red-200 bg-red-50 overflow-hidden", className)}>
        <CardContent className="p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-700 mb-2">Failed to load Farcaster post</p>
              <p className="text-xs text-red-600 break-words">{error}</p>
            </div>
            <a
              href={castUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 sm:px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center w-fit flex-shrink-0 max-w-[80px] sm:max-w-none"
            >
              <span className="truncate">View Post</span>
              <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!castData) {
    return (
      <Card className={cn("border border-gray-200 overflow-hidden", className)}>
        <CardContent className="p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-gray-600 text-sm">Farcaster post</span>
            <a
              href={castUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 sm:px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors flex items-center w-fit flex-shrink-0 max-w-[80px] sm:max-w-none"
            >
              <span className="truncate">View Post</span>
              <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border border-gray-200 bg-white overflow-hidden", className)}>
      <CardContent className="p-0 min-w-0">
        {/* Header with "Farcaster Post" label and external link */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">f</span>
            </div>
            <span className="text-sm font-medium text-gray-700">Farcaster Post</span>
          </div>
          <a
            href={castUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 sm:px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors flex items-center flex-shrink-0 max-w-[80px] sm:max-w-none"
          >
            <span className="hidden sm:inline truncate">View Original</span>
            <span className="sm:hidden">View</span>
            <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
          </a>
        </div>

        {/* Post Content */}
        <div className="p-4 sm:p-6">
          {/* Author Info */}
          <div className="flex items-center space-x-3 mb-4">
            <img
              src={castData.author.pfp_url}
              alt={castData.author.display_name}
              className="w-10 sm:w-12 h-10 sm:h-12 rounded-full border border-gray-200 flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm sm:text-base break-words">{castData.author.display_name}</p>
              <p className="text-sm text-gray-500 break-words">@{castData.author.username}</p>
            </div>
          </div>

          {/* Post Text */}
          {castData.text && (
            <div className="mb-4">
              <FormattedPostText 
                text={castData.text}
                className="max-w-full"
              />
            </div>
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
                      className="w-full max-w-full h-auto rounded-lg border border-gray-200 mb-2 object-contain"
                      style={{ maxWidth: '100%', height: 'auto' }}
                    />
                  ),
              )}
            </div>
          )}

          {/* Post Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500 pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-4 sm:space-x-6">
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
            </div>
            <div className="text-xs text-gray-400">
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