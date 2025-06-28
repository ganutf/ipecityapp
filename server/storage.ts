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
  type Registration,
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
  type PassportClaim,
  type EmailVerificationRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Members
  getMember(farcasterFid: number): Promise<Member | undefined>;
  getMemberByUsername(username: string): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  getMemberByIpePassport(passport: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(farcasterFid: number, member: UpdateMember): Promise<Member>;
  getAllMembers(): Promise<Member[]>;
  getPendingMembers(): Promise<Member[]>;
  approveMember(farcasterFid: number): Promise<Member>;
  denyMember(farcasterFid: number): Promise<Member>;
  
  // Registration
  registerMember(registration: Registration): Promise<Member>;
  
  // Email Verification
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  getEmailVerification(farcasterFid: number, code: string): Promise<EmailVerification | undefined>;
  markEmailVerified(farcasterFid: number): Promise<void>;
  
  // Status Management
  updateMemberStatus(farcasterFid: number, status: string): Promise<Member>;
  
  // Passport Claims
  createPassportClaim(claim: PassportClaim): Promise<Member>;
  getPendingClaims(): Promise<Member[]>;
  approvePassportClaim(farcasterFid: number): Promise<Member>;
  denyPassportClaim(farcasterFid: number): Promise<Member>;
  
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

  async getPendingMembers(): Promise<Member[]> {
    return await db.select().from(members).where(eq(members.registrationStatus, 'pending'));
  }

  async approveMember(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        registrationStatus: 'approved', 
        approved: true,
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
        registrationStatus: 'denied', 
        approved: false,
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async registerMember(registration: Registration): Promise<Member> {
    const [member] = await db
      .insert(members)
      .values({
        ...registration,
        registrationStatus: 'pending',
        approved: false,
        emailVerified: false,
        registeredAt: new Date(),
      })
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

  // Status Management
  async updateMemberStatus(farcasterFid: number, status: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ status, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  // Passport Claims
  async createPassportClaim(claim: PassportClaim): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        passportClaimSubdomain: claim.passportClaimSubdomain,
        passportClaimWalletAddress: claim.passportClaimWalletAddress,
        passportClaimStatus: 'pending',
        status: 'pending_claim',
        updatedAt: new Date()
      })
      .where(eq(members.farcasterFid, claim.farcasterFid))
      .returning();
    return member;
  }

  async getPendingClaims(): Promise<Member[]> {
    return await db
      .select()
      .from(members)
      .where(eq(members.passportClaimStatus, 'pending'))
      .orderBy(asc(members.createdAt));
  }

  async approvePassportClaim(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        passportClaimStatus: 'approved',
        status: 'member',
        passportVerified: true,
        updatedAt: new Date()
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }

  async denyPassportClaim(farcasterFid: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        passportClaimStatus: 'denied',
        status: 'signer_approved',
        updatedAt: new Date()
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
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

  async updateUserSignerStatus(farcasterFid: number, status: string): Promise<UserSigner> {
    const [updatedSigner] = await db
      .update(userSigners)
      .set({ status })
      .where(eq(userSigners.farcasterFid, farcasterFid))
      .returning();
    
    if (!updatedSigner) {
      throw new Error(`UserSigner not found for FID ${farcasterFid}`);
    }
    
    return updatedSigner;
  }
}

export const storage = new DatabaseStorage();