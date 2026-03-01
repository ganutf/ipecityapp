/**
 * MemberAdminService - admin operations for member management
 * Extracted from server/routes.ts (lines ~1272-1484)
 */

import type { IStorage } from '../storage';
import type { Member } from '@shared/schema';
import { sendApprovalEmail, sendDenialEmail } from '../lib/email';
import { ValidationError, NotFoundError } from '../lib/errors';
import logger from '../logger';

const VALID_APPROVAL_TYPES = ['architect', 'explorer', 'admin', 'org_team', 'core_team'];
const VALID_MEMBER_TYPES = ['pending', ...VALID_APPROVAL_TYPES];

interface ApproveMemberParams {
  memberId: number;
  ipeUsername: string;
  userWalletAddress: string;
  memberType?: string;
}

export class MemberAdminService {
  constructor(
    private storage: IStorage,
    private justaNameApiKey: string,
  ) {}

  async getPendingMembers(): Promise<Member[]> {
    return this.storage.getPendingMembers();
  }

  async getAllMembers(): Promise<Member[]> {
    return this.storage.getAllMembers();
  }

  async approveMember(params: ApproveMemberParams): Promise<Member> {
    const { memberId, ipeUsername, userWalletAddress, memberType } = params;

    if (!memberId) {
      throw new ValidationError('memberId is required');
    }
    if (!userWalletAddress) {
      throw new ValidationError('User Wallet is required');
    }
    if (!ipeUsername) {
      throw new ValidationError('IpeUsername is required');
    }
    if (memberType && !VALID_APPROVAL_TYPES.includes(memberType)) {
      throw new ValidationError(
        `Invalid member type. Must be ${VALID_APPROVAL_TYPES.map(t => `'${t}'`).join(', ')}`,
      );
    }

    const member = await this.storage.getMember(memberId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    // Reserve ENS subdomain via JustaName API
    await this.reserveSubdomain(ipeUsername, userWalletAddress);

    // Update member status
    const updatedMember = memberType
      ? await this.storage.approveApplication(member.id, memberType)
      : await this.storage.approveMember(member.id);

    // Send approval email
    if (updatedMember.email) {
      const passportName = ipeUsername
        ? `${ipeUsername}.ipecity.eth`
        : updatedMember.ipePassport;
      if (passportName) {
        await sendApprovalEmail(updatedMember.email, passportName);
      }
    }

    return updatedMember;
  }

  async denyMember(memberId: number): Promise<Member> {
    if (!memberId) {
      throw new ValidationError('memberId is required');
    }

    const existingMember = await this.storage.getMember(memberId);
    if (!existingMember) {
      throw new NotFoundError('Member not found');
    }

    const deniedMember = await this.storage.denyMember(existingMember.id);

    if (deniedMember.email) {
      await sendDenialEmail(deniedMember.email);
    }

    return deniedMember;
  }

  async updateMemberType(memberId: number, memberType: string): Promise<Member> {
    if (!memberId) {
      throw new ValidationError('memberId is required');
    }
    if (!memberType || typeof memberType !== 'string') {
      throw new ValidationError('memberType is required');
    }
    if (!VALID_MEMBER_TYPES.includes(memberType)) {
      throw new ValidationError(
        `Invalid member type. Must be one of: ${VALID_MEMBER_TYPES.join(', ')}`,
      );
    }

    const existingMember = await this.storage.getMember(memberId);
    if (!existingMember) {
      throw new NotFoundError('Member not found');
    }

    const updatedMember = await this.storage.updateMember(existingMember.id, { memberType });
    logger.info(`Updated member type for member ${existingMember.id} to ${memberType}`);
    return updatedMember;
  }

  private async reserveSubdomain(username: string, walletAddress: string): Promise<void> {
    logger.info(`Reserving subdomain ${username}.ipecity.eth for wallet ${walletAddress}`);

    const reserveResponse = await fetch(
      'https://api.justaname.id/ens/v1/subname/reserve',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.justaNameApiKey,
        },
        body: JSON.stringify({
          username,
          ensDomain: 'ipecity.eth',
          chainId: 1,
          ethAddress: walletAddress,
        }),
      },
    );

    const reserveResponseText = await reserveResponse.text();
    logger.info('JustaName reserve response:', { status: reserveResponse.status });

    if (!reserveResponse.ok) {
      let errorData: Record<string, unknown>;
      try {
        errorData = JSON.parse(reserveResponseText);
      } catch {
        errorData = { error: reserveResponseText };
      }

      // If subdomain already exists, treat as success
      const errorMsg = String((errorData.result as Record<string, unknown>)?.error ?? errorData.error ?? '');
      if (reserveResponse.status === 409 && errorMsg.includes('SubdomainAlreadyExistsException')) {
        logger.info(`Subdomain ${username}.ipecity.eth already exists - proceeding`);
        return;
      }

      throw new Error(
        `Failed to reserve subdomain: ${errorMsg || reserveResponse.statusText}`,
      );
    }

    logger.info(`Successfully reserved ${username}.ipecity.eth for ${walletAddress}`);
  }
}

// Re-export shared error classes for backward compatibility with route imports
export { ValidationError, NotFoundError } from '../lib/errors';
