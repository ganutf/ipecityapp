/**
 * MemberAdminService - admin operations for member management
 *
 * Passport operations now use direct ENS Registry calls instead of JustaName API.
 * All gas is paid by the ENS_ADMIN_MNEMONIC wallet — zero cost to members.
 */

import type { IStorage } from '../storage';
import type { Member } from '@shared/schema';
import { sendApprovalEmail, sendDenialEmail } from '../lib/email';
import { ValidationError, NotFoundError } from '../lib/errors';
import { getEnsSubdomainService } from '../lib/ensSubdomainService';
import logger from '../logger';

const VALID_APPROVAL_TYPES = ['architect', 'explorer', 'admin', 'org_team', 'core_team'];
const VALID_MEMBER_TYPES = ['pending', ...VALID_APPROVAL_TYPES];

interface ApproveMemberParams {
  memberId: number;
  ipeUsername: string;
  userWalletAddress?: string;
  memberType?: string;
}

export class MemberAdminService {
  constructor(private storage: IStorage) {}

  async getPendingMembers(): Promise<Member[]> {
    return this.storage.getPendingMembers();
  }

  async getAllMembers(): Promise<Member[]> {
    return this.storage.getAllMembers();
  }

  /**
   * Approve a member application.
   *
   * Creates the ENS subdomain on-chain (admin pays gas) and sets the member
   * directly to active_member. If ENS creation fails, falls back to
   * approved_application so the admin can retry.
   */
  async approveMember(params: ApproveMemberParams): Promise<Member> {
    const { memberId, ipeUsername, userWalletAddress, memberType } = params;

    if (!memberId) throw new ValidationError('memberId is required');
    if (!ipeUsername) throw new ValidationError('ipeUsername is required');
    if (memberType && !VALID_APPROVAL_TYPES.includes(memberType)) {
      throw new ValidationError(
        `Invalid member type. Must be ${VALID_APPROVAL_TYPES.map((t) => `'${t}'`).join(', ')}`,
      );
    }

    const member = await this.storage.getMember(memberId);
    if (!member) throw new NotFoundError('Member not found');

    const walletAddress = userWalletAddress ?? member.walletAddress;
    if (!walletAddress) throw new ValidationError('Member has no wallet address for ENS assignment');

    const passportName = `${ipeUsername}.ipecity.eth`;
    const resolvedMemberType = memberType ?? (member.memberType !== 'pending' ? member.memberType : 'explorer');

    // Attempt to create ENS subdomain on-chain (admin pays gas)
    let ensTxHash: string;
    try {
      const ensService = getEnsSubdomainService();
      ensTxHash = await ensService.createSubdomain(ipeUsername, walletAddress);
      logger.info(`ENS subdomain created: ${passportName} tx=${ensTxHash}`, { memberId });
    } catch (ensError) {
      // ENS creation failed — save approved_application state so admin can retry
      logger.error(`ENS subdomain creation failed for ${passportName}`, {
        memberId,
        error: ensError instanceof Error ? ensError.message : String(ensError),
      });

      const pendingMember = await this.storage.updateMember(memberId, {
        status: 'approved_application',
        ipeUsername,
        ipePassport: passportName,
        memberType: resolvedMemberType,
      });

      // Still send approval email — member knows they're approved even if ENS is pending
      if (pendingMember.email) {
        await sendApprovalEmail(pendingMember.email, passportName).catch((e) =>
          logger.error('Failed to send approval email', { memberId, error: e }),
        );
      }

      throw new Error(
        `Member approved (approved_application) but ENS subdomain creation failed — retry to activate: ${
          ensError instanceof Error ? ensError.message : String(ensError)
        }`,
      );
    }

    // ENS succeeded — go directly to active_member
    const updatedMember = await this.storage.updateMember(memberId, {
      status: 'active_member',
      ipeUsername,
      ipePassport: passportName,
      memberType: resolvedMemberType,
      passportVerified: true,
    });

    if (updatedMember.email) {
      await sendApprovalEmail(updatedMember.email, passportName).catch((e) =>
        logger.error('Failed to send approval email', { memberId, error: e }),
      );
    }

    logger.info(`Member ${memberId} approved and activated`, {
      ipePassport: passportName,
      ensTxHash,
    });

    return updatedMember;
  }

  async denyMember(memberId: number): Promise<Member> {
    if (!memberId) throw new ValidationError('memberId is required');

    const existingMember = await this.storage.getMember(memberId);
    if (!existingMember) throw new NotFoundError('Member not found');

    const deniedMember = await this.storage.denyMember(existingMember.id);

    if (deniedMember.email) {
      await sendDenialEmail(deniedMember.email).catch((e) =>
        logger.error('Failed to send denial email', { memberId, error: e }),
      );
    }

    return deniedMember;
  }

  async updateMemberType(memberId: number, memberType: string): Promise<Member> {
    if (!memberId) throw new ValidationError('memberId is required');
    if (!memberType || typeof memberType !== 'string') {
      throw new ValidationError('memberType is required');
    }
    if (!VALID_MEMBER_TYPES.includes(memberType)) {
      throw new ValidationError(
        `Invalid member type. Must be one of: ${VALID_MEMBER_TYPES.join(', ')}`,
      );
    }

    const existingMember = await this.storage.getMember(memberId);
    if (!existingMember) throw new NotFoundError('Member not found');

    const updatedMember = await this.storage.updateMember(existingMember.id, { memberType });
    logger.info(`Updated member type for member ${existingMember.id} to ${memberType}`);
    return updatedMember;
  }

  /**
   * Revoke a member's passport.
   * Reclaims the ENS subdomain (admin retakes ownership, clears resolver)
   * and sets member status to passport_revoked.
   */
  async revokePassport(memberId: number): Promise<Member> {
    if (!memberId) throw new ValidationError('memberId is required');

    const member = await this.storage.getMember(memberId);
    if (!member) throw new NotFoundError('Member not found');
    if (member.status !== 'active_member') {
      throw new ValidationError(
        `Member ${memberId} is not active (status: ${member.status}). Only active members can be revoked.`,
      );
    }
    if (!member.ipeUsername) {
      throw new ValidationError(`Member ${memberId} has no passport username`);
    }

    const ensService = getEnsSubdomainService();
    const txHash = await ensService.revokeSubdomain(member.ipeUsername);
    logger.info(`ENS subdomain revoked: ${member.ipeUsername}.ipecity.eth tx=${txHash}`, { memberId });

    return await this.storage.revokePassport(memberId);
  }

  /**
   * Reinstate a revoked member's passport.
   * Re-creates the ENS subdomain and sets status back to active_member.
   * Optionally sets a new membership expiry date.
   */
  async reinstatePassport(memberId: number, expiresAt?: Date): Promise<Member> {
    if (!memberId) throw new ValidationError('memberId is required');

    const member = await this.storage.getMember(memberId);
    if (!member) throw new NotFoundError('Member not found');
    if (member.status !== 'passport_revoked') {
      throw new ValidationError(
        `Member ${memberId} is not in passport_revoked status (status: ${member.status})`,
      );
    }
    if (!member.ipeUsername) {
      throw new ValidationError(`Member ${memberId} has no passport username`);
    }
    if (!member.walletAddress) {
      throw new ValidationError(`Member ${memberId} has no wallet address for ENS assignment`);
    }

    const ensService = getEnsSubdomainService();
    const txHash = await ensService.createSubdomain(member.ipeUsername, member.walletAddress);
    logger.info(`ENS subdomain reinstated: ${member.ipeUsername}.ipecity.eth tx=${txHash}`, { memberId });

    return await this.storage.reinstatePassport(memberId, expiresAt);
  }

  /**
   * Set or clear the membership expiry date for a member.
   * Pass null to make membership permanent (no expiry).
   */
  async setMembershipExpiry(memberId: number, expiresAt: Date | null): Promise<Member> {
    if (!memberId) throw new ValidationError('memberId is required');

    const member = await this.storage.getMember(memberId);
    if (!member) throw new NotFoundError('Member not found');

    return await this.storage.setMembershipExpiry(memberId, expiresAt);
  }
}

// Re-export shared error classes for backward compatibility with route imports
export { ValidationError, NotFoundError } from '../lib/errors';
