/**
 * CastDisplay — renders a Farcaster cast with author info, text, embeds,
 * reaction counts, and action buttons (Like/Recast/Abstain).
 */

import { Heart, Repeat, Ban, X } from "lucide-react";
import { FormattedPostText } from "@/components/FormattedPostText";

interface CastDisplayProps {
  castData: any;
  stats: {
    liked: boolean;
    recasted: boolean;
    quotedRecast: boolean;
    regularRecast: boolean;
  } | null;
  executionStatus: { liked: boolean; shared: boolean; abstained: boolean };
  actionLoading: { like: boolean; recast: boolean; abstain: boolean };
  onReaction: (type: "like" | "recast") => void;
  onPulseAction: (action: "like" | "share" | "abstain") => void;
}

export function CastDisplay({
  castData,
  stats,
  executionStatus,
  actionLoading,
  onReaction,
  onPulseAction,
}: CastDisplayProps) {
  if (!castData) return null;

  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg">
      {/* Author info */}
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

      {/* Post text */}
      <div className="mb-4">
        <FormattedPostText
          text={castData.text}
          className="max-w-full"
        />
      </div>

      {/* Image embeds */}
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

      {/* Reactions and action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>❤️ {castData.reactions.likes_count}</span>
          <span>🔄 {castData.reactions.recasts_count}</span>
          <span>💬 {castData.replies.count}</span>
        </div>

        <div className="flex flex-wrap gap-1 sm:gap-2 min-w-0 justify-center sm:justify-end">
          {/* Like button */}
          <button
            onClick={() => onReaction("like")}
            disabled={actionLoading.like || executionStatus.abstained}
            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${stats?.liked
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700 hover:bg-red-50"
              }`}
          >
            {actionLoading.like ? (
              <span className="flex items-center">
                <span className="animate-spin mr-1">⏳</span>
                <span className="hidden sm:inline">Liking...</span>
              </span>
            ) : (
              <span className="flex items-center">
                <Heart className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0 ${stats?.liked ? "text-red-600" : "text-gray-500"}`} />
                <span className="hidden sm:inline">{stats?.liked ? "Liked" : "Like"}</span>
              </span>
            )}
          </button>

          {/* Recast button */}
          <button
            onClick={() => onReaction("recast")}
            disabled={actionLoading.recast || executionStatus.abstained}
            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${stats?.recasted
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700 hover:bg-blue-50"
              }`}
          >
            {actionLoading.recast ? (
              <span className="flex items-center">
                <span className="animate-spin mr-1">⏳</span>
                <span className="hidden sm:inline">Recasting...</span>
              </span>
            ) : (
              <span className="flex items-center">
                <Repeat className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0 ${stats?.recasted ? "text-blue-600" : "text-gray-500"}`} />
                <span className="hidden sm:inline">{stats?.recasted ? "Shared" : "Share"}</span>
              </span>
            )}
          </button>

          {/* Abstain button */}
          <button
            onClick={() => onPulseAction('abstain')}
            disabled={actionLoading.abstain || !!(stats?.liked || stats?.recasted)}
            className={`px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${executionStatus.abstained
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700 hover:bg-yellow-50"
              }`}
          >
            {actionLoading.abstain ? (
              <span className="flex items-center">
                <span className="animate-spin mr-1">⏳</span>
                <span className="hidden sm:inline">Recording...</span>
              </span>
            ) : (
              <span className="flex items-center">
                {executionStatus.abstained ? (
                  <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0 text-yellow-600" />
                ) : (
                  <Ban className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0 text-gray-500" />
                )}
                <span className="hidden sm:inline">{executionStatus.abstained ? "Cancel" : "Abstain"}</span>
                <span className="sm:hidden">{executionStatus.abstained ? "✗" : "Skip"}</span>
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
