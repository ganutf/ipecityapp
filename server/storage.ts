import { 
  members, 
  pulses, 
  pulseExecutions,
  userSigners,
  emailVerifications,
  passportVerifications,
  type Member,
  type InsertMember,
  type UpdateMember,
  type Application,
  type EmailVerification,
  type InsertEmailVerification,
  type PassportVerification,
  type InsertPassportVerification,
  type Pulse,
  type InsertPulse,
  type UpdatePulse,
  type PulseExecution,
  type InsertPulseExecution,
  type UserSigner,
  type InsertUserSigner,
  type EmailVerificationRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Members
  getMember(farcasterFid: number): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  getMemberByIpePassport(passport: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(farcasterFid: number, member: UpdateMember): Promise<Member>;
  deleteMember(farcasterFid: number): Promise<void>;
  getAllMembers(): Promise<Member[]>;
  
  // Application Flow
  submitApplication(application: Application): Promise<Member>;
  getPendingApplications(): Promise<Member[]>;
  getPendingMembers(): Promise<Member[]>;
  approveApplication(farcasterFid: number, memberType: string): Promise<Member>;
  approveMember(farcasterFid: number): Promise<Member>;
  acceptSubdomain(farcasterFid: number): Promise<Member>;
  denyApplication(farcasterFid: number): Promise<Member>;
  denyMember(farcasterFid: number): Promise<Member>;
  
  // Email Verification
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  getEmailVerification(farcasterFid: number, code: string): Promise<EmailVerification | undefined>;
  markEmailVerified(farcasterFid: number): Promise<void>;
  
  // Status Management
  updateMemberStatus(farcasterFid: number, status: string): Promise<Member>;
  
  // Passport Verification
  createPassportVerification(verification: InsertPassportVerification): Promise<PassportVerification>;
  getPassportVerification(token: string): Promise<PassportVerification | undefined>;
  markPassportVerified(token: string): Promise<PassportVerification | undefined>;
  
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
  updateUserSignerStatus(farcasterFid: number, status: string): Promise<UserSigner>;
  deleteUserSigner(farcasterFid: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Members
  async getMember(farcasterFid: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.farcasterFid, farcasterFid));
    return member;
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [newMember] = await db.insert(members).values(member).returning();
    return newMember;
  }

  async getMemberByEmail(email: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.email, email));
    return member;
  }

  async getMemberByIpePassport(passport: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.ipePassport, passport));
    return member;
  }

  async updateMember(farcasterFid: number, memberData: UpdateMember): Promise<Member> {
    const [updatedMember] = await db
      .update(members)
      .set({ ...memberData, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return updatedMember;
  }

  async deleteMember(farcasterFid: number): Promise<void> {
    // Delete all related data first (cascading deletion)
    // This ensures referential integrity and prevents orphaned records
    
    // Delete pulse executions
    await db.delete(pulseExecutions).where(eq(pulseExecutions.memberFarcasterFid, farcasterFid));
    
    // Delete email verifications
    await db.delete(emailVerifications).where(eq(emailVerifications.farcasterFid, farcasterFid));
    
    // Delete passport verifications
    await db.delete(passportVerifications).where(eq(passportVerifications.farcasterFid, farcasterFid));
    
    // Delete user signers
    await db.delete(userSigners).where(eq(userSigners.farcasterFid, farcasterFid));
    
    // Finally, delete the member record
    await db.delete(members).where(eq(members.farcasterFid, farcasterFid));
  }

  async getAllMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(desc(members.createdAt));
  }

  // Application Flow
  async submitApplication(application: Application): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        ...application,
        status: "pending_application",
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, application.farcasterFid))
      .returning();
    return member;
  }

  async getPendingApplications(): Promise<Member[]> {
    return await db.select().from(members).where(eq(members.status, 'pending_application'));
  }

  async getPendingMembers(): Promise<Member[]> {
    return await db.select().from(members).where(eq(members.status, 'pending_application'));
  }

  async approveApplication(farcasterFid: number, memberType: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: "approved_application",
        memberType: memberType,
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async acceptSubdomain(farcasterFid: number): Promise<Member> {
    // First get the current member data to access ipeUsername
    const existingMember = await this.getMember(farcasterFid);
    if (!existingMember) {
      throw new Error("Member not found");
    }

    // Build the passport name from the username
    const ipePassport = existingMember.ipeUsername 
      ? `${existingMember.ipeUsername}.ipecity.eth` 
      : null;

    const [member] = await db
      .update(members)
      .set({ 
        status: "active_member",
        passportVerified: true,
        ipePassport: ipePassport,
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async denyApplication(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: "denied_application",
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async denyMember(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: "denied_application",
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  // Email Verification
  async createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification> {
    const [emailVerification] = await db
      .insert(emailVerifications)
      .values(verification)
      .returning();
    return emailVerification;
  }

  async getEmailVerification(farcasterFid: number, code: string): Promise<EmailVerification | undefined> {
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.farcasterFid, farcasterFid),
          eq(emailVerifications.verificationCode, code),
          eq(emailVerifications.verified, false)
        )
      );
    return verification;
  }

  async markEmailVerified(farcasterFid: number): Promise<void> {
    await db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.farcasterFid, farcasterFid));
      
    await db
      .update(members)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid));
  }

  // Status Management
  async updateMemberStatus(farcasterFid: number, status: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ status, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async approveMember(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: "approved_application",
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  // Passport Verification
  async createPassportVerification(verification: InsertPassportVerification): Promise<PassportVerification> {
    const [passportVerification] = await db
      .insert(passportVerifications)
      .values(verification)
      .returning();
    return passportVerification;
  }

  async getPassportVerification(token: string): Promise<PassportVerification | undefined> {
    const [verification] = await db
      .select()
      .from(passportVerifications)
      .where(eq(passportVerifications.verificationToken, token));
    return verification;
  }

  async markPassportVerified(token: string): Promise<PassportVerification | undefined> {
    const [verification] = await db
      .update(passportVerifications)
      .set({ 
        verified: true, 
        verifiedAt: new Date() 
      })
      .where(eq(passportVerifications.verificationToken, token))
      .returning();
    return verification;
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

  async updatePulse(id: number, pulseData: UpdatePulse): Promise<Pulse> {
    const [updatedPulse] = await db
      .update(pulses)
      .set(pulseData)
      .where(eq(pulses.id, id))
      .returning();
    return updatedPulse;
  }

  // Pulse Executions
  async getPulseExecution(pulseId: number, memberFarcasterFid: number, actionType: string): Promise<PulseExecution | undefined> {
    const [execution] = await db
      .select()
      .from(pulseExecutions)
      .where(
        and(
          eq(pulseExecutions.pulseId, pulseId),
          eq(pulseExecutions.memberFarcasterFid, memberFarcasterFid),
          eq(pulseExecutions.actionType, actionType)
        )
      );
    return execution;
  }

  async getMemberExecutions(memberFarcasterFid: number): Promise<PulseExecution[]> {
    return await db
      .select()
      .from(pulseExecutions)
      .where(eq(pulseExecutions.memberFarcasterFid, memberFarcasterFid))
      .orderBy(desc(pulseExecutions.executedAt));
  }

  async createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution> {
    const [newExecution] = await db
      .insert(pulseExecutions)
      .values(execution)
      .returning();
    return newExecution;
  }

  // User Signers
  async getUserSigner(farcasterFid: number): Promise<UserSigner | undefined> {
    const [signer] = await db
      .select()
      .from(userSigners)
      .where(eq(userSigners.farcasterFid, farcasterFid));
    return signer;
  }

  async createUserSigner(signer: InsertUserSigner): Promise<UserSigner> {
    const [newSigner] = await db
      .insert(userSigners)
      .values(signer)
      .returning();
    return newSigner;
  }

  async updateUserSignerStatus(farcasterFid: number, status: string): Promise<UserSigner> {
    const [signer] = await db
      .update(userSigners)
      .set({ status, updatedAt: new Date() })
      .where(eq(userSigners.farcasterFid, farcasterFid))
      .returning();
    return signer;
  }

  async deleteUserSigner(farcasterFid: number): Promise<void> {
    await db
      .delete(userSigners)
      .where(eq(userSigners.farcasterFid, farcasterFid));
  }
}

export const storage = new DatabaseStorage();