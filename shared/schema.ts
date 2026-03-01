import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  date,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Community members table
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  // Privy Auth: Primary identifier for Privy users
  privyId: varchar("privy_id", { length: 255 }).unique(),
  // Auth V2: Link to auth_users table (nullable for migration period)
  userId: varchar("user_id", { length: 36 }).references(() => authUsers.id),
  // Legacy: Farcaster FID (now nullable for new auth flow)
  farcasterFid: integer("farcaster_fid").unique(),
  walletAddress: varchar("wallet_address", { length: 42 }),
  
  // State machine fields - restricted by database CHECK constraint
  // Valid values: pending_id_verification, pending_application_review, approved_application, denied_application, active_member
  status: varchar("status", { length: 30 }).default("pending_id_verification").notNull(),
  // Valid member types: pending, architect, explorer, admin, org_team, core_team
  memberType: varchar("member_type", { length: 20 }).default("pending").notNull(),
  
  // Verification flags
  emailVerified: boolean("email_verified").default(false).notNull(),
  passportVerified: boolean("passport_verified").default(false).notNull(),
  
  // Email system
  email: varchar("email", { length: 255 }),
  
  // Passport/Username system
  ipeUsername: varchar("ipe_username", { length: 100 }),
  ipePassport: varchar("ipe_passport", { length: 255 }),
  
  // Profile/Application fields
  bio: text("bio"),
  twitter: varchar("twitter", { length: 100 }),
  linkedin: varchar("linkedin", { length: 100 }),
  instagram: varchar("instagram", { length: 100 }),
  profileTags: text("profile_tags").array(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_members_email").on(table.email),
  index("idx_members_ipe_username").on(table.ipeUsername),
  index("idx_members_status").on(table.status),
]);

// Member wallets table - tracks all wallets linked by each member
export const memberWallets = pgTable("member_wallets", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  walletType: varchar("wallet_type", { length: 30 }).notNull(), // 'external' | 'privy_embedded'
  label: varchar("label", { length: 100 }), // e.g. "MetaMask", "Coinbase Wallet"
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
}, (table) => [
  index("idx_member_wallets_member_id").on(table.memberId),
]);

// Pulse types table - defines different types of pulses
export const pulseTypes = pgTable("pulse_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pulses table - admin-created engagement tasks
export const pulses = pgTable("pulses", {
  id: serial("id").primaryKey(),
  urlEmbed: text("url_embed").notNull(), // renamed from farcasterUrl
  datetimeStart: timestamp("datetime_start").notNull(), // changed from date to datetime
  interval: integer("interval").notNull(), // interval in hours
  description: text("description").notNull(),
  points: integer("points").notNull(), // points awarded for completing this pulse
  pulseTypeId: integer("pulse_type_id").references(() => pulseTypes.id).notNull(),
  createdBy: integer("created_by").references(() => members.id).notNull(), // changed to member ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Pulse executions - tracking member interactions
export const pulseExecutions = pgTable("pulse_executions", {
  id: serial("id").primaryKey(),
  pulseId: integer("pulse_id").references(() => pulses.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  actions: jsonb("actions").notNull(), // JSON: {liked: boolean, shared: boolean, abstained: boolean}
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  // Unique constraint: only one execution per member per pulse
  unique("pulse_executions_unique_member_pulse").on(table.pulseId, table.memberId),
  index("idx_pulse_executions_pulse_id").on(table.pulseId),
  index("idx_pulse_executions_member_id").on(table.memberId),
]);

// Attestations - EAS attestations for pulse completions
export const attestations = pgTable("attestations", {
  id: serial("id").primaryKey(),
  pulseExecutionId: integer("pulse_execution_id").references(() => pulseExecutions.id).notNull().unique(), // Prevent duplicates
  attestationUid: varchar("attestation_uid", { length: 255 }), // Nullable for pending status
  transactionHash: varchar("transaction_hash", { length: 255 }), // Nullable for pending status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'completed' | 'failed'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_attestations_status").on(table.status),
]);

// User signers - individual Farcaster signers per user
export const userSigners = pgTable("user_signers", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  farcasterFid: integer("farcaster_fid").notNull(), // Keep for external API compatibility
  signerUuid: varchar("signer_uuid").notNull(),
  publicKey: varchar("public_key"),
  status: varchar("status"), // "pending_approval", "approved", "revoked", etc.
  approvalUrl: varchar("approval_url"), // Using existing column name
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_signers_member_id").on(table.memberId),
]);

// Relations
export const membersRelations = relations(members, ({ one, many }) => ({
  authUser: one(authUsers, {
    fields: [members.userId],
    references: [authUsers.id],
  }),
  pulseExecutions: many(pulseExecutions),
  createdPulses: many(pulses, { relationName: "PulseCreator" }),
  wallets: many(memberWallets),
}));

export const memberWalletsRelations = relations(memberWallets, ({ one }) => ({
  member: one(members, {
    fields: [memberWallets.memberId],
    references: [members.id],
  }),
}));

export const pulseTypesRelations = relations(pulseTypes, ({ many }) => ({
  pulses: many(pulses),
}));

export const pulsesRelations = relations(pulses, ({ one, many }) => ({
  pulseExecutions: many(pulseExecutions),
  pulseType: one(pulseTypes, {
    fields: [pulses.pulseTypeId],
    references: [pulseTypes.id],
  }),
  creator: one(members, {
    fields: [pulses.createdBy],
    references: [members.id],
    relationName: "PulseCreator",
  }),
}));

export const pulseExecutionsRelations = relations(pulseExecutions, ({ one, many }) => ({
  pulse: one(pulses, {
    fields: [pulseExecutions.pulseId],
    references: [pulses.id],
  }),
  member: one(members, {
    fields: [pulseExecutions.memberId],
    references: [members.id],
  }),
  attestations: many(attestations),
}));

export const attestationsRelations = relations(attestations, ({ one }) => ({
  pulseExecution: one(pulseExecutions, {
    fields: [attestations.pulseExecutionId],
    references: [pulseExecutions.id],
  }),
}));

export const userSignersRelations = relations(userSigners, ({ one }) => ({
  member: one(members, {
    fields: [userSigners.memberId],
    references: [members.id],
  }),
}));

// ============================================
// AUTH SYSTEM V2 TABLES
// ============================================

// Auth users - Primary authentication (replaces Farcaster as auth provider)
export const authUsers = pgTable("auth_users", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Passkeys - WebAuthn credentials for passwordless authentication
export const passkeys = pgTable("passkeys", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => authUsers.id).notNull(),
  credentialId: varchar("credential_id", { length: 512 }).notNull().unique(),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").default(0),
  transports: text("transports").array(),
  deviceName: varchar("device_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

// Smart wallets - Auto-created wallets using passkey as signer
export const smartWallets = pgTable("smart_wallets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => authUsers.id).notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  walletType: varchar("wallet_type", { length: 20 }).notNull(), // 'coinbase' | 'safe'
  chainId: integer("chain_id").default(8453), // Base mainnet
  passkeyId: integer("passkey_id").references(() => passkeys.id),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Farcaster accounts - Optional Farcaster connection (no longer auth provider)
export const farcasterAccounts = pgTable("farcaster_accounts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 }).references(() => authUsers.id).notNull(),
  farcasterFid: integer("farcaster_fid").notNull().unique(),
  username: varchar("username", { length: 255 }),
  custodyAddress: varchar("custody_address", { length: 42 }),
  imported: boolean("imported").default(false), // true if linked from existing account
  createdAt: timestamp("created_at").defaultNow(),
});

// Auth V2 Relations
export const authUsersRelations = relations(authUsers, ({ many }) => ({
  passkeys: many(passkeys),
  smartWallets: many(smartWallets),
  farcasterAccounts: many(farcasterAccounts),
  members: many(members),
}));

export const passkeysRelations = relations(passkeys, ({ one }) => ({
  user: one(authUsers, {
    fields: [passkeys.userId],
    references: [authUsers.id],
  }),
}));

export const smartWalletsRelations = relations(smartWallets, ({ one }) => ({
  user: one(authUsers, {
    fields: [smartWallets.userId],
    references: [authUsers.id],
  }),
  passkey: one(passkeys, {
    fields: [smartWallets.passkeyId],
    references: [passkeys.id],
  }),
}));

export const farcasterAccountsRelations = relations(farcasterAccounts, ({ one }) => ({
  user: one(authUsers, {
    fields: [farcasterAccounts.userId],
    references: [authUsers.id],
  }),
}));

// ============================================
// LEGACY TABLES (kept for backward compatibility)
// ============================================

// Email verification table
export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  farcasterFid: integer("farcaster_fid").notNull(), // Keep for external API compatibility
  email: varchar("email").notNull(),
  verificationCode: varchar("verification_code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Passport verification table
export const passportVerifications = pgTable("passport_verifications", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  farcasterFid: integer("farcaster_fid").notNull(), // Keep for external API compatibility
  ipePassport: varchar("ipe_passport").notNull(),
  verificationToken: varchar("verification_token").unique().notNull(),
  challengeMessage: text("challenge_message").notNull(),
  verified: boolean("verified").default(false).notNull(),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Member type validation - using shared constants
import { MEMBER_TYPES, VALIDATION_LIMITS, VALIDATION_PATTERNS, RESERVED_USERNAMES } from './constants';
export type { MemberType, MemberStatus, ProfileTag } from './constants';

export const memberTypeEnum = z.enum(MEMBER_TYPES as unknown as [string, ...string[]]);

// Insert schemas
export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMemberSchema = createInsertSchema(members).omit({
  id: true,
  farcasterFid: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// Enhanced validation schemas with security measures - using shared constants
export const secureUsernameSchema = z.string()
  .min(VALIDATION_LIMITS.USERNAME_MIN_LENGTH, `Username must be at least ${VALIDATION_LIMITS.USERNAME_MIN_LENGTH} characters`)
  .max(VALIDATION_LIMITS.USERNAME_MAX_LENGTH, `Username must be at most ${VALIDATION_LIMITS.USERNAME_MAX_LENGTH} characters`)
  .regex(VALIDATION_PATTERNS.USERNAME, "Username can only contain lowercase letters and numbers")
  .refine(val => !RESERVED_USERNAMES.includes(val as typeof RESERVED_USERNAMES[number]), "Reserved username")
  .refine(val => !VALIDATION_PATTERNS.REPEATED_CHARS.test(val), "Username cannot have repeated characters");

export const secureEmailSchema = z.string()
  .email("Invalid email address")
  .max(VALIDATION_LIMITS.EMAIL_MAX_LENGTH, "Email address too long")
  .refine(val => !/<|>|"|'/.test(val), "Email contains invalid characters")
  .refine(val => val.split('@')[0].length <= VALIDATION_LIMITS.EMAIL_LOCAL_PART_MAX_LENGTH, "Email local part too long");

export const secureBioSchema = z.string()
  .max(VALIDATION_LIMITS.BIO_MAX_LENGTH, "Bio too long")
  .refine(val => {
    return !VALIDATION_PATTERNS.DANGEROUS_PATTERNS.some(pattern => pattern.test(val));
  }, "Bio contains potentially dangerous content")
  .refine(val => !/(https?:\/\/[^\s]+)/gi.test(val), "URLs not allowed in bio")
  .optional();

export const secureSocialHandleSchema = z.string()
  .max(VALIDATION_LIMITS.SOCIAL_HANDLE_MAX_LENGTH, "Social media URL too long")
  .refine(val => {
    if (!val.trim()) return true; // Empty is valid

    // Test simple handle first
    if (VALIDATION_PATTERNS.SOCIAL_HANDLE.test(val)) return true;

    // Test URL patterns
    if (VALIDATION_PATTERNS.SOCIAL_URL.test(val)) return true;

    return false;
  }, "Invalid social media handle or URL format")
  .optional();

export const secureWalletAddressSchema = z.string()
  .regex(VALIDATION_PATTERNS.WALLET_ADDRESS, "Invalid Ethereum wallet address")
  .length(VALIDATION_LIMITS.WALLET_ADDRESS_LENGTH, `Wallet address must be ${VALIDATION_LIMITS.WALLET_ADDRESS_LENGTH} characters`);

export const secureProfileTagsSchema = z.array(
  z.string()
    .min(VALIDATION_LIMITS.TAG_MIN_LENGTH, "Tag too short")
    .max(VALIDATION_LIMITS.TAG_MAX_LENGTH, "Tag too long")
    .regex(VALIDATION_PATTERNS.PROFILE_TAG, "Tag contains invalid characters")
    .refine(val => val.trim().length >= VALIDATION_LIMITS.TAG_MIN_LENGTH, "Tag cannot be empty after trimming")
).max(VALIDATION_LIMITS.MAX_PROFILE_TAGS, "Too many tags").optional();

export const secureFidSchema = z.number()
  .int("FID must be an integer")
  .positive("FID must be positive")
  .max(VALIDATION_LIMITS.MAX_FID, "FID too large");

// Application schema for comprehensive application submission
export const applicationSchema = createInsertSchema(members).pick({
  farcasterFid: true,
  ipeUsername: true,
  bio: true,
  twitter: true,
  linkedin: true,
  instagram: true,
  profileTags: true,
  walletAddress: true,
}).extend({
  farcasterFid: secureFidSchema,
  ipeUsername: secureUsernameSchema,
  bio: secureBioSchema,
  twitter: secureSocialHandleSchema,
  linkedin: secureSocialHandleSchema,
  instagram: secureSocialHandleSchema,
  profileTags: secureProfileTagsSchema,
  walletAddress: secureWalletAddressSchema,
});

// Application schema with member ID
export const applicationByMemberIdSchema = createInsertSchema(members).pick({
  ipeUsername: true,
  bio: true,
  twitter: true,
  linkedin: true,
  instagram: true,
  profileTags: true,
  walletAddress: true,
}).extend({
  memberId: z.number().int().positive(),
  ipeUsername: secureUsernameSchema,
  bio: secureBioSchema,
  twitter: secureSocialHandleSchema,
  linkedin: secureSocialHandleSchema,
  instagram: secureSocialHandleSchema,
  profileTags: secureProfileTagsSchema,
  walletAddress: secureWalletAddressSchema,
});

// Enhanced email verification schema
export const emailVerificationRequestSchema = createInsertSchema(members).pick({
  farcasterFid: true,
  email: true,
}).extend({
  farcasterFid: secureFidSchema,
  email: secureEmailSchema,
});

// Email verification with member ID
export const emailVerificationRequestByMemberIdSchema = z.object({
  memberId: z.number().int().positive(),
  email: secureEmailSchema,
});

// Secure URL validation for embeds
export const secureUrlEmbedSchema = z.string()
  .url("Invalid URL format")
  .max(2048, "URL too long")
  .refine(val => {
    try {
      const url = new URL(val);
      return ['warpcast.com', 'farcaster.xyz', 'x.com', 'twitter.com'].includes(url.hostname);
    } catch {
      return false;
    }
  }, "Must be a valid social media URL (warpcast.com, farcaster.xyz, x.com, or twitter.com)")
  .refine(val => !val.includes('<script'), "URL contains invalid content");

export const secureDatetimeSchema = z.string()
  .refine(val => {
    // Accept standard ISO datetime strings (with or without milliseconds and timezone)
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?([Z]|[+-]\d{2}:\d{2})?$/;
    return isoDatePattern.test(val);
  }, "Datetime must be a valid ISO datetime string (e.g., 2025-08-08T14:10:00.000Z)")
  .transform(val => {
    // Parse as-is since ISO strings already contain timezone information
    const utcDate = new Date(val);
    if (isNaN(utcDate.getTime())) {
      throw new Error('Invalid datetime format');
    }
    return utcDate;
  })
  .refine(val => {
    const now = new Date();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);
    
    return val >= now && val <= oneYearFromNow;
  }, "Datetime must be between now and one year from now");

export const secureIntervalSchema = z.number()
  .int("Interval must be an integer")
  .min(1, "Interval must be at least 1 hour")
  .max(8760, "Interval cannot exceed 1 year (8760 hours)");

export const secureDescriptionSchema = z.string()
  .min(1, "Description cannot be empty")
  .max(500, "Description too long")
  .refine(val => {
    const dangerousPatterns = [
      /<script/i, /javascript:/i, /data:/i, /vbscript:/i
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  }, "Description contains invalid content");

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
}).extend({
  memberId: z.number().int().positive(),
  farcasterFid: secureFidSchema,
  email: secureEmailSchema,
  verificationCode: z.string().length(6, "Verification code must be 6 digits").regex(/^\d+$/, "Code must be numeric"),
});

export const insertPassportVerificationSchema = createInsertSchema(passportVerifications).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
}).extend({
  memberId: z.number().int().positive(),
  farcasterFid: secureFidSchema,
  ipePassport: z.string().max(255, "Passport name too long"),
  verificationToken: z.string().min(32, "Invalid verification token"),
});

// Pulse type schemas
export const insertPulseTypeSchema = createInsertSchema(pulseTypes).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name too long"),
  description: secureDescriptionSchema,
});

export const insertPulseSchema = createInsertSchema(pulses).omit({
  id: true,
  createdAt: true,
}).extend({
  urlEmbed: secureUrlEmbedSchema,
  datetimeStart: secureDatetimeSchema,
  interval: secureIntervalSchema,
  description: secureDescriptionSchema,
  points: z.number().int().positive().max(1000, "Points must be between 1 and 1000"),
  pulseTypeId: z.number().int().positive(),
  createdBy: z.number().int().positive(),
});

export const updatePulseSchema = createInsertSchema(pulses).omit({
  id: true,
  createdAt: true,
  createdBy: true, // Don't allow changing creator
}).extend({
  urlEmbed: secureUrlEmbedSchema.optional(),
  datetimeStart: secureDatetimeSchema.optional(),
  interval: secureIntervalSchema.optional(),
  description: secureDescriptionSchema.optional(),
  points: z.number().int().positive().max(1000, "Points must be between 1 and 1000").optional(),
  pulseTypeId: z.number().int().positive().optional(),
}).partial();

// Verification code validation
export const verificationCodeSchema = z.object({
  farcasterFid: secureFidSchema,
  code: z.string().length(6, "Verification code must be 6 characters").regex(/^\d+$/, "Code must be numeric")
});

// Verification code validation with member ID
export const verificationCodeByMemberIdSchema = z.object({
  memberId: z.number().int().positive(),
  code: z.string().length(6, "Verification code must be 6 characters").regex(/^\d+$/, "Code must be numeric")
});

// Username claim validation
export const usernameClaimSchema = z.object({
  farcasterFid: secureFidSchema,
  username: secureUsernameSchema,
  walletAddress: secureWalletAddressSchema
});

// Username claim validation with member ID
export const usernameClaimByMemberIdSchema = z.object({
  memberId: z.number().int().positive(),
  username: secureUsernameSchema,
  walletAddress: secureWalletAddressSchema
});

// Actions schema for pulse executions
export const pulseExecutionActionsSchema = z.object({
  liked: z.boolean(),
  shared: z.boolean(),
  abstained: z.boolean(),
});

export const insertPulseExecutionSchema = createInsertSchema(pulseExecutions).omit({
  id: true,
  executedAt: true,
}).extend({
  memberId: z.number().int().positive(),
  pulseId: z.number().int().positive(),
  actions: pulseExecutionActionsSchema,
});

export const insertUserSignerSchema = createInsertSchema(userSigners).omit({
  id: true,
  createdAt: true,
}).extend({
  memberId: z.number().int().positive(),
  farcasterFid: secureFidSchema,
});

export const insertAttestationSchema = createInsertSchema(attestations).omit({
  id: true,
  createdAt: true,
}).extend({
  pulseExecutionId: z.number().int().positive(),
  attestationUid: z.string().min(1, "Attestation UID required").max(255, "Attestation UID too long").optional(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash").optional(),
  status: z.enum(['pending', 'completed', 'failed']),
}).refine((data) => {
  // For completed status, both attestationUid and transactionHash are required
  if (data.status === 'completed') {
    return data.attestationUid && data.transactionHash;
  }
  // For pending/failed status, they can be optional
  return true;
}, {
  message: "Attestation UID and transaction hash are required for completed status",
});

// Types
export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type PassportVerification = typeof passportVerifications.$inferSelect;
export type InsertPassportVerification = z.infer<typeof insertPassportVerificationSchema>;
export type PulseType = typeof pulseTypes.$inferSelect;
export type InsertPulseType = z.infer<typeof insertPulseTypeSchema>;
export type Pulse = typeof pulses.$inferSelect;
export type InsertPulse = z.infer<typeof insertPulseSchema>;
export type UpdatePulse = z.infer<typeof updatePulseSchema>;
export type PulseExecution = typeof pulseExecutions.$inferSelect;
export type InsertPulseExecution = z.infer<typeof insertPulseExecutionSchema>;
export type PulseExecutionActions = z.infer<typeof pulseExecutionActionsSchema>;
export type UserSigner = typeof userSigners.$inferSelect;
export type InsertUserSigner = z.infer<typeof insertUserSignerSchema>;
export type Attestation = typeof attestations.$inferSelect;
export type InsertAttestation = z.infer<typeof insertAttestationSchema>;
export type MemberWallet = typeof memberWallets.$inferSelect;
export type InsertMemberWallet = typeof memberWallets.$inferInsert;

// ============================================
// ADMIN V2 VALIDATION SCHEMAS
// ============================================

export const approveMemberSchema = z.object({
  memberId: z.number().int().positive(),
  ipeUsername: secureUsernameSchema,
  userWalletAddress: secureWalletAddressSchema.optional(),
  memberType: memberTypeEnum.optional(),
});

export const denyMemberSchema = z.object({
  memberId: z.number().int().positive(),
});

export const updateMemberTypeSchema = z.object({
  memberId: z.number().int().positive(),
  memberType: memberTypeEnum,
});

// Request types
export type ApproveMemberRequest = z.infer<typeof approveMemberSchema>;
export type DenyMemberRequest = z.infer<typeof denyMemberSchema>;
export type UpdateMemberTypeRequest = z.infer<typeof updateMemberTypeSchema>;
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationByMemberIdRequest = z.infer<typeof emailVerificationRequestByMemberIdSchema>;
export type ApplicationByMemberId = z.infer<typeof applicationByMemberIdSchema>;
export type VerificationCodeByMemberId = z.infer<typeof verificationCodeByMemberIdSchema>;
export type UsernameClaimByMemberId = z.infer<typeof usernameClaimByMemberIdSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============================================
// AUTH V2 SCHEMAS AND TYPES
// ============================================

// Auth user schemas
export const insertAuthUserSchema = createInsertSchema(authUsers).omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  id: z.string().uuid(),
  email: secureEmailSchema,
});

// Passkey schemas
export const insertPasskeySchema = createInsertSchema(passkeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
}).extend({
  userId: z.string().uuid(),
  credentialId: z.string().min(1).max(512),
  publicKey: z.string().min(1),
  signCount: z.number().int().min(0).optional(),
  transports: z.array(z.string()).optional(),
  deviceName: z.string().max(255).optional(),
});

// Smart wallet schemas
export const insertSmartWalletSchema = createInsertSchema(smartWallets).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().uuid(),
  walletAddress: secureWalletAddressSchema,
  walletType: z.enum(['coinbase', 'safe']),
  chainId: z.number().int().positive().optional(),
  passkeyId: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Farcaster account schemas
export const insertFarcasterAccountSchema = createInsertSchema(farcasterAccounts).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().uuid(),
  farcasterFid: secureFidSchema,
  username: z.string().max(255).optional(),
  custodyAddress: secureWalletAddressSchema.optional(),
  imported: z.boolean().optional(),
});

// Auth V2 request schemas
export const authRegisterStartSchema = z.object({
  email: secureEmailSchema,
});

export const authRegisterVerifySchema = z.object({
  email: secureEmailSchema,
  code: z.string().length(6).regex(/^\d+$/, "Code must be numeric"),
});

export const authLoginStartSchema = z.object({
  email: secureEmailSchema,
});

// Auth V2 Types
export type AuthUser = typeof authUsers.$inferSelect;
export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
export type Passkey = typeof passkeys.$inferSelect;
export type InsertPasskey = z.infer<typeof insertPasskeySchema>;
export type SmartWallet = typeof smartWallets.$inferSelect;
export type InsertSmartWallet = z.infer<typeof insertSmartWalletSchema>;
export type FarcasterAccount = typeof farcasterAccounts.$inferSelect;
export type InsertFarcasterAccount = z.infer<typeof insertFarcasterAccountSchema>;

// Auth V2 Request Types
export type AuthRegisterStartRequest = z.infer<typeof authRegisterStartSchema>;
export type AuthRegisterVerifyRequest = z.infer<typeof authRegisterVerifySchema>;
export type AuthLoginStartRequest = z.infer<typeof authLoginStartSchema>;