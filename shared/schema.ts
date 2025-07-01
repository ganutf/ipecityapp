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

// Community members table with simplified state machine
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  farcasterFid: integer("farcaster_fid").notNull().unique(),
  farcasterUsername: varchar("farcaster_username"),
  farcasterDisplayName: varchar("farcaster_display_name"),
  farcasterPfpUrl: varchar("farcaster_pfp_url"),
  farcasterBio: text("farcaster_bio"),
  
  // Contact information
  email: varchar("email"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  
  // Social profiles
  xHandle: varchar("x_handle"),
  linkedin: varchar("linkedin"),
  miniBio: text("mini_bio"),
  profileTags: text("profile_tags").array(),
  
  // Passport information
  ipePassport: varchar("ipe_passport"), // ENS subdomain like user.ipecity.eth
  passportVerified: boolean("passport_verified").default(false).notNull(),
  connectedWalletAddress: varchar("connected_wallet_address"),
  
  // Simplified state machine
  membershipState: varchar("membership_state").default("NEW_MEMBER").notNull(), // NEW_MEMBER, WAITING_MEMBERSHIP_VERIFICATION, MEMBERSHIP_ACTIVE
  
  // Timestamps
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

// Define membership states enum
export const MembershipState = {
  NEW_MEMBER: "NEW_MEMBER",
  WAITING_MEMBERSHIP_VERIFICATION: "WAITING_MEMBERSHIP_VERIFICATION", 
  MEMBERSHIP_ACTIVE: "MEMBERSHIP_ACTIVE"
} as const;

export type MembershipStateType = typeof MembershipState[keyof typeof MembershipState];

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
  farcasterUsername: true,
  farcasterDisplayName: true,
  farcasterPfpUrl: true,
  farcasterBio: true,
}).extend({
  email: z.string().email("Invalid email address").optional(),
});

// Email verification schema
export const emailVerificationRequestSchema = z.object({
  farcasterFid: z.number(),
  email: z.string().email("Invalid email address"),
});

// Passport verification schema
export const passportVerificationSchema = z.object({
  farcasterFid: z.number(),
  ipePassport: z.string().min(1, "Passport is required"),
  connectedWalletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
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

// New types 
export type EmailVerificationRequest = z.infer<typeof emailVerificationRequestSchema>;
export type PassportVerificationRequest = z.infer<typeof passportVerificationSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;