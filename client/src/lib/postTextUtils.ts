import { ReactNode } from "react";

interface TextSegment {
  type: 'text' | 'url' | 'mention' | 'hashtag' | 'emoji';
  content: string;
  href?: string;
  username?: string;
}

interface ParsedContent {
  segments: TextSegment[];
  paragraphs: TextSegment[][];
}

// Regex patterns for different content types
const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const MENTION_REGEX = /(@[a-zA-Z0-9._-]+)/g;
const HASHTAG_REGEX = /(#[a-zA-Z0-9_-]+)/g;
// Simplified emoji detection - focusing on common emojis used in formatting
const EMOJI_INDICATORS = /([📅📺🎬🔗⚡️✨💫🌟])/g;

/**
 * Detects natural paragraph breaks in Farcaster post text
 * Looks for common patterns like:
 * - Double line breaks
 * - Period followed by capital letter with significant spacing
 * - Emoji clusters followed by new content
 * - URL followed by new content
 */
export function detectParagraphBreaks(text: string): string[] {
  // First, split on explicit double line breaks
  let paragraphs = text.split(/\n\s*\n/);
  
  // If no explicit breaks, try to detect semantic breaks
  if (paragraphs.length === 1) {
    // Split on patterns that indicate natural paragraph breaks
    // Look for sentence endings followed by capital letters, or emoji indicators
    paragraphs = text.split(/(?:\. )(?=[A-Z])|(?:[📅🎬🔗📺])\s*(?=[A-Z])/);
  }
  
  // Clean up paragraphs and filter out empty ones
  return paragraphs
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Parses a single line of text into segments with different types
 */
export function parseTextLine(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;
  
  // Find all matches for different patterns
  const allMatches: Array<{ type: TextSegment['type'], match: RegExpMatchArray, regex: RegExp }> = [];
  
  // URL matches
  let match;
  const urlRegex = new RegExp(URL_REGEX);
  while ((match = urlRegex.exec(text)) !== null) {
    allMatches.push({ type: 'url', match, regex: urlRegex });
  }
  
  // Mention matches
  const mentionRegex = new RegExp(MENTION_REGEX);
  while ((match = mentionRegex.exec(text)) !== null) {
    allMatches.push({ type: 'mention', match, regex: mentionRegex });
  }
  
  // Hashtag matches
  const hashtagRegex = new RegExp(HASHTAG_REGEX);
  while ((match = hashtagRegex.exec(text)) !== null) {
    allMatches.push({ type: 'hashtag', match, regex: hashtagRegex });
  }
  
  // Sort matches by position
  allMatches.sort((a, b) => a.match.index! - b.match.index!);
  
  // Process matches and create segments
  for (const { type, match } of allMatches) {
    const matchIndex = match.index!;
    const matchText = match[0];
    
    // Add text before this match
    if (matchIndex > currentIndex) {
      const textBefore = text.slice(currentIndex, matchIndex);
      if (textBefore.trim()) {
        segments.push({
          type: 'text',
          content: textBefore
        });
      }
    }
    
    // Add the special segment
    if (type === 'url') {
      segments.push({
        type: 'url',
        content: matchText,
        href: matchText
      });
    } else if (type === 'mention') {
      segments.push({
        type: 'mention',
        content: matchText,
        username: matchText.slice(1) // Remove @
      });
    } else if (type === 'hashtag') {
      segments.push({
        type: 'hashtag',
        content: matchText
      });
    }
    
    currentIndex = matchIndex + matchText.length;
  }
  
  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.slice(currentIndex);
    if (remainingText.trim()) {
      segments.push({
        type: 'text',
        content: remainingText
      });
    }
  }
  
  // If no special segments found, return the whole text as one segment
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text
    });
  }
  
  return segments;
}

/**
 * Parses full Farcaster post text into structured paragraphs with typed segments
 */
export function parseFarcasterPostText(text: string): ParsedContent {
  const paragraphs = detectParagraphBreaks(text);
  
  const parsedParagraphs = paragraphs.map(paragraph => {
    return parseTextLine(paragraph);
  });
  
  // Flatten for backwards compatibility
  const allSegments = parsedParagraphs.flat();
  
  return {
    segments: allSegments,
    paragraphs: parsedParagraphs
  };
}

/**
 * Utility to check if text should be treated as a single paragraph
 */
export function shouldUseParagraphs(text: string): boolean {
  // Use paragraphs if text is long enough or has natural breaks
  return text.length > 200 || 
         text.includes('\n\n') || 
         text.match(/\. [A-Z]/) !== null ||
         text.includes('📅') || text.includes('🎬') || text.includes('🔗') || text.includes('📺');
}

/**
 * Enhanced formatting for different segment types
 */
export function getSegmentClassName(segment: TextSegment): string {
  switch (segment.type) {
    case 'url':
      return 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium';
    case 'mention':
      return 'text-purple-600 font-medium bg-purple-50 px-1 rounded';
    case 'hashtag':
      return 'text-blue-500 font-medium hover:text-blue-700';
    case 'text':
    default:
      return 'text-gray-800';
  }
}