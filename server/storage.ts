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
  type ApplicationByMemberId,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // Members - Primary methods using memberId
  getMember(memberId: number): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  getMemberByIpePassport(passport: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(memberId: number, member: UpdateMember): Promise<Member>;
  deleteMember(memberId: number): Promise<void>;
  getAllMembers(): Promise<Member[]>;
  
  // Compatibility methods for farcasterFid lookup
  getMemberByFarcasterFid(farcasterFid: number): Promise<Member | undefined>;
  getMemberIdFromFarcasterFid(farcasterFid: number): Promise<number | undefined>;
  getFarcasterFidFromMemberId(memberId: number): Promise<number | undefined>;
  
  // Application Flow
  submitApplication(application: Application): Promise<Member>;
  submitApplicationByMemberId(memberId: number, application: Omit<Application, 'farcasterFid'>): Promise<Member>;
  getPendingApplications(): Promise<Member[]>;
  getPendingMembers(): Promise<Member[]>;
  approveApplication(memberId: number, memberType: string): Promise<Member>;
  approveMember(memberId: number): Promise<Member>;
  acceptSubdomain(memberId: number): Promise<Member>;
  denyApplication(memberId: number): Promise<Member>;
  denyMember(memberId: number): Promise<Member>;
  
  // Legacy methods for backward compatibility
  updateMemberByFarcasterFid(farcasterFid: number, member: UpdateMember): Promise<Member>;
  approveApplicationByFarcasterFid(farcasterFid: number, memberType: string): Promise<Member>;
  approveMemberByFarcasterFid(farcasterFid: number): Promise<Member>;
  denyApplicationByFarcasterFid(farcasterFid: number): Promise<Member>;
  denyMemberByFarcasterFid(farcasterFid: number): Promise<Member>;
  
  // Email Verification
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  getEmailVerification(memberId: number, code: string): Promise<EmailVerification | undefined>;
  markEmailVerified(memberId: number): Promise<void>;
  
  // Legacy email verification methods
  getEmailVerificationByFarcasterFid(farcasterFid: number, code: string): Promise<EmailVerification | undefined>;
  markEmailVerifiedByFarcasterFid(farcasterFid: number): Promise<void>;
  
  // Status Management
  updateMemberStatus(memberId: number, status: string): Promise<Member>;
  updateMemberStatusByFarcasterFid(farcasterFid: number, status: string): Promise<Member>;
  
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
  getPulseExecution(pulseId: number, memberId: number, actionType: string): Promise<PulseExecution | undefined>;
  getMemberExecutions(memberId: number): Promise<PulseExecution[]>;
  createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution>;
  
  // Legacy pulse execution methods
  getPulseExecutionByFarcasterFid(pulseId: number, memberFarcasterFid: number, actionType: string): Promise<PulseExecution | undefined>;
  getMemberExecutionsByFarcasterFid(memberFarcasterFid: number): Promise<PulseExecution[]>;
  
  // User Signers
  getUserSigner(memberId: number): Promise<UserSigner | undefined>;
  createUserSigner(signer: InsertUserSigner): Promise<UserSigner>;
  updateUserSignerStatus(memberId: number, status: string): Promise<UserSigner>;
  deleteUserSigner(memberId: number): Promise<void>;
  
  // Legacy signer methods
  getUserSignerByFarcasterFid(farcasterFid: number): Promise<UserSigner | undefined>;
  updateUserSignerStatusByFarcasterFid(farcasterFid: number, status: string): Promise<UserSigner>;
  deleteUserSignerByFarcasterFid(farcasterFid: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Members - Primary methods using memberId
  async getMember(memberId: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    return member;
  }
  
  // Compatibility methods for farcasterFid lookup
  async getMemberByFarcasterFid(farcasterFid: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.farcasterFid, farcasterFid));
    return member;
  }
  
  async getMemberIdFromFarcasterFid(farcasterFid: number): Promise<number | undefined> {
    const member = await this.getMemberByFarcasterFid(farcasterFid);
    return member?.id;
  }
  
  async getFarcasterFidFromMemberId(memberId: number): Promise<number | undefined> {
    const member = await this.getMember(memberId);
    return member?.farcasterFid;
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

  async updateMember(memberId: number, memberData: UpdateMember): Promise<Member> {
    const [updatedMember] = await db
      .update(members)
      .set({ ...memberData, updatedAt: new Date() })
      .where(eq(members.id, memberId))
      .returning();
    return updatedMember;
  }

  async deleteMember(memberId: number): Promise<void> {
    // Delete all related data first (cascading deletion)
    // This ensures referential integrity and prevents orphaned records
    
    // Delete pulse executions
    await db.delete(pulseExecutions).where(eq(pulseExecutions.memberId, memberId));
    
    // Delete user signer
    await db.delete(userSigners).where(eq(userSigners.memberId, memberId));
    
    // Delete email verifications
    await db.delete(emailVerifications).where(eq(emailVerifications.memberId, memberId));
    
    // Delete passport verifications
    await db.delete(passportVerifications).where(eq(passportVerifications.memberId, memberId));
    
    // Finally delete the member
    await db.delete(members).where(eq(members.id, memberId));
  }

  async getAllMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(desc(members.createdAt));
  }

  // Application Flow
  async submitApplication(applicationData: Application): Promise<Member> {
    const { farcasterFid, ...memberData } = applicationData;
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.submitApplicationByMemberId(memberId, memberData);
  }
  
  async submitApplicationByMemberId(memberId: number, memberData: Omit<Application, 'farcasterFid'>): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        ...memberData, 
        status: 'pending_application_review',
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }

  async getPendingApplications(): Promise<Member[]> {
    return await db
      .select()
      .from(members)
      .where(eq(members.status, 'pending_application_review'))
      .orderBy(desc(members.createdAt));
  }

  async getPendingMembers(): Promise<Member[]> {
    return await db
      .select()
      .from(members)
      .where(eq(members.status, 'waiting_review'))
      .orderBy(desc(members.createdAt));
  }

  async approveApplication(memberId: number, memberType: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: 'approved_application', 
        memberType: memberType as any,
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  
  async approveApplicationByFarcasterFid(farcasterFid: number, memberType: string): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.approveApplication(memberId, memberType);
  }

  async approveMember(memberId: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: 'active_member',
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  
  async approveMemberByFarcasterFid(farcasterFid: number): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.approveMember(memberId);
  }

  async acceptSubdomain(memberId: number): Promise<Member> {
    // First get the current member data to access ipeUsername
    const existingMember = await this.getMember(memberId);
    if (!existingMember) {
      throw new Error(`Member not found with ID: ${memberId}`);
    }

    const [member] = await db
      .update(members)
      .set({ 
        status: 'active_member',
        ipePassport: existingMember.ipeUsername ? `${existingMember.ipeUsername}.ipecity.eth` : undefined,
        passportVerified: true,
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  

  async denyApplication(memberId: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: 'denied_application',
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  
  async denyApplicationByFarcasterFid(farcasterFid: number): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.denyApplication(memberId);
  }

  async denyMember(memberId: number): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: 'denied_member',
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  
  async denyMemberByFarcasterFid(farcasterFid: number): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.denyMember(memberId);
  }

  // Email Verification
  async createEmailVerification(verificationData: InsertEmailVerification): Promise<EmailVerification> {
    const [verification] = await db.insert(emailVerifications).values(verificationData).returning();
    return verification;
  }

  async getEmailVerification(memberId: number, code: string): Promise<EmailVerification | undefined> {
    const [verification] = await db
      .select()
      .from(emailVerifications)
      .where(and(
        eq(emailVerifications.memberId, memberId),
        eq(emailVerifications.verificationCode, code),
        eq(emailVerifications.verified, false)
      ));
    return verification;
  }
  
  async getEmailVerificationByFarcasterFid(farcasterFid: number, code: string): Promise<EmailVerification | undefined> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      return undefined;
    }
    return this.getEmailVerification(memberId, code);
  }

  async markEmailVerified(memberId: number): Promise<void> {
    await db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.memberId, memberId));

    await db
      .update(members)
      .set({ 
        emailVerified: true,
        updatedAt: new Date()
      })
      .where(eq(members.id, memberId));
  }
  
  async markEmailVerifiedByFarcasterFid(farcasterFid: number): Promise<void> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.markEmailVerified(memberId);
  }

  // Status Management
  async updateMemberStatus(memberId: number, status: string): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({ 
        status: status as any,
        updatedAt: new Date() 
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
  }
  
  async updateMemberByFarcasterFid(farcasterFid: number, memberData: UpdateMember): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.updateMember(memberId, memberData);
  }
  
  async updateMemberStatusByFarcasterFid(farcasterFid: number, status: string): Promise<Member> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.updateMemberStatus(memberId, status);
  }

  // Passport Verification
  async createPassportVerification(verificationData: InsertPassportVerification): Promise<PassportVerification> {
    const [verification] = await db.insert(passportVerifications).values(verificationData).returning();
    return verification;
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
    
    if (verification) {
      // Also update the member record
      await db
        .update(members)
        .set({ 
          passportVerified: true,
          updatedAt: new Date()
        })
        .where(eq(members.id, verification.memberId));
    }
    
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

  async createPulse(pulseData: InsertPulse): Promise<Pulse> {
    const [pulse] = await db.insert(pulses).values(pulseData).returning();
    return pulse;
  }

  async updatePulse(id: number, pulseData: UpdatePulse): Promise<Pulse> {
    const [pulse] = await db
      .update(pulses)
      .set(pulseData)
      .where(eq(pulses.id, id))
      .returning();
    return pulse;
  }

  // Pulse Executions
  async getPulseExecution(pulseId: number, memberId: number, actionType: string): Promise<PulseExecution | undefined> {
    const [execution] = await db
      .select()
      .from(pulseExecutions)
      .where(and(
        eq(pulseExecutions.pulseId, pulseId),
        eq(pulseExecutions.memberId, memberId),
        eq(pulseExecutions.actionType, actionType)
      ));
    return execution;
  }
  
  async getPulseExecutionByFarcasterFid(pulseId: number, memberFarcasterFid: number, actionType: string): Promise<PulseExecution | undefined> {
    const memberId = await this.getMemberIdFromFarcasterFid(memberFarcasterFid);
    if (!memberId) {
      return undefined;
    }
    return this.getPulseExecution(pulseId, memberId, actionType);
  }

  async getMemberExecutions(memberId: number): Promise<PulseExecution[]> {
    return await db
      .select()
      .from(pulseExecutions)
      .where(eq(pulseExecutions.memberId, memberId))
      .orderBy(desc(pulseExecutions.executedAt));
  }
  
  async getMemberExecutionsByFarcasterFid(memberFarcasterFid: number): Promise<PulseExecution[]> {
    const memberId = await this.getMemberIdFromFarcasterFid(memberFarcasterFid);
    if (!memberId) {
      return [];
    }
    return this.getMemberExecutions(memberId);
  }

  async createPulseExecution(executionData: InsertPulseExecution): Promise<PulseExecution> {
    const [execution] = await db.insert(pulseExecutions).values(executionData).returning();
    return execution;
  }

  // User Signers
  async getUserSigner(memberId: number): Promise<UserSigner | undefined> {
    const [signer] = await db
      .select()
      .from(userSigners)
      .where(eq(userSigners.memberId, memberId));
    return signer;
  }
  
  async getUserSignerByFarcasterFid(farcasterFid: number): Promise<UserSigner | undefined> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      return undefined;
    }
    return this.getUserSigner(memberId);
  }

  async createUserSigner(signerData: InsertUserSigner): Promise<UserSigner> {
    const [signer] = await db.insert(userSigners).values(signerData).returning();
    return signer;
  }

  async updateUserSignerStatus(memberId: number, status: string): Promise<UserSigner> {
    const [updatedSigner] = await db
      .update(userSigners)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(userSigners.memberId, memberId))
      .returning();
    return updatedSigner;
  }
  
  async updateUserSignerStatusByFarcasterFid(farcasterFid: number, status: string): Promise<UserSigner> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.updateUserSignerStatus(memberId, status);
  }

  async deleteUserSigner(memberId: number): Promise<void> {
    await db.delete(userSigners).where(eq(userSigners.memberId, memberId));
  }
  
  async deleteUserSignerByFarcasterFid(farcasterFid: number): Promise<void> {
    const memberId = await this.getMemberIdFromFarcasterFid(farcasterFid);
    if (!memberId) {
      throw new Error(`Member not found for farcasterFid: ${farcasterFid}`);
    }
    return this.deleteUserSigner(memberId);
  }
}

export const storage = new DatabaseStorage();