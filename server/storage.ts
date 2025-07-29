import { 
  members, 
  pulses, 
  pulseTypes,
  pulseExecutions,
  attestations,
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
  type PulseType,
  type InsertPulseType,
  type Pulse,
  type InsertPulse,
  type UpdatePulse,
  type PulseExecution,
  type InsertPulseExecution,
  type PulseExecutionActions,
  type Attestation,
  type InsertAttestation,
  type UserSigner,
  type InsertUserSigner,
  type EmailVerificationRequest,
  type ApplicationByMemberId,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, isNull, isNotNull, inArray, sql } from "drizzle-orm";

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
  
  // Pulse Types
  getPulseType(id: number): Promise<PulseType | undefined>;
  getAllPulseTypes(): Promise<PulseType[]>;
  createPulseType(pulseType: InsertPulseType): Promise<PulseType>;
  
  // Pulses
  getPulse(id: number): Promise<Pulse | undefined>;
  getPulseByDatetimeStart(datetimeStart: Date): Promise<Pulse | undefined>;
  getPulsesByDateRange(startDate: Date, endDate: Date): Promise<Pulse[]>;
  getActivePulses(): Promise<Pulse[]>; // Pulses currently active based on datetime + interval
  getAllPulses(): Promise<Pulse[]>;
  createPulse(pulse: InsertPulse): Promise<Pulse>;
  updatePulse(id: number, pulse: UpdatePulse): Promise<Pulse>;
  
  // Pulse Executions
  getPulseExecution(pulseId: number, memberId: number): Promise<PulseExecution | undefined>;
  getMemberExecutions(memberId: number): Promise<PulseExecution[]>;
  createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution>;
  updatePulseExecution(id: number, actions: PulseExecutionActions): Promise<PulseExecution>;
  deletePulseExecution(id: number): Promise<void>;
  
  // Legacy pulse execution methods
  getPulseExecutionByFarcasterFid(pulseId: number, memberFarcasterFid: number): Promise<PulseExecution | undefined>;
  getMemberExecutionsByFarcasterFid(memberFarcasterFid: number): Promise<PulseExecution[]>;
  
  // Attestations
  createAttestation(attestation: InsertAttestation): Promise<Attestation>;
  getAttestation(pulseExecutionId: number): Promise<Attestation | undefined>;
  getPendingAttestations(): Promise<{ execution: PulseExecution; member: Member; pulse: Pulse }[]>;
  updateAttestationStatus(id: number, status: string, attestationUid?: string, transactionHash?: string): Promise<Attestation>;
  verifyPulseExecutionOwnership(executionId: number, memberId: number): Promise<boolean>;
  
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

  // Pulse Types
  async getPulseType(id: number): Promise<PulseType | undefined> {
    const [pulseType] = await db.select().from(pulseTypes).where(eq(pulseTypes.id, id));
    return pulseType;
  }

  async getAllPulseTypes(): Promise<PulseType[]> {
    return await db.select().from(pulseTypes).orderBy(asc(pulseTypes.name));
  }

  async createPulseType(pulseTypeData: InsertPulseType): Promise<PulseType> {
    const [pulseType] = await db.insert(pulseTypes).values(pulseTypeData).returning();
    return pulseType;
  }

  // Pulses
  async getPulse(id: number): Promise<Pulse | undefined> {
    const [pulse] = await db.select().from(pulses).where(eq(pulses.id, id));
    return pulse;
  }

  async getPulseByDatetimeStart(datetimeStart: Date): Promise<Pulse | undefined> {
    const [pulse] = await db.select().from(pulses).where(eq(pulses.datetimeStart, datetimeStart));
    return pulse;
  }

  async getPulsesByDateRange(startDate: Date, endDate: Date): Promise<Pulse[]> {
    return await db
      .select()
      .from(pulses)
      .where(and(
        sql`${pulses.datetimeStart} >= ${startDate}`,
        sql`${pulses.datetimeStart} <= ${endDate}`
      ))
      .orderBy(desc(pulses.datetimeStart));
  }

  async getActivePulses(): Promise<Pulse[]> {
    const now = new Date();
    return await db
      .select()
      .from(pulses)
      .where(
        and(
          sql`${pulses.datetimeStart} <= ${now}`,
          sql`${pulses.datetimeStart} + INTERVAL '1 hour' * ${pulses.interval} >= ${now}`
        )
      )
      .orderBy(desc(pulses.datetimeStart));
  }

  async getAllPulses(): Promise<Pulse[]> {
    return await db.select().from(pulses).orderBy(desc(pulses.datetimeStart));
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
  async getPulseExecution(pulseId: number, memberId: number): Promise<PulseExecution | undefined> {
    const [execution] = await db
      .select()
      .from(pulseExecutions)
      .where(and(
        eq(pulseExecutions.pulseId, pulseId),
        eq(pulseExecutions.memberId, memberId)
      ));
    return execution;
  }
  
  async getPulseExecutionByFarcasterFid(pulseId: number, memberFarcasterFid: number): Promise<PulseExecution | undefined> {
    const memberId = await this.getMemberIdFromFarcasterFid(memberFarcasterFid);
    if (!memberId) {
      return undefined;
    }
    return this.getPulseExecution(pulseId, memberId);
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

  async updatePulseExecution(id: number, actions: PulseExecutionActions): Promise<PulseExecution> {
    const [execution] = await db
      .update(pulseExecutions)
      .set({ actions })
      .where(eq(pulseExecutions.id, id))
      .returning();
    return execution;
  }

  async deletePulseExecution(id: number): Promise<void> {
    await db.delete(pulseExecutions).where(eq(pulseExecutions.id, id));
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

  // Attestations
  async createAttestation(attestationData: InsertAttestation): Promise<Attestation> {
    const [attestation] = await db.insert(attestations).values(attestationData).returning();
    return attestation;
  }

  async getAttestation(pulseExecutionId: number): Promise<Attestation | undefined> {
    const [attestation] = await db.select().from(attestations).where(eq(attestations.pulseExecutionId, pulseExecutionId));
    return attestation;
  }

  async getPendingAttestations(): Promise<{ execution: PulseExecution; member: Member; pulse: Pulse }[]> {
    // Query pulse executions that need attestations (no record OR pending/failed status)
    const results = await db
      .select({
        execution: pulseExecutions,
        member: members,
        pulse: pulses,
      })
      .from(pulseExecutions)
      .leftJoin(attestations, eq(pulseExecutions.id, attestations.pulseExecutionId))
      .innerJoin(members, eq(pulseExecutions.memberId, members.id))
      .innerJoin(pulses, eq(pulseExecutions.pulseId, pulses.id))
      .where(
        and(
          // No attestation exists OR attestation is pending/failed
          or(
            isNull(attestations.id), // No attestation record
            inArray(attestations.status, ['pending', 'failed']) // Pending or failed attestations
          ),
          eq(members.status, 'active_member'), // Only active members
          eq(members.passportVerified, true), // Only verified passport holders
          isNotNull(members.ipePassport), // Must have verified passport
          isNotNull(members.walletAddress), // Must have wallet address for recipient
          // Only include pulses where interval window has closed
          sql`${pulses.datetimeStart} + INTERVAL '1 hour' * ${pulses.interval} < NOW()` // Pulse window has closed
        )
      );

    return results;
  }

  async updateAttestationStatus(
    id: number, 
    status: string, 
    attestationUid?: string, 
    transactionHash?: string
  ): Promise<Attestation> {
    const updateData: any = { status };
    if (attestationUid) updateData.attestationUid = attestationUid;
    if (transactionHash) updateData.transactionHash = transactionHash;

    const [attestation] = await db
      .update(attestations)
      .set(updateData)
      .where(eq(attestations.id, id))
      .returning();
    return attestation;
  }

  async verifyPulseExecutionOwnership(executionId: number, memberId: number): Promise<boolean> {
    const [execution] = await db
      .select()
      .from(pulseExecutions)
      .where(
        and(
          eq(pulseExecutions.id, executionId),
          eq(pulseExecutions.memberId, memberId)
        )
      );
    return !!execution;
  }
}

export const storage = new DatabaseStorage();