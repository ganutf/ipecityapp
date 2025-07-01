import { db } from "./db";
import { members, emailVerifications, passportVerifications } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { Member } from "@shared/Member";
import { 
  Member as DatabaseMember, 
  InsertMember, 
  UpdateMember,
  EmailVerification,
  InsertEmailVerification,
  PassportVerification,
  InsertPassportVerification,
  EmailVerificationRequest,
  PassportVerificationRequest,
  MembershipState
} from "@shared/schema";

/**
 * Simplified storage interface focused on the new state machine
 */
export interface ISimplifiedStorage {
  // Core member operations
  getMember(farcasterFid: number): Promise<DatabaseMember | undefined>;
  createMember(memberData: InsertMember): Promise<DatabaseMember>;
  updateMember(farcasterFid: number, memberData: UpdateMember): Promise<DatabaseMember>;
  
  // State transitions
  updateMembershipState(farcasterFid: number, state: string): Promise<DatabaseMember>;
  markEmailVerified(farcasterFid: number, email: string): Promise<DatabaseMember>;
  markPassportVerified(farcasterFid: number, passport: string, walletAddress: string): Promise<DatabaseMember>;
  
  // Email verification
  createEmailVerification(verification: InsertEmailVerification): Promise<EmailVerification>;
  getEmailVerification(farcasterFid: number, code: string): Promise<EmailVerification | undefined>;
  
  // Passport verification
  createPassportVerification(verification: InsertPassportVerification): Promise<PassportVerification>;
  getPassportVerification(token: string): Promise<PassportVerification | undefined>;
  markPassportVerificationComplete(token: string): Promise<PassportVerification | undefined>;
}

export class SimplifiedDatabaseStorage implements ISimplifiedStorage {
  
  async getMember(farcasterFid: number): Promise<DatabaseMember | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.farcasterFid, farcasterFid));
    return member || undefined;
  }
  
  async createMember(memberData: InsertMember): Promise<DatabaseMember> {
    const [member] = await db
      .insert(members)
      .values(memberData)
      .returning();
    return member;
  }
  
  async updateMember(farcasterFid: number, memberData: UpdateMember): Promise<DatabaseMember> {
    const [member] = await db
      .update(members)
      .set({ ...memberData, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }
  
  async updateMembershipState(farcasterFid: number, state: string): Promise<DatabaseMember> {
    const [member] = await db
      .update(members)
      .set({ membershipState: state, updatedAt: new Date() })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }
  
  async markEmailVerified(farcasterFid: number, email: string): Promise<DatabaseMember> {
    // First mark email verification as complete
    await db
      .update(emailVerifications)
      .set({ verified: true })
      .where(eq(emailVerifications.farcasterFid, farcasterFid));
    
    // Get current member to check passport status
    const currentMember = await this.getMember(farcasterFid);
    const newState = currentMember?.passportVerified ? 
      MembershipState.MEMBERSHIP_ACTIVE : 
      MembershipState.WAITING_MEMBERSHIP_VERIFICATION;
    
    // Update member with verified email and new state
    const [member] = await db
      .update(members)
      .set({ 
        email,
        emailVerified: true, 
        membershipState: newState,
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }
  
  async markPassportVerified(farcasterFid: number, passport: string, walletAddress: string): Promise<DatabaseMember> {
    // Get current member to check email status
    const currentMember = await this.getMember(farcasterFid);
    const newState = currentMember?.emailVerified ? 
      MembershipState.MEMBERSHIP_ACTIVE : 
      MembershipState.WAITING_MEMBERSHIP_VERIFICATION;
    
    // Update member with verified passport and new state
    const [member] = await db
      .update(members)
      .set({ 
        ipePassport: passport,
        passportVerified: true,
        connectedWalletAddress: walletAddress,
        membershipState: newState,
        updatedAt: new Date() 
      })
      .where(eq(members.farcasterFid, farcasterFid))
      .returning();
    return member;
  }
  
  // Email verification methods
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
  
  // Passport verification methods
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
  
  async markPassportVerificationComplete(token: string): Promise<PassportVerification | undefined> {
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
}

export const simplifiedStorage = new SimplifiedDatabaseStorage();