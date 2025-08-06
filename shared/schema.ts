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
  farcasterFid: integer("farcaster_fid").notNull().unique(),
  walletAddress: varchar("wallet_address", { length: 255 }),
  
  // State machine fields - restricted by database CHECK constraint
  // Valid values: pending_signer, pending_id_verification, email_verified, pending_application, 
  // pending_application_review, approved_application, denied_application, active_member
  status: varchar("status", { length: 30 }).default("pending_signer").notNull(),
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
  updatedAt: timestamp("updated_at"),
});

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
]);

// Attestations - EAS attestations for pulse completions
export const attestations = pgTable("attestations", {
  id: serial("id").primaryKey(),
  pulseExecutionId: integer("pulse_execution_id").references(() => pulseExecutions.id).notNull().unique(), // Prevent duplicates
  attestationUid: varchar("attestation_uid", { length: 255 }), // Nullable for pending status
  transactionHash: varchar("transaction_hash", { length: 255 }), // Nullable for pending status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'completed' | 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

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
  updatedAt: timestamp("updated_at"),
});

// Relations
export const membersRelations = relations(members, ({ many }) => ({
  pulseExecutions: many(pulseExecutions),
  createdPulses: many(pulses, { relationName: "PulseCreator" }),
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

// Member type validation
export const memberTypeEnum = z.enum(['pending', 'architect', 'explorer', 'admin', 'org_team', 'core_team']);
export type MemberType = z.infer<typeof memberTypeEnum>;

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

// Enhanced validation schemas with security measures
export const secureUsernameSchema = z.string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-z0-9]+$/, "Username can only contain lowercase letters and numbers")
  .refine(val => !['admin', 'root', 'system', 'api', 'www'].includes(val), "Reserved username")
  .refine(val => !/(.)\1{3,}/.test(val), "Username cannot have repeated characters");

export const secureEmailSchema = z.string()
  .email("Invalid email address")
  .max(254, "Email address too long")
  .refine(val => !/<|>|"|'/.test(val), "Email contains invalid characters")
  .refine(val => val.split('@')[0].length <= 64, "Email local part too long");

export const secureBioSchema = z.string()
  .max(1000, "Bio too long")
  .refine(val => {
    const dangerousPatterns = [
      /<script/i, /javascript:/i, /data:/i, /vbscript:/i,
      /on\w+\s*=/i, /<iframe/i, /<object/i, /<embed/i
    ];
    return !dangerousPatterns.some(pattern => pattern.test(val));
  }, "Bio contains potentially dangerous content")
  .refine(val => !/(https?:\/\/[^\s]+)/gi.test(val), "URLs not allowed in bio")
  .optional();

export const secureSocialHandleSchema = z.string()
  .max(200, "Social media URL too long")
  .refine(val => {
    if (!val.trim()) return true; // Empty is valid
    
    // Allow both handles and URLs
    const handleRegex = /^[@]?[a-zA-Z0-9_.-]*$/;
    
    // More permissive URL regex that allows various path structures
    const urlRegex = /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com|linkedin\.com|instagram\.com)\/[\w\-\.\/]+\/?$/i;
    
    // Test simple handle first
    if (handleRegex.test(val)) return true;
    
    // Test URL patterns
    if (urlRegex.test(val)) return true;
    
    return false;
  }, "Invalid social media handle or URL format")
  .optional();

export const secureWalletAddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address")
  .length(42, "Wallet address must be 42 characters");

export const secureProfileTagsSchema = z.array(
  z.string()
    .min(2, "Tag too short")
    .max(30, "Tag too long")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Tag contains invalid characters")
    .refine(val => val.trim().length >= 2, "Tag cannot be empty after trimming")
).max(10, "Too many tags").optional();

export const secureFidSchema = z.number()
  .int("FID must be an integer")
  .positive("FID must be positive")
  .max(999999999, "FID too large");

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
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Datetime must be in YYYY-MM-DDTHH:MM format")
  .transform(val => {
    // Parse as UTC to avoid timezone inconsistencies between environments
    const utcDate = new Date(val + 'Z'); // Append 'Z' to treat as UTC
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

// Request types
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationByMemberIdRequest = z.infer<typeof emailVerificationRequestByMemberIdSchema>;
export type ApplicationByMemberId = z.infer<typeof applicationByMemberIdSchema>;
export type VerificationCodeByMemberId = z.infer<typeof verificationCodeByMemberIdSchema>;
export type UsernameClaimByMemberId = z.infer<typeof usernameClaimByMemberIdSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;