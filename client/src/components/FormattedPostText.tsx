import React from "react";
import { cn } from "@/lib/utils";
import { 
  parseFarcasterPostText, 
  shouldUseParagraphs, 
  getSegmentClassName 
} from "@/lib/postTextUtils";

interface FormattedPostTextProps {
  text: string;
  className?: string;
}

export function FormattedPostText({ text, className }: FormattedPostTextProps) {
  if (!text) return null;
  
  const parsed = parseFarcasterPostText(text);
  const useParagraphs = shouldUseParagraphs(text);
  
  const handleLinkClick = (href: string) => {
    window.open(href, '_blank', 'noopener noreferrer');
  };
  
  const handleMentionClick = (username: string) => {
    window.open(`https://warpcast.com/${username}`, '_blank', 'noopener noreferrer');
  };
  
  const renderSegment = (segment: any, index: number) => {
    const segmentClass = getSegmentClassName(segment);
    
    switch (segment.type) {
      case 'url':
        return (
          <span
            key={index}
            className={cn(segmentClass, "transition-colors")}
            onClick={() => handleLinkClick(segment.href!)}
            title={`Open ${segment.href}`}
          >
            {segment.content}
          </span>
        );
      
      case 'mention':
        return (
          <span
            key={index}
            className={cn(segmentClass, "transition-colors cursor-pointer")}
            onClick={() => handleMentionClick(segment.username!)}
            title={`View @${segment.username} on Farcaster`}
          >
            {segment.content}
          </span>
        );
      
      case 'hashtag':
        return (
          <span
            key={index}
            className={cn(segmentClass, "transition-colors cursor-pointer")}
            title={`Hashtag: ${segment.content}`}
          >
            {segment.content}
          </span>
        );
      
      case 'text':
      default:
        return (
          <span key={index} className={segmentClass}>
            {segment.content}
          </span>
        );
    }
  };
  
  if (!useParagraphs) {
    // Render as single line with inline formatting
    return (
      <div className={cn("text-gray-800 leading-relaxed text-sm sm:text-base break-words overflow-wrap-anywhere", className)}>
        {parsed.segments.map(renderSegment)}
      </div>
    );
  }
  
  // Render with proper paragraph breaks
  return (
    <div className={cn("text-gray-800 leading-relaxed text-sm sm:text-base break-words overflow-wrap-anywhere space-y-3", className)}>
      {parsed.paragraphs.map((paragraphSegments, paragraphIndex) => (
        <p key={paragraphIndex} className="mb-3 last:mb-0">
          {paragraphSegments.map(renderSegment)}
        </p>
      ))}
    </div>
  );
}