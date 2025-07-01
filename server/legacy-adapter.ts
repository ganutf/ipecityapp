import { db } from "./db";
import { sql } from "drizzle-orm";
import { Member } from "@shared/Member";
import { MembershipState } from "@shared/schema";

/**
 * Temporary adapter to work with the existing database structure
 * while we migrate to the new simplified schema
 */

export interface LegacyMemberRecord {
  id: number;
  farcaster_fid: number;
  farcaster_username: string | null;
  name: string | null;
  ipe_passport: string | null;
  approved: boolean | null;
  created_at: Date | null;
  email: string | null;
  email_verified: boolean | null;
  x_handle: string | null;
  linkedin: string | null;
  mini_bio: string | null;
  profile_tags: string[] | null;
  registration_status: string | null;
  registered_at: Date | null;
  updated_at: Date | null;
  status: string | null;
  passport_verified: boolean | null;
  passport_claim_subdomain: string | null;
  passport_claim_wallet_address: string | null;
  passport_claim_status: string | null;
  profile_completed: boolean | null;
}

export class LegacyAdapter {
  
  async getMember(farcasterFid: number): Promise<Member | null> {
    try {
      const result = await db.execute(
        sql`SELECT * FROM members WHERE farcaster_fid = ${farcasterFid} LIMIT 1`
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      
      // Convert legacy record to new Member format
      const memberData = {
        id: row.id,
        farcasterFid: row.farcaster_fid,
        farcasterUsername: row.farcaster_username,
        farcasterDisplayName: row.name, // Legacy 'name' maps to display name
        farcasterPfpUrl: null,
        farcasterBio: row.mini_bio,
        email: row.email,
        emailVerified: row.email_verified || false,
        xHandle: row.x_handle,
        linkedin: row.linkedin,
        miniBio: row.mini_bio,
        profileTags: row.profile_tags || [],
        ipePassport: row.ipe_passport,
        passportVerified: row.passport_verified || false,
        connectedWalletAddress: row.passport_claim_wallet_address,
        membershipState: this.determineMembershipState(row),
        profileCompleted: row.profile_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      return new Member(memberData);
    } catch (error) {
      console.error("Error getting member:", error);
      return null;
    }
  }
  
  async createMember(memberData: {
    farcasterFid: number;
    farcasterUsername?: string | null;
    farcasterDisplayName?: string | null;
    farcasterPfpUrl?: string | null;
    farcasterBio?: string | null;
    membershipState: string;
    emailVerified: boolean;
    passportVerified: boolean;
  }): Promise<Member> {
    try {
      const result = await db.execute(
        sql`
          INSERT INTO members (
            farcaster_fid,
            farcaster_username,
            name,
            mini_bio,
            email_verified,
            passport_verified,
            status,
            approved,
            created_at,
            updated_at
          ) VALUES (
            ${memberData.farcasterFid},
            ${memberData.farcasterUsername},
            ${memberData.farcasterDisplayName},
            ${memberData.farcasterBio},
            ${memberData.emailVerified},
            ${memberData.passportVerified},
            ${memberData.membershipState},
            ${false},
            NOW(),
            NOW()
          )
          RETURNING *
        `
      );
      
      const row = result.rows[0] as any;
      
      // Convert back to new format
      const newMemberData = {
        id: row.id,
        farcasterFid: row.farcaster_fid,
        farcasterUsername: row.farcaster_username,
        farcasterDisplayName: row.name,
        farcasterPfpUrl: null,
        farcasterBio: row.mini_bio,
        email: row.email,
        emailVerified: row.email_verified || false,
        xHandle: row.x_handle,
        linkedin: row.linkedin,
        miniBio: row.mini_bio,
        profileTags: row.profile_tags || [],
        ipePassport: row.ipe_passport,
        passportVerified: row.passport_verified || false,
        connectedWalletAddress: row.passport_claim_wallet_address,
        membershipState: memberData.membershipState,
        profileCompleted: row.profile_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      return new Member(newMemberData);
    } catch (error) {
      console.error("Error creating member:", error);
      throw error;
    }
  }
  
  async updateMembershipState(farcasterFid: number, state: string): Promise<Member | null> {
    try {
      const result = await db.execute(
        sql`
          UPDATE members 
          SET status = ${state}, updated_at = NOW()
          WHERE farcaster_fid = ${farcasterFid}
          RETURNING *
        `
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      
      const memberData = {
        id: row.id,
        farcasterFid: row.farcaster_fid,
        farcasterUsername: row.farcaster_username,
        farcasterDisplayName: row.name,
        farcasterPfpUrl: null,
        farcasterBio: row.mini_bio,
        email: row.email,
        emailVerified: row.email_verified || false,
        xHandle: row.x_handle,
        linkedin: row.linkedin,
        miniBio: row.mini_bio,
        profileTags: row.profile_tags || [],
        ipePassport: row.ipe_passport,
        passportVerified: row.passport_verified || false,
        connectedWalletAddress: row.passport_claim_wallet_address,
        membershipState: state,
        profileCompleted: row.profile_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      return new Member(memberData);
    } catch (error) {
      console.error("Error updating membership state:", error);
      return null;
    }
  }
  
  async markEmailVerified(farcasterFid: number, email: string): Promise<Member | null> {
    try {
      const result = await db.execute(
        sql`
          UPDATE members 
          SET email = ${email}, email_verified = true, updated_at = NOW()
          WHERE farcaster_fid = ${farcasterFid}
          RETURNING *
        `
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      
      const memberData = {
        id: row.id,
        farcasterFid: row.farcaster_fid,
        farcasterUsername: row.farcaster_username,
        farcasterDisplayName: row.name,
        farcasterPfpUrl: null,
        farcasterBio: row.mini_bio,
        email: row.email,
        emailVerified: true,
        xHandle: row.x_handle,
        linkedin: row.linkedin,
        miniBio: row.mini_bio,
        profileTags: row.profile_tags || [],
        ipePassport: row.ipe_passport,
        passportVerified: row.passport_verified || false,
        connectedWalletAddress: row.passport_claim_wallet_address,
        membershipState: this.determineMembershipState(row),
        profileCompleted: row.profile_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      return new Member(memberData);
    } catch (error) {
      console.error("Error marking email verified:", error);
      return null;
    }
  }
  
  async markPassportVerified(farcasterFid: number, passport: string, walletAddress: string): Promise<Member | null> {
    try {
      const result = await db.execute(
        sql`
          UPDATE members 
          SET ipe_passport = ${passport}, 
              passport_verified = true, 
              passport_claim_wallet_address = ${walletAddress},
              updated_at = NOW()
          WHERE farcaster_fid = ${farcasterFid}
          RETURNING *
        `
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0] as any;
      
      const memberData = {
        id: row.id,
        farcasterFid: row.farcaster_fid,
        farcasterUsername: row.farcaster_username,
        farcasterDisplayName: row.name,
        farcasterPfpUrl: null,
        farcasterBio: row.mini_bio,
        email: row.email,
        emailVerified: row.email_verified || false,
        xHandle: row.x_handle,
        linkedin: row.linkedin,
        miniBio: row.mini_bio,
        profileTags: row.profile_tags || [],
        ipePassport: row.ipe_passport,
        passportVerified: true,
        connectedWalletAddress: row.passport_claim_wallet_address,
        membershipState: this.determineMembershipState(row),
        profileCompleted: row.profile_completed || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      return new Member(memberData);
    } catch (error) {
      console.error("Error marking passport verified:", error);
      return null;
    }
  }
  
  private determineMembershipState(row: any): string {
    // Convert legacy status/approval logic to new state machine
    if (row.email_verified && row.passport_verified) {
      return MembershipState.MEMBERSHIP_ACTIVE;
    } else if (row.email_verified || row.passport_verified) {
      return MembershipState.WAITING_MEMBERSHIP_VERIFICATION;
    } else {
      return MembershipState.NEW_MEMBER;
    }
  }
}

export const legacyAdapter = new LegacyAdapter();