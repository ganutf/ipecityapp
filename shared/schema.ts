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
  farcasterUsername: varchar("farcaster_username"),
  name: varchar("name").notNull(),
  ipePassport: varchar("ipe_passport"), // ENS subdomain ipecity.eth
  approved: boolean("approved").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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

// Insert schemas
export const insertMemberSchema = createInsertSchema(members).omit({
  id: true,
  createdAt: true,
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

// Types
export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Pulse = typeof pulses.$inferSelect;
export type InsertPulse = z.infer<typeof insertPulseSchema>;
export type UpdatePulse = z.infer<typeof updatePulseSchema>;
export type PulseExecution = typeof pulseExecutions.$inferSelect;
export type InsertPulseExecution = z.infer<typeof insertPulseExecutionSchema>;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;