/**
 * Shared constants for ipecity-pulse
 * Single source of truth for validation limits, enums, and configuration
 */

// ============================================
// MEMBER TYPES & STATUSES
// ============================================

/**
 * Valid member types in the system
 */
export const MEMBER_TYPES = [
  'pending',
  'architect',
  'explorer',
  'admin',
  'org_team',
  'core_team',
] as const;

export type MemberType = (typeof MEMBER_TYPES)[number];

/**
 * Valid member statuses (state machine progression)
 */
export const MEMBER_STATUSES = [
  'pending_signer',
  'pending_id_verification',
  'email_verified',
  'pending_application',
  'pending_application_review',
  'approved_application',
  'denied_application',
  'active_member',
] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

/**
 * Statuses that indicate an active/approved member
 */
export const ACTIVE_MEMBER_STATUSES: readonly MemberStatus[] = [
  'active_member',
  'approved_application',
  'email_verified',
] as const;

// ============================================
// VALIDATION LIMITS
// ============================================

export const VALIDATION_LIMITS = {
  // Username
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,

  // Bio
  BIO_MAX_LENGTH: 1000,

  // Email
  EMAIL_MAX_LENGTH: 254,
  EMAIL_LOCAL_PART_MAX_LENGTH: 64,

  // Social media
  SOCIAL_HANDLE_MAX_LENGTH: 200,
  SOCIAL_URL_MAX_LENGTH: 200,

  // Profile tags
  MAX_PROFILE_TAGS: 10,
  TAG_MIN_LENGTH: 2,
  TAG_MAX_LENGTH: 30,

  // Wallet
  WALLET_ADDRESS_LENGTH: 42,

  // FID
  MAX_FID: 999999999,

  // Pulse
  PULSE_URL_MAX_LENGTH: 500,
  PULSE_DESCRIPTION_MAX_LENGTH: 1000,
} as const;

// ============================================
// VALIDATION PATTERNS
// ============================================

export const VALIDATION_PATTERNS = {
  // Username: lowercase alphanumeric only
  USERNAME: /^[a-z0-9]+$/,

  // Wallet address: 0x followed by 40 hex chars
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,

  // Profile tag: alphanumeric with spaces and hyphens
  PROFILE_TAG: /^[a-zA-Z0-9\s-]+$/,

  // Social media handle (simple)
  SOCIAL_HANDLE: /^[@]?[a-zA-Z0-9_.-]*$/,

  // Social media URLs
  SOCIAL_URL: /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com|linkedin\.com|instagram\.com)\/[\w\-\.\/]+\/?$/i,

  // Repeated characters (for detecting spam)
  REPEATED_CHARS: /(.)\1{3,}/,

  // Dangerous patterns for XSS prevention
  DANGEROUS_PATTERNS: [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ] as readonly RegExp[],
} as const;

// ============================================
// RESERVED USERNAMES
// ============================================

export const RESERVED_USERNAMES = [
  'admin',
  'root',
  'system',
  'api',
  'www',
  'ipecity',
  'pulse',
  'support',
  'help',
  'info',
] as const;

// ============================================
// PROFILE TAGS
// ============================================

export const PROFILE_TAGS = [
  'tech founder',
  'lawyer',
  'designer',
  'researcher',
  'student',
  'scientist',
  'creator',
  'developer',
  'public servant',
  'technologist',
] as const;

export type ProfileTag = (typeof PROFILE_TAGS)[number];

// ============================================
// TIMING CONSTANTS
// ============================================

export const TIMING = {
  // Polling intervals (ms)
  POLLING_INTERVAL_MS: 2000,
  FAST_POLLING_INTERVAL_MS: 1000,
  SLOW_POLLING_INTERVAL_MS: 5000,

  // Stale time for React Query (ms)
  STALE_TIME_MS: 1000,
  STALE_TIME_MEDIUM_MS: 2 * 60 * 1000, // 2 minutes
  STALE_TIME_LONG_MS: 5 * 60 * 1000, // 5 minutes

  // Circuit breaker
  CIRCUIT_BREAKER_TIMEOUT_MS: 30000,

  // Retries
  MAX_RETRIES: 3,

  // Email verification
  EMAIL_CODE_EXPIRY_MINUTES: 15,
  EMAIL_CODE_LENGTH: 6,

  // Passport verification
  PASSPORT_CHALLENGE_EXPIRY_MINUTES: 10,
} as const;

// ============================================
// API RATE LIMITS
// ============================================

export const RATE_LIMITS = {
  // General API
  REQUESTS_PER_MINUTE: 100,
  REQUESTS_PER_HOUR: 1000,

  // Email verification
  EMAIL_REQUESTS_PER_HOUR: 5,

  // Attestation
  ATTESTATION_REQUESTS_PER_MINUTE: 10,
  BULK_ATTESTATION_REQUESTS_PER_MINUTE: 2,
} as const;

// ============================================
// PULSE TYPES
// ============================================

export const PULSE_TYPES = {
  LIKE: 1,
  RECAST: 2,
  LIKE_AND_RECAST: 3,
} as const;

// ============================================
// TIMEZONE MAPPING
// ============================================

export const TIMEZONE_MAP: Record<string, string> = {
  'America/Sao_Paulo': 'Brazil Time',
  'America/New_York': 'Eastern Time',
  'America/Chicago': 'Central Time',
  'America/Denver': 'Mountain Time',
  'America/Los_Angeles': 'Pacific Time',
  'Europe/London': 'UK Time',
  'Europe/Paris': 'Central European Time',
  'Asia/Tokyo': 'Japan Time',
  'Asia/Shanghai': 'China Time',
  'Australia/Sydney': 'Sydney Time',
} as const;
