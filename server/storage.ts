import { 
  members, 
  pulses, 
  pulseExecutions,
  userSigners,
  type Member,
  type InsertMember,
  type Pulse,
  type InsertPulse,
  type UpdatePulse,
  type PulseExecution,
  type InsertPulseExecution,
  type UserSigner,
  type InsertUserSigner,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Members
  getMember(farcasterFid: number): Promise<Member | undefined>;
  getMemberByUsername(username: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  createMembersBatch(members: InsertMember[]): Promise<Member[]>;
  getAllMembers(): Promise<Member[]>;
  
  // Pulses
  getPulse(id: number): Promise<Pulse | undefined>;
  getPulseByDate(date: string): Promise<Pulse | undefined>;
  getAllPulses(): Promise<Pulse[]>;
  createPulse(pulse: InsertPulse): Promise<Pulse>;
  updatePulse(id: number, pulse: UpdatePulse): Promise<Pulse>;
  
  // Pulse Executions
  getPulseExecution(pulseId: number, memberFarcasterFid: number, actionType: string): Promise<PulseExecution | undefined>;
  getMemberExecutions(memberFarcasterFid: number): Promise<PulseExecution[]>;
  createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution>;
  
  // User Signers
  getUserSigner(farcasterFid: number): Promise<UserSigner | undefined>;
  createUserSigner(signer: InsertUserSigner): Promise<UserSigner>;
}

export class DatabaseStorage implements IStorage {
  // Members
  async getMember(farcasterFid: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.farcasterFid, farcasterFid));
    return member;
  }

  async getMemberByUsername(username: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.farcasterUsername, username));
    return member;
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [newMember] = await db.insert(members).values(member).returning();
    return newMember;
  }

  async createMembersBatch(membersList: InsertMember[]): Promise<Member[]> {
    if (!membersList || membersList.length === 0) {
      throw new Error('Cannot create members batch: empty or invalid member list');
    }
    
    const newMembers = await db.insert(members).values(membersList).returning();
    return newMembers;
  }

  async getAllMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(asc(members.name));
  }

  // Pulses
  async getPulse(id: number): Promise<Pulse | undefined> {
    const [pulse] = await db.select().from(pulses).where(eq(pulses.id, id));
    return pulse;
  }

  async getPulseByDate(date: string): Promise<Pulse | undefined> {
    const [pulse] = await db.select().from(pulses).where(eq(pulses.date, date));
    return pulse;
  }

  async getAllPulses(): Promise<Pulse[]> {
    return await db.select().from(pulses).orderBy(desc(pulses.date));
  }

  async createPulse(pulse: InsertPulse): Promise<Pulse> {
    const [newPulse] = await db.insert(pulses).values(pulse).returning();
    return newPulse;
  }

  // Pulse Executions
  async getPulseExecution(pulseId: number, memberFarcasterFid: number, actionType: string): Promise<PulseExecution | undefined> {
    const [execution] = await db.select().from(pulseExecutions)
      .where(and(
        eq(pulseExecutions.pulseId, pulseId),
        eq(pulseExecutions.memberFarcasterFid, memberFarcasterFid),
        eq(pulseExecutions.actionType, actionType)
      ));
    return execution;
  }

  async getMemberExecutions(memberFarcasterFid: number): Promise<PulseExecution[]> {
    return await db.select().from(pulseExecutions)
      .where(eq(pulseExecutions.memberFarcasterFid, memberFarcasterFid))
      .orderBy(desc(pulseExecutions.executedAt));
  }

  async createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution> {
    const [newExecution] = await db.insert(pulseExecutions).values(execution).returning();
    return newExecution;
  }

  async updatePulse(id: number, pulseData: UpdatePulse): Promise<Pulse> {
    const [updatedPulse] = await db
      .update(pulses)
      .set(pulseData)
      .where(eq(pulses.id, id))
      .returning();
    return updatedPulse;
  }

  async getUserSigner(farcasterFid: number): Promise<UserSigner | undefined> {
    const [signer] = await db
      .select()
      .from(userSigners)
      .where(eq(userSigners.farcasterFid, farcasterFid));
    return signer;
  }

  async createUserSigner(signer: InsertUserSigner): Promise<UserSigner> {
    const [newSigner] = await db.insert(userSigners).values(signer).returning();
    return newSigner;
  }
}

export const storage = new DatabaseStorage();