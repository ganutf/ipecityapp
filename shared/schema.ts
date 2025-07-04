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
  name: varchar("name"),
  email: varchar("email").unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  xHandle: varchar("x_handle"),
  linkedin: varchar("linkedin"),
  miniBio: text("mini_bio"),
  profileTags: text("profile_tags").array(),
  ipePassport: varchar("ipe_passport").unique(), // User-chosen subdomain for <user-id>.ipecity.eth
  ipeUsername: varchar("ipe_username").unique(), // Claimed username for passport verification
  passportVerified: boolean("passport_verified").default(false).notNull(),
  
  // New status field to track registration flow
  status: varchar("status").default("pending_signer").notNull(), // pending_signer, signer_approved, email_verified, pending_passport, pending_claim, pending_acceptance, member
  
  // Passport claiming fields
  passportClaimSubdomain: varchar("passport_claim_subdomain"),
  passportClaimWalletAddress: varchar("passport_claim_wallet_address"),
  passportClaimStatus: varchar("passport_claim_status"), // pending, approved, denied
  
  profileCompleted: boolean("profile_completed").default(false).notNull(),
  registeredAt: timestamp("registered_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pulses table - admin-created engagement tasks
export const pulses = pgTable("pulses", {
  id: serial("id").primaryKey(),
  farcasterUrl: text("farcaster_url").notNull(),
  date: date("date").notNull(),
  description: text("description").notNull(),
  createdBy: varchar("created_by").notNull(), // admin farcaster username
  createdAt: timestamp("created_at").defaultNow(),
});

// Pulse executions - tracking member interactions
export const pulseExecutions = pgTable("pulse_executions", {
  id: serial("id").primaryKey(),
  pulseId: integer("pulse_id").notNull(),
  memberFarcasterFid: integer("member_farcaster_fid").notNull(),
  actionType: varchar("action_type").notNull(), // 'like' | 'recast'
  executedAt: timestamp("executed_at").defaultNow(),
});

// User signers - individual Farcaster signers per user
export const userSigners = pgTable("user_signers", {
  id: serial("id").primaryKey(),
  farcasterFid: integer("farcaster_fid").unique().notNull(),
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
}));

export const pulsesRelations = relations(pulses, ({ many }) => ({
  pulseExecutions: many(pulseExecutions),
}));

export const pulseExecutionsRelations = relations(pulseExecutions, ({ one }) => ({
  pulse: one(pulses, {
    fields: [pulseExecutions.pulseId],
    references: [pulses.id],
  }),
  member: one(members, {
    fields: [pulseExecutions.memberFarcasterFid],
    references: [members.farcasterFid],
  }),
}));

export const userSignersRelations = relations(userSigners, ({ one }) => ({
  member: one(members, {
    fields: [userSigners.farcasterFid],
    references: [members.farcasterFid],
  }),
}));

// Email verification table
export const emailVerifications = pgTable("email_verifications", {
  id: serial("id").primaryKey(),
  farcasterFid: integer("farcaster_fid").notNull(),
  email: varchar("email").notNull(),
  verificationCode: varchar("verification_code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Passport verification table
export const passportVerifications = pgTable("passport_verifications", {
  id: serial("id").primaryKey(),
  farcasterFid: integer("farcaster_fid").notNull(),
  ipePassport: varchar("ipe_passport").notNull(),
  verificationToken: varchar("verification_token").unique().notNull(),
  challengeMessage: text("challenge_message").notNull(),
  verified: boolean("verified").default(false).notNull(),
  verifiedAt: timestamp("verified_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  registeredAt: true,
});

export const updateMemberSchema = createInsertSchema(members).omit({
  id: true,
  farcasterFid: true,
  createdAt: true,
  updatedAt: true,
  registeredAt: true,
}).partial();

export const registrationSchema = createInsertSchema(members).pick({
  farcasterFid: true,
  name: true,
  email: true,
  xHandle: true,
  linkedin: true,
  miniBio: true,
  profileTags: true,
  ipePassport: true,
}).extend({
  email: z.string().email("Invalid email address"),
  ipePassport: z.string()
    .min(3, "Passport must be at least 3 characters")
    .max(20, "Passport must be at most 20 characters")
    .regex(/^[a-z0-9]+$/, "Passport can only contain lowercase letters and numbers"),
});

// New schema for passport claims
export const passportClaimSchema = createInsertSchema(members).pick({
  farcasterFid: true,
  passportClaimSubdomain: true,
  passportClaimWalletAddress: true,
}).extend({
  passportClaimSubdomain: z.string()
    .min(3, "Subdomain must be at least 3 characters")
    .max(20, "Subdomain must be at most 20 characters")
    .regex(/^[a-z0-9]+$/, "Subdomain can only contain lowercase letters and numbers"),
  passportClaimWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
});

// Email verification schema (separate from full registration)
export const emailVerificationRequestSchema = createInsertSchema(members).pick({
  farcasterFid: true,
  email: true,
}).extend({
  email: z.string().email("Invalid email address"),
});

export const insertEmailVerificationSchema = createInsertSchema(emailVerifications).omit({
  id: true,
  createdAt: true,
});

export const insertPassportVerificationSchema = createInsertSchema(passportVerifications).omit({
  id: true,
  createdAt: true,
  verifiedAt: true,
});

export const insertPulseSchema = createInsertSchema(pulses).omit({
  id: true,
  createdAt: true,
});

export const updatePulseSchema = createInsertSchema(pulses).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertPulseExecutionSchema = createInsertSchema(pulseExecutions).omit({
  id: true,
  executedAt: true,
});

export const insertUserSignerSchema = createInsertSchema(userSigners).omit({
  id: true,
  createdAt: true,
});

// Types
export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;
export type PassportVerification = typeof passportVerifications.$inferSelect;
export type InsertPassportVerification = z.infer<typeof insertPassportVerificationSchema>;
export type Pulse = typeof pulses.$inferSelect;
export type InsertPulse = z.infer<typeof insertPulseSchema>;
export type UpdatePulse = z.infer<typeof updatePulseSchema>;
export type PulseExecution = typeof pulseExecutions.$inferSelect;
export type InsertPulseExecution = z.infer<typeof insertPulseExecutionSchema>;
export type UserSigner = typeof userSigners.$inferSelect;
export type InsertUserSigner = z.infer<typeof insertUserSignerSchema>;

// New types for passport claiming
export type PassportClaim = z.infer<typeof passportClaimSchema>;
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;