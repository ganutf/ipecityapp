import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Social media URL validation and formatting utilities
export type SocialPlatform = "twitter" | "linkedin" | "instagram";

export interface SocialMediaValidation {
  isValid: boolean;
  formattedUrl?: string;
  error?: string;
}

export function validateSocialMediaUrl(url: string, platform: SocialPlatform): SocialMediaValidation {
  if (!url.trim()) {
    return { isValid: true }; // Empty is valid (optional field)
  }

  // Clean the input
  const cleanUrl = url.trim();
  
  // Try to format the URL if it's incomplete
  const formattedUrl = formatSocialMediaUrl(cleanUrl, platform);
  
  // Validate the formatted URL
  try {
    const urlObj = new URL(formattedUrl);
    
    switch (platform) {
      case "twitter":
        if (!["x.com", "twitter.com"].includes(urlObj.hostname)) {
          return { isValid: false, error: "Must be a valid X.com or Twitter.com URL" };
        }
        if (!urlObj.pathname.match(/^\/[a-zA-Z0-9_]+\/?$/)) {
          return { isValid: false, error: "Invalid Twitter username format" };
        }
        break;
        
      case "linkedin":
        if (urlObj.hostname !== "linkedin.com" && urlObj.hostname !== "www.linkedin.com") {
          return { isValid: false, error: "Must be a valid LinkedIn.com URL" };
        }
        if (!urlObj.pathname.match(/^\/(in|company)\/[a-zA-Z0-9\-_]+\/?$/)) {
          return { isValid: false, error: "Invalid LinkedIn profile format" };
        }
        break;
        
      case "instagram":
        if (urlObj.hostname !== "instagram.com" && urlObj.hostname !== "www.instagram.com") {
          return { isValid: false, error: "Must be a valid Instagram.com URL" };
        }
        if (!urlObj.pathname.match(/^\/[a-zA-Z0-9\._]+\/?$/)) {
          return { isValid: false, error: "Invalid Instagram username format" };
        }
        break;
    }
    
    return { isValid: true, formattedUrl };
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }
}

export function formatSocialMediaUrl(input: string, platform: SocialPlatform): string {
  if (!input.trim()) return "";
  
  let cleanInput = input.trim();
  
  // Remove @ if present
  if (cleanInput.startsWith("@")) {
    cleanInput = cleanInput.substring(1);
  }
  
  // If it's already a URL, return as is
  if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
    // Convert twitter.com to x.com
    if (platform === "twitter" && cleanInput.includes("twitter.com")) {
      cleanInput = cleanInput.replace("twitter.com", "x.com");
    }
    return cleanInput;
  }
  
  // If it contains a domain, add https://
  if (cleanInput.includes(".com")) {
    // Convert twitter.com to x.com
    if (platform === "twitter" && cleanInput.includes("twitter.com")) {
      cleanInput = cleanInput.replace("twitter.com", "x.com");
    }
    return `https://${cleanInput}`;
  }
  
  // Otherwise, treat as username and build URL
  switch (platform) {
    case "twitter":
      return `https://x.com/${cleanInput}`;
    case "linkedin":
      // Default to /in/ for personal profiles
      return `https://linkedin.com/in/${cleanInput}`;
    case "instagram":
      return `https://instagram.com/${cleanInput}`;
    default:
      return cleanInput;
  }
}

export function extractUsernameFromUrl(url: string, platform: SocialPlatform): string {
  if (!url) return "";
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    switch (platform) {
      case "twitter":
        const twitterMatch = pathname.match(/^\/([a-zA-Z0-9_]+)\/?$/);
        return twitterMatch ? twitterMatch[1] : "";
        
      case "linkedin":
        const linkedinMatch = pathname.match(/^\/(in|company)\/([a-zA-Z0-9\-_]+)\/?$/);
        return linkedinMatch ? linkedinMatch[2] : "";
        
      case "instagram":
        const instagramMatch = pathname.match(/^\/([a-zA-Z0-9\._]+)\/?$/);
        return instagramMatch ? instagramMatch[1] : "";
        
      default:
        return "";
    }
  } catch {
    return "";
  }
}
