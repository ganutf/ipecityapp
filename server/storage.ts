import {
  members,
  pulses,
  pulseTypes,
  pulseExecutions,
  attestations,
  userSigners,
  emailVerifications,
  passportVerifications,
  // Member wallets
  memberWallets,
  // Auth V2 tables
  authUsers,
  passkeys,
  smartWallets,
  farcasterAccounts,
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
  // Auth V2 types
  type AuthUser,
  type InsertAuthUser,
  type Passkey,
  type InsertPasskey,
  type SmartWallet,
  type InsertSmartWallet,
  type FarcasterAccount,
  type InsertFarcasterAccount,
  type MemberWallet,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, isNull, isNotNull, inArray, sql } from "drizzle-orm";
import logger from "./logger";

export interface IStorage {
  // Database Transactions
  withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
  
  // Attestation Transaction Methods
  createAttestationWithTransaction(attestationData: InsertAttestation): Promise<Attestation>;
  createBulkAttestationsWithTransaction(attestations: InsertAttestation[]): Promise<{ successful: Attestation[]; failed: { error: string; data: InsertAttestation }[] }>;
  
  // Members - Primary methods using memberId
  getMember(memberId: number): Promise<Member | undefined>;
  getMemberByEmail(email: string): Promise<Member | undefined>;
  getMemberByIpePassport(passport: string): Promise<Member | undefined>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(memberId: number, member: UpdateMember): Promise<Member>;
  deleteMember(memberId: number): Promise<void>;
  getAllMembers(): Promise<Member[]>;
  getActiveMembersWithStats(pulseService?: { calculateMemberStreak(memberId: number): Promise<number> }): Promise<Array<Member & { totalPoints: number; pulseStreak: number }>>;
  getMemberWithStats(memberId: number, pulseService?: { calculateMemberStreak(memberId: number): Promise<number> }): Promise<(Member & { totalPoints: number; pulseStreak: number }) | undefined>;
  calculatePulseStreak(memberId: number): Promise<number>;
  
  // Compatibility methods for farcasterFid lookup
  getMemberByFarcasterFid(farcasterFid: number): Promise<Member | undefined>;
  getMemberIdFromFarcasterFid(farcasterFid: number): Promise<number | undefined>;
  getFarcasterFidFromMemberId(memberId: number): Promise<number | null | undefined>;
  
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
  
  
  // Email Verification
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  getEmailVerification(memberId: number, code: string): Promise<EmailVerification | undefined>;
  markEmailVerified(memberId: number): Promise<void>;
  
  
  // Status Management
  updateMemberStatus(memberId: number, status: string): Promise<Member>;
  
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
  getPulsesWithExecutionStatus(memberId: number): Promise<{pulseId: number; datetimeStart: Date; interval: number; executionId: number | null}[]>;
  createPulse(pulse: InsertPulse): Promise<Pulse>;
  updatePulse(id: number, pulse: UpdatePulse): Promise<Pulse>;
  deletePulse(id: number): Promise<void>;
  
  // Pulse Executions
  getPulseExecution(pulseId: number, memberId: number): Promise<PulseExecution | undefined>;
  getMemberExecutions(memberId: number): Promise<PulseExecution[]>;
  getMemberExecutionsWithDetails(memberId: number): Promise<{ execution: PulseExecution; pulse: Pulse; attestation: Attestation | null }[]>;
  createPulseExecution(execution: InsertPulseExecution): Promise<PulseExecution>;
  updatePulseExecution(id: number, actions: PulseExecutionActions): Promise<PulseExecution>;
  deletePulseExecution(id: number): Promise<void>;
  
  
  // Attestations
  createAttestation(attestation: InsertAttestation): Promise<Attestation>;
  getAttestation(pulseExecutionId: number): Promise<Attestation | undefined>;
  getPendingAttestations(): Promise<{ execution: PulseExecution; member: Member; pulse: Pulse }[]>;
  getPendingAttestationsByPulse(pulseId: number): Promise<{ execution: PulseExecution; member: Member; pulse: Pulse }[]>;
  getPulseExecutionsWithAttestations(pulseId: number): Promise<{ execution: PulseExecution | null; member: Member; attestation: Attestation | null }[]>;
  updateAttestationStatus(id: number, status: string, attestationUid?: string, transactionHash?: string): Promise<Attestation>;
  verifyPulseExecutionOwnership(executionId: number, memberId: number): Promise<boolean>;
  
  // User Signers
  getUserSigner(memberId: number): Promise<UserSigner | undefined>;
  createUserSigner(signer: InsertUserSigner): Promise<UserSigner>;
  updateUserSignerStatus(memberId: number, status: string): Promise<UserSigner>;
  deleteUserSigner(memberId: number): Promise<void>;

  // ============================================
  // AUTH V2 METHODS
  // ============================================

  // Auth Users
  getAuthUserById(id: string): Promise<AuthUser | undefined>;
  getAuthUserByEmail(email: string): Promise<AuthUser | undefined>;
  createAuthUser(user: InsertAuthUser): Promise<AuthUser>;
  updateAuthUserEmailVerified(id: string, verified: boolean): Promise<AuthUser>;

  // Passkeys
  getPasskeysByUserId(userId: string): Promise<Passkey[]>;
  getPasskeyByCredentialId(credentialId: string): Promise<Passkey | undefined>;
  createPasskey(passkey: InsertPasskey): Promise<Passkey>;
  updatePasskeySignCount(id: number, signCount: number): Promise<Passkey>;
  deletePasskey(id: number): Promise<void>;

  // Smart Wallets
  getSmartWalletByUserId(userId: string): Promise<SmartWallet | undefined>;
  getSmartWalletByAddress(address: string): Promise<SmartWallet | undefined>;
  createSmartWallet(wallet: InsertSmartWallet): Promise<SmartWallet>;

  // Farcaster Accounts
  getFarcasterAccountByUserId(userId: string): Promise<FarcasterAccount | undefined>;
  getFarcasterAccountByFid(fid: number): Promise<FarcasterAccount | undefined>;
  createFarcasterAccount(account: InsertFarcasterAccount): Promise<FarcasterAccount>;

  // Member by userId
  getMemberByUserId(userId: string): Promise<Member | undefined>;

  // Privy Auth
  getMemberByPrivyId(privyId: string): Promise<Member | undefined>;
  getMemberByIpeUsername(ipeUsername: string): Promise<Member | undefined>;
  createMemberFromPrivy(privyId: string, email?: string, walletAddress?: string): Promise<Member>;

  // Member Wallets
  getMemberWallets(memberId: number): Promise<MemberWallet[]>;
  getMemberWalletByAddress(walletAddress: string): Promise<MemberWallet | undefined>;
  linkMemberWallet(data: { memberId: number; walletAddress: string; walletType: string; label?: string }): Promise<MemberWallet>;
  unlinkMemberWallet(memberId: number, walletAddress: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Database Transactions
  async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }
  
  // Attestation Transaction Methods
  async createAttestationWithTransaction(attestationData: InsertAttestation): Promise<Attestation> {
    return await this.withTransaction(async (tx) => {
      // Check if attestation already exists
      const [existingAttestation] = await tx
        .select()
        .from(attestations)
        .where(eq(attestations.pulseExecutionId, attestationData.pulseExecutionId));
      
      if (existingAttestation) {
        throw new Error(`Attestation already exists for pulse execution ${attestationData.pulseExecutionId}`);
      }
      
      // Create the attestation
      const [attestation] = await tx.insert(attestations).values(attestationData).returning();
      return attestation;
    });
  }
  
  async createBulkAttestationsWithTransaction(attestationDataList: InsertAttestation[]): Promise<{ successful: Attestation[]; failed: { error: string; data: InsertAttestation }[] }> {
    const successful: Attestation[] = [];
    const failed: { error: string; data: InsertAttestation }[] = [];
    
    // Process in batches of 10 to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < attestationDataList.length; i += batchSize) {
      const batch = attestationDataList.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (attestationData) => {
          try {
            const attestation = await this.createAttestationWithTransaction(attestationData);
            successful.push(attestation);
          } catch (error) {
            failed.push({
              error: error instanceof Error ? error.message : 'Unknown error',
              data: attestationData
            });
          }
        })
      );
    }
    
    return { successful, failed };
  }
  
  // Members - Primary methods using memberId
  async getMember(memberId: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, memberId));
    return member;
  }
  
  // Compatibility methods for farcasterFid lookup
  async getMemberByFarcasterFid(farcasterFid: number): Promise<Member | undefined> {
    logger.debug(`Storage: getMemberByFarcasterFid called with FID: ${farcasterFid} (type: ${typeof farcasterFid})`);
    const [member] = await db.select().from(members).where(eq(members.farcasterFid, farcasterFid));
    logger.debug(`Storage: Query result:`, member ? {
      id: member.id,
      farcasterFid: member.farcasterFid,
      status: member.status,
      found: true
    } : { found: false });
    return member;
  }
  
  async getMemberIdFromFarcasterFid(farcasterFid: number): Promise<number | undefined> {
    const member = await this.getMemberByFarcasterFid(farcasterFid);
    return member?.id;
  }
  
  async getFarcasterFidFromMemberId(memberId: number): Promise<number | null | undefined> {
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
    
    // First, get all pulse execution IDs for this member
    const memberExecutions = await db
      .select({ id: pulseExecutions.id })
      .from(pulseExecutions)
      .where(eq(pulseExecutions.memberId, memberId));
    
    const executionIds = memberExecutions.map(exec => exec.id);
    
    // Delete attestations that reference this member's pulse executions
    if (executionIds.length > 0) {
      await db.delete(attestations).where(inArray(attestations.pulseExecutionId, executionIds));
    }
    
    // Delete pulse executions
    await db.delete(pulseExecutions).where(eq(pulseExecutions.memberId, memberId));
    
    // Delete user signer
    await db.delete(userSigners).where(eq(userSigners.memberId, memberId));
    
    // Delete email verifications
    await db.delete(emailVerifications).where(eq(emailVerifications.memberId, memberId));
    
    // Delete passport verifications
    await db.delete(passportVerifications).where(eq(passportVerifications.memberId, memberId));

    // Delete member wallets
    await db.delete(memberWallets).where(eq(memberWallets.memberId, memberId));

    // Finally delete the member
    await db.delete(members).where(eq(members.id, memberId));
  }

  async getAllMembers(): Promise<Member[]> {
    return await db.select().from(members).orderBy(desc(members.createdAt));
  }

  async getActiveMembersWithStats(pulseService?: { calculateMemberStreak(memberId: number): Promise<number> }): Promise<Array<Member & { totalPoints: number; pulseStreak: number }>> {
    // Get all active members
    const activeMembers = await db
      .select()
      .from(members)
      .where(eq(members.status, 'active_member'))
      .orderBy(desc(members.createdAt));

    // Calculate stats for each member
    const membersWithStats = await Promise.all(
      activeMembers.map(async (member) => {
        const totalPoints = await this.calculateTotalPoints(member.id);
        const pulseStreak = pulseService 
          ? await pulseService.calculateMemberStreak(member.id)
          : await this.calculatePulseStreak(member.id);
        return {
          ...member,
          totalPoints,
          pulseStreak,
        };
      })
    );

    return membersWithStats;
  }

  async getMemberWithStats(memberId: number, pulseService?: { calculateMemberStreak(memberId: number): Promise<number> }): Promise<(Member & { totalPoints: number; pulseStreak: number }) | undefined> {
    const member = await this.getMember(memberId);
    if (!member) return undefined;

    const totalPoints = await this.calculateTotalPoints(memberId);
    const pulseStreak = pulseService 
      ? await pulseService.calculateMemberStreak(memberId)
      : await this.calculatePulseStreak(memberId);

    return {
      ...member,
      totalPoints,
      pulseStreak,
    };
  }

  async calculateTotalPoints(memberId: number): Promise<number> {
    // Get all pulse executions for this member with their points
    const result = await db
      .select({
        points: pulses.points,
      })
      .from(pulseExecutions)
      .innerJoin(pulses, eq(pulseExecutions.pulseId, pulses.id))
      .where(eq(pulseExecutions.memberId, memberId));

    return result.reduce((total, execution) => total + execution.points, 0);
  }

  async calculatePulseStreak(memberId: number): Promise<number> {
    // DEPRECATED: This method is deprecated in favor of PulseService.calculateMemberStreak()
    // This fallback implementation uses simple consecutive logic without active pulse handling
    // For proper business logic including active pulse handling, use PulseService instead
    
    const pulseResults = await this.getPulsesWithExecutionStatus(memberId);
    
    if (pulseResults.length === 0) return 0;

    // Simple consecutive execution count (no complex active pulse logic)
    let streak = 0;
    for (const result of pulseResults) {
      if (result.executionId !== null) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
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

  /**
   * Upgrade member to active status with subdomain
   * Used when user completes ID verification and subdomain is found
   */
  async upgradeMemberToActive(
    memberId: number,
    ipePassport: string,
    memberType: string = 'explorer'
  ): Promise<Member> {
    const [member] = await db
      .update(members)
      .set({
        status: 'active_member',
        ipePassport,
        passportVerified: true,
        memberType,
        updatedAt: new Date(),
      })
      .where(eq(members.id, memberId))
      .returning();
    return member;
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

  async getPulsesWithExecutionStatus(memberId: number): Promise<{pulseId: number; datetimeStart: Date; interval: number; executionId: number | null}[]> {
    return await db
      .select({
        pulseId: pulses.id,
        datetimeStart: pulses.datetimeStart,
        interval: pulses.interval,
        executionId: pulseExecutions.id, // NULL if not executed by this member
      })
      .from(pulses)
      .leftJoin(pulseExecutions, and(
        eq(pulses.id, pulseExecutions.pulseId),
        eq(pulseExecutions.memberId, memberId)
      ))
      .orderBy(desc(pulses.datetimeStart)); // Most recent pulse first
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

  async deletePulse(id: number): Promise<void> {
    // First, delete related attestations
    const relatedAttestations = await db
      .select({ id: attestations.id })
      .from(attestations)
      .innerJoin(pulseExecutions, eq(attestations.pulseExecutionId, pulseExecutions.id))
      .where(eq(pulseExecutions.pulseId, id));
    
    if (relatedAttestations.length > 0) {
      const attestationIds = relatedAttestations.map(a => a.id);
      await db.delete(attestations).where(inArray(attestations.id, attestationIds));
    }
    
    // Then delete pulse executions
    await db.delete(pulseExecutions).where(eq(pulseExecutions.pulseId, id));
    
    // Finally delete the pulse itself
    await db.delete(pulses).where(eq(pulses.id, id));
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
  

  async getMemberExecutions(memberId: number): Promise<PulseExecution[]> {
    return await db
      .select()
      .from(pulseExecutions)
      .where(eq(pulseExecutions.memberId, memberId))
      .orderBy(desc(pulseExecutions.executedAt));
  }

  async getMemberExecutionsWithDetails(memberId: number): Promise<{ execution: PulseExecution; pulse: Pulse; attestation: Attestation | null }[]> {
    const results = await db
      .select({
        execution: pulseExecutions,
        pulse: pulses,
        attestation: attestations,
      })
      .from(pulseExecutions)
      .innerJoin(pulses, eq(pulseExecutions.pulseId, pulses.id))
      .leftJoin(attestations, eq(pulseExecutions.id, attestations.pulseExecutionId))
      .where(eq(pulseExecutions.memberId, memberId))
      .orderBy(desc(pulseExecutions.executedAt));
    
    return results;
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
  

  async deleteUserSigner(memberId: number): Promise<void> {
    await db.delete(userSigners).where(eq(userSigners.memberId, memberId));
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
          // Only include pulses where interval window has closed (UTC comparison)
          sql`${pulses.datetimeStart} + INTERVAL '1 hour' * ${pulses.interval} < NOW() AT TIME ZONE 'UTC'` // Pulse window has closed
        )
      );

    return results;
  }

  async getPendingAttestationsByPulse(pulseId: number): Promise<{ execution: PulseExecution; member: Member; pulse: Pulse }[]> {
    // Same logic as getPendingAttestations but filtered by pulse ID
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
          eq(pulses.id, pulseId), // Filter by specific pulse ID
          // No attestation exists OR attestation is pending/failed
          or(
            isNull(attestations.id), // No attestation record
            inArray(attestations.status, ['pending', 'failed']) // Pending or failed attestations
          ),
          eq(members.status, 'active_member'), // Only active members
          eq(members.passportVerified, true), // Only verified passport holders
          isNotNull(members.ipePassport), // Must have verified passport
          isNotNull(members.walletAddress), // Must have wallet address for recipient
          // Only include pulses where interval window has closed (UTC comparison)
          sql`${pulses.datetimeStart} + INTERVAL '1 hour' * ${pulses.interval} < NOW() AT TIME ZONE 'UTC'` // Pulse window has closed
        )
      );
    return results;
  }

  async getPulseExecutionsWithAttestations(pulseId: number): Promise<{ execution: PulseExecution | null; member: Member; attestation: Attestation | null }[]> {
    // Get all active members and their executions/attestations for a specific pulse
    const results = await db
      .select({
        execution: pulseExecutions,
        member: members,
        attestation: attestations,
      })
      .from(members)
      .leftJoin(pulseExecutions, and(
        eq(pulseExecutions.memberId, members.id),
        eq(pulseExecutions.pulseId, pulseId)
      ))
      .leftJoin(attestations, eq(attestations.pulseExecutionId, pulseExecutions.id))
      .where(
        and(
          eq(members.status, 'active_member'), // Only active members
          eq(members.passportVerified, true) // Only verified passport holders
        )
      )
      .orderBy(asc(members.farcasterFid));
    
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

  // ============================================
  // AUTH V2 METHODS
  // ============================================

  // Auth Users
  async getAuthUserById(id: string): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
    return user;
  }

  async getAuthUserByEmail(email: string): Promise<AuthUser | undefined> {
    const [user] = await db.select().from(authUsers).where(eq(authUsers.email, email.toLowerCase()));
    return user;
  }

  async createAuthUser(userData: InsertAuthUser): Promise<AuthUser> {
    const [user] = await db.insert(authUsers).values({
      ...userData,
      email: userData.email.toLowerCase(),
    }).returning();
    return user;
  }

  async updateAuthUserEmailVerified(id: string, verified: boolean): Promise<AuthUser> {
    const [user] = await db
      .update(authUsers)
      .set({
        emailVerified: verified,
        emailVerifiedAt: verified ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(authUsers.id, id))
      .returning();
    return user;
  }

  // Passkeys
  async getPasskeysByUserId(userId: string): Promise<Passkey[]> {
    return await db.select().from(passkeys).where(eq(passkeys.userId, userId));
  }

  async getPasskeyByCredentialId(credentialId: string): Promise<Passkey | undefined> {
    const [passkey] = await db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId));
    return passkey;
  }

  async createPasskey(passkeyData: InsertPasskey): Promise<Passkey> {
    const [passkey] = await db.insert(passkeys).values(passkeyData).returning();
    return passkey;
  }

  async updatePasskeySignCount(id: number, signCount: number): Promise<Passkey> {
    const [passkey] = await db
      .update(passkeys)
      .set({
        signCount,
        lastUsedAt: new Date(),
      })
      .where(eq(passkeys.id, id))
      .returning();
    return passkey;
  }

  async deletePasskey(id: number): Promise<void> {
    await db.delete(passkeys).where(eq(passkeys.id, id));
  }

  // Smart Wallets
  async getSmartWalletByUserId(userId: string): Promise<SmartWallet | undefined> {
    const [wallet] = await db.select().from(smartWallets).where(eq(smartWallets.userId, userId));
    return wallet;
  }

  async getSmartWalletByAddress(address: string): Promise<SmartWallet | undefined> {
    const [wallet] = await db.select().from(smartWallets).where(eq(smartWallets.walletAddress, address.toLowerCase()));
    return wallet;
  }

  async createSmartWallet(walletData: InsertSmartWallet): Promise<SmartWallet> {
    const [wallet] = await db.insert(smartWallets).values({
      ...walletData,
      walletAddress: walletData.walletAddress.toLowerCase(),
    }).returning();
    return wallet;
  }

  // Farcaster Accounts
  async getFarcasterAccountByUserId(userId: string): Promise<FarcasterAccount | undefined> {
    const [account] = await db.select().from(farcasterAccounts).where(eq(farcasterAccounts.userId, userId));
    return account;
  }

  async getFarcasterAccountByFid(fid: number): Promise<FarcasterAccount | undefined> {
    const [account] = await db.select().from(farcasterAccounts).where(eq(farcasterAccounts.farcasterFid, fid));
    return account;
  }

  async createFarcasterAccount(accountData: InsertFarcasterAccount): Promise<FarcasterAccount> {
    const [account] = await db.insert(farcasterAccounts).values(accountData).returning();
    return account;
  }

  // Member by userId
  async getMemberByUserId(userId: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.userId, userId));
    return member;
  }

  // Privy Auth
  async getMemberByPrivyId(privyId: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.privyId, privyId));
    return member;
  }

  async getMemberByIpeUsername(ipeUsername: string): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.ipeUsername, ipeUsername));
    return member;
  }

  async createMemberFromPrivy(privyId: string, email?: string, walletAddress?: string): Promise<Member> {
    const [member] = await db.insert(members).values({
      privyId,
      email,
      walletAddress,
      status: 'pending_id_verification', // Start with email/passport verification
      emailVerified: !!email, // If email provided, Privy already verified it
      memberType: 'pending',
    }).returning();
    return member;
  }

  // Member Wallets
  async getMemberWallets(memberId: number): Promise<MemberWallet[]> {
    return await db.select().from(memberWallets)
      .where(eq(memberWallets.memberId, memberId))
      .orderBy(asc(memberWallets.linkedAt));
  }

  async getMemberWalletByAddress(walletAddress: string): Promise<MemberWallet | undefined> {
    const [wallet] = await db.select().from(memberWallets)
      .where(eq(memberWallets.walletAddress, walletAddress.toLowerCase()));
    return wallet;
  }

  async linkMemberWallet(data: { memberId: number; walletAddress: string; walletType: string; label?: string }): Promise<MemberWallet> {
    const normalizedAddress = data.walletAddress.toLowerCase();

    const existing = await this.getMemberWalletByAddress(normalizedAddress);
    if (existing) {
      if (existing.memberId === data.memberId) {
        return existing;
      }
      throw new Error('WALLET_ALREADY_LINKED');
    }

    const [wallet] = await db.insert(memberWallets).values({
      memberId: data.memberId,
      walletAddress: normalizedAddress,
      walletType: data.walletType,
      label: data.label,
    }).returning();
    return wallet;
  }

  async unlinkMemberWallet(memberId: number, walletAddress: string): Promise<boolean> {
    const result = await db.delete(memberWallets)
      .where(and(
        eq(memberWallets.memberId, memberId),
        eq(memberWallets.walletAddress, walletAddress.toLowerCase()),
      ))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();