/**
 * Root admin sync.
 *
 * Policy: whoever owns ipecity.eth in the ENS NameWrapper is admin. This
 * bootstraps the first admin without any hardcoded config — that person
 * just needs to log in with the wallet that owns the parent domain.
 *
 * Semantics are promote-only:
 *   - If member.walletAddress matches the on-chain owner AND memberType !== 'admin',
 *     promote to 'admin'.
 *   - Never demote. Once admin, always admin until an admin manually revokes.
 *     This keeps manually-promoted admins untouched and avoids accidental
 *     lockouts (e.g. if the RPC is flaky and returns a stale/zero owner).
 *
 * The on-chain read is cached for 5 minutes so we don't hit mainnet on
 * every /auth/me call. Cache is process-local; acceptable drift is low
 * because parent-domain ownership changes very rarely.
 */

import { getEnsSubdomainService } from './ensSubdomainService';
import type { IStorage } from '../storage';
import type { Member } from '@shared/schema';
import logger from '../logger';

const CACHE_TTL_MS = 5 * 60 * 1000;
const RPC_TIMEOUT_MS = 3000;
const NEGATIVE_CACHE_TTL_MS = 60 * 1000;

let cachedOwner: string | null = null;
let cachedAt = 0;
let lastFailureAt = 0;

/**
 * Get the on-chain owner of ipecity.eth, with an in-memory TTL cache.
 * Returns null on RPC failure (caller should treat as "can't verify now").
 * Hard-bounded by RPC_TIMEOUT_MS so a slow/hung RPC can't block login.
 * A brief negative cache suppresses repeat calls after a failure.
 */
async function getCachedParentOwner(): Promise<string | null> {
  const now = Date.now();
  if (cachedOwner && now - cachedAt < CACHE_TTL_MS) {
    return cachedOwner;
  }
  if (now - lastFailureAt < NEGATIVE_CACHE_TTL_MS) {
    return null;
  }
  try {
    const ens = getEnsSubdomainService();
    const owner = await Promise.race<string>([
      ens.getParentOwner(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`RPC timeout after ${RPC_TIMEOUT_MS}ms`)), RPC_TIMEOUT_MS),
      ),
    ]);
    cachedOwner = owner.toLowerCase();
    cachedAt = now;
    return cachedOwner;
  } catch (err) {
    lastFailureAt = now;
    logger.warn('Root admin check: failed to read ipecity.eth owner on-chain', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Promote the member to admin iff their wallet owns ipecity.eth on-chain.
 * Never demotes. Safe to call on every /auth/me — failures are swallowed.
 *
 * Returns the (possibly) updated member.
 */
export async function syncRootAdminIfNeeded(
  storage: IStorage,
  member: Member,
): Promise<Member> {
  if (!member.walletAddress) return member;
  if (member.memberType === 'admin') return member;

  const owner = await getCachedParentOwner();
  if (!owner) return member;

  if (member.walletAddress.toLowerCase() !== owner) return member;

  const updated = await storage.updateMember(member.id, {
    memberType: 'admin',
  });
  logger.info('Root admin auto-promotion: ipecity.eth owner detected', {
    memberId: member.id,
    wallet: member.walletAddress,
  });
  return updated;
}
