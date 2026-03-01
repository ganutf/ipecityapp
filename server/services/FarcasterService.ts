/**
 * FarcasterService - signer state machine + cast/reaction operations
 * Extracted from server/routes.ts (lines ~135-597)
 */

import type { IStorage } from '../storage';
import { getSignedKey } from '../lib/getSignedKey';
import { HtmlSanitizer, IdentifierSanitizer } from '../lib/sanitizer';
import {
  NotFoundError,
  RateLimitError,
  isNotFoundError as isNeynarNotFound,
  isRateLimitError as isNeynarRateLimit,
  getRetryAfter,
} from '../lib/errors';
import logger from '../logger';

type CastParam = 'hash' | 'url';

interface SignerResponse {
  signer_uuid: string;
  status: string;
  signer_approval_url: string | null;
  message: string;
}

interface SignerCheckResponse {
  status: string;
  updated: boolean;
  signer_uuid: string;
  note?: string;
}

export class FarcasterService {
  constructor(
    private storage: IStorage,
    private neynarApiKey: string,
  ) {}

  private async getNeynar() {
    const { neynar } = await import('../lib/neynarClient');
    return neynar;
  }

  /**
   * Get or create a sponsored Farcaster signer for a member.
   * Accepts memberId — resolves FID internally.
   */
  async getOrCreateSigner(memberId: number): Promise<SignerResponse> {
    const neynar = await this.getNeynar();

    const member = await this.storage.getMember(memberId);
    if (!member) {
      throw new SignerNotFoundError('Member not found');
    }

    const fid = member.farcasterFid;
    if (!fid) {
      throw new SignerNotFoundError('Member has no Farcaster FID');
    }

    logger.info(`Signer lookup for member ${memberId} (FID ${fid})`);

    // Check for existing signer
    let userSigner = await this.storage.getUserSigner(memberId);

    if (userSigner) {
      // Pending signer — check with Neynar for real-time status
      if (userSigner.status === 'pending_approval') {
        try {
          const signerStatus = await neynar.lookupSigner({
            signerUuid: userSigner.signerUuid,
          });

          if (signerStatus.status === 'approved') {
            await this.storage.updateUserSignerStatus(memberId, 'approved');
            logger.info(`Signer approved for member ${memberId}`);

            // Promote member from legacy status if needed
            if (member.status === 'pending_signer' || member.status === 'pending_id_verification') {
              await this.storage.updateMemberStatus(memberId, 'pending_id_verification');
            }

            return {
              signer_uuid: userSigner.signerUuid,
              status: 'approved',
              signer_approval_url: userSigner.approvalUrl ?? null,
              message: 'Signer approved successfully',
            };
          }
        } catch (statusError) {
          // Handle 404 — stale signer
          if (isNeynarNotFound(statusError)) {
            logger.info(`Stale signer for member ${memberId} — cleaning up`);
            await this.storage.deleteUserSigner(memberId);

            throw new StaleSignerError(
              'Your previous signer was invalid and has been cleaned up. Please refresh the page to get a new signer.',
            );
          }

          // Handle rate limiting
          if (isNeynarRateLimit(statusError)) {
            const retryAfter = getRetryAfter(statusError);
            throw new RateLimitError(
              `Too many requests to Neynar API. Please wait ${retryAfter} seconds before trying again.`,
              retryAfter,
            );
          }

          // Other errors — fall through to return cached status
        }
      }

      // Return existing signer (approved or still pending)
      return {
        signer_uuid: userSigner.signerUuid,
        status: userSigner.status ?? 'unknown',
        signer_approval_url: userSigner.approvalUrl ?? null,
        message:
          userSigner.status === 'approved'
            ? 'Existing approved signer found'
            : 'Existing signer requires approval',
      };
    }

    // No signer exists — create one
    logger.info(`Creating new sponsored signer for member ${memberId} (FID ${fid})`);

    try {
      const signerData = await getSignedKey(true); // sponsored = true

      const newSigner = await this.storage.createUserSigner({
        memberId,
        farcasterFid: fid,
        signerUuid: signerData.signer_uuid,
        publicKey: signerData.public_key || '',
        status:
          signerData.signedKey?.status || signerData.status || 'pending_approval',
        approvalUrl:
          signerData.signedKey?.signer_approval_url ||
          signerData.deep_link_url ||
          `https://client.farcaster.xyz/deeplinks/signed-key-request?token=${signerData.public_key}`,
      });

      logger.info(`Signer created for member ${memberId}`, {
        signerUuid: newSigner.signerUuid,
        status: newSigner.status,
      });

      return {
        signer_uuid: newSigner.signerUuid,
        status: newSigner.status ?? 'pending_approval',
        signer_approval_url: newSigner.approvalUrl ?? null,
        message: 'Sponsored signer created and registered - approval required via QR code or mobile app',
      };
    } catch (signerError) {
      if (isNeynarRateLimit(signerError)) {
        const retryAfter = getRetryAfter(signerError);
        throw new RateLimitError(
          `Too many signer creation requests. Please wait ${retryAfter} seconds before trying again.`,
          retryAfter,
        );
      }
      throw signerError;
    }
  }

  /**
   * Check signer status and update if changed.
   * Accepts memberId — resolves FID internally.
   */
  async checkSignerStatus(memberId: number): Promise<SignerCheckResponse> {
    const neynar = await this.getNeynar();

    const userSigner = await this.storage.getUserSigner(memberId);
    if (!userSigner) {
      throw new SignerNotFoundError('Signer not found');
    }

    try {
      const signerInfo = await neynar.lookupSigner({
        signerUuid: userSigner.signerUuid,
      });

      if (signerInfo.status !== userSigner.status) {
        await this.storage.updateUserSignerStatus(memberId, signerInfo.status);
        return {
          status: signerInfo.status,
          updated: true,
          signer_uuid: userSigner.signerUuid,
        };
      }

      return {
        status: userSigner.status ?? 'unknown',
        updated: false,
        signer_uuid: userSigner.signerUuid,
      };
    } catch (neynarError) {
      logger.info('Neynar lookup error during signer check:', neynarError);
      return {
        status: userSigner.status ?? 'unknown',
        updated: false,
        signer_uuid: userSigner.signerUuid,
        note: 'Could not verify with Neynar',
      };
    }
  }

  async publishReaction(
    signerUuid: string,
    reactionType: 'like' | 'recast',
    target: string,
  ) {
    const neynar = await this.getNeynar();
    const sanitizedTarget = HtmlSanitizer.sanitizeText(target, 100);

    return neynar.publishReaction({
      signerUuid,
      reactionType,
      target: sanitizedTarget,
    });
  }

  async publishCast(signerUuid: string, text: string = '', embeds?: unknown[]) {
    const neynar = await this.getNeynar();
    const sanitizedText = text ? HtmlSanitizer.sanitizeText(text, 320) : '';

    return neynar.publishCast({
      signerUuid,
      text: sanitizedText,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embeds: embeds as any,
    });
  }

  async checkQuoteRecast(hash: string, viewerFid: number): Promise<boolean> {
    const r = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/quotes` +
        `?identifier=${encodeURIComponent(hash)}&type=hash&limit=100`,
      {
        headers: {
          'x-api-key': this.neynarApiKey,
        },
      },
    );
    const data = await r.json();
    if (!r.ok) throw new Error(`Neynar API error: ${r.status}`);

    return (
      data.casts?.some((c: { author?: { fid?: number } }) => c.author?.fid === viewerFid) ?? false
    );
  }

  async lookupCast(
    identifier: string,
    viewerFid: number,
    type: CastParam = 'url',
  ) {
    const neynar = await this.getNeynar();

    if (!identifier || !viewerFid) {
      throw new Error('Missing required parameters: identifier and viewerFid');
    }
    if (isNaN(viewerFid) || viewerFid <= 0) {
      throw new Error('viewerFid must be a positive number');
    }

    const decodedIdentifier = decodeURIComponent(identifier);
    return neynar.lookupCastByHashOrWarpcastUrl({
      identifier: decodedIdentifier,
      type,
      viewerFid,
    });
  }
}

export class SignerNotFoundError extends NotFoundError {
  constructor(message: string) {
    super(message);
    this.name = 'SignerNotFoundError';
  }
}

export class StaleSignerError extends NotFoundError {
  constructor(message: string) {
    super(message);
    this.name = 'StaleSignerError';
  }
}

// Re-export shared RateLimitError for backward compatibility with route imports
export { RateLimitError } from '../lib/errors';
