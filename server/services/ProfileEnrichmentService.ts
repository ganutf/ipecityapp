/**
 * ProfileEnrichmentService — fetches Farcaster profiles and IPE balances,
 * then merges them onto member objects.
 *
 * Consolidates duplicated enrichment logic from auth.routes.ts
 * (GET /auth/me, GET /community/members, GET /community/members/:memberId).
 */

import { neynar } from '../lib/neynarClient';
import logger from '../logger';

interface BalanceData {
  balance: string;
  balanceRaw: string;
}

interface FarcasterProfile {
  displayName?: string;
  username?: string;
  pfpUrl?: string;
  bio?: string;
}

/**
 * Fetch cached IPE balances for a list of wallet addresses.
 * Returns an address→balance map (addresses lowercased as keys).
 */
export async function fetchBalances(
  addresses: string[],
): Promise<Record<string, BalanceData>> {
  if (addresses.length === 0) return {};
  try {
    const { getCachedBalances } = await import('./balanceCache');
    return await getCachedBalances(addresses);
  } catch (err) {
    logger.warn('Failed to fetch cached balances', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/**
 * Fetch a single wallet's IPE balance.
 * Returns { balance, balanceRaw } or null on failure.
 */
export async function fetchBalance(
  walletAddress: string,
): Promise<BalanceData | null> {
  const map = await fetchBalances([walletAddress]);
  return map[walletAddress.toLowerCase()] ?? null;
}

/**
 * Fetch Farcaster profile data for a single FID.
 */
export async function fetchFarcasterProfile(
  fid: number,
): Promise<FarcasterProfile | null> {
  try {
    const userResponse = await neynar.fetchBulkUsers({ fids: [fid] });
    if (userResponse.users && userResponse.users.length > 0) {
      const user = userResponse.users[0] as {
        display_name?: string;
        username?: string;
        pfp_url?: string;
        profile?: { bio?: { text?: string } };
      };
      return {
        displayName: user.display_name,
        username: user.username,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text,
      };
    }
    return null;
  } catch (err) {
    logger.warn('Failed to fetch Farcaster profile', {
      fid,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Fetch Farcaster profiles for multiple FIDs in a single batch.
 * Returns a Map<fid, FarcasterProfile>.
 */
export async function fetchBulkFarcasterProfiles(
  fids: number[],
): Promise<Map<number, FarcasterProfile>> {
  const profileMap = new Map<number, FarcasterProfile>();
  if (fids.length === 0) return profileMap;

  try {
    const userResponse = await neynar.fetchBulkUsers({ fids });
    if (userResponse.users) {
      for (const user of userResponse.users as Array<{
        fid: number;
        display_name?: string;
        username?: string;
        pfp_url?: string;
        profile?: { bio?: { text?: string } };
      }>) {
        profileMap.set(user.fid, {
          displayName: user.display_name,
          username: user.username,
          pfpUrl: user.pfp_url,
          bio: user.profile?.bio?.text,
        });
      }
    }
  } catch (err) {
    logger.warn('Failed to fetch Farcaster profiles', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return profileMap;
}

/** Minimal member shape needed for enrichment. */
interface EnrichableMember {
  id: number;
  farcasterFid?: number | null;
  walletAddress?: string | null;
  ipeUsername?: string | null;
  bio?: string | null;
  [key: string]: unknown;
}

/**
 * Enrich a list of members with Farcaster profiles and IPE balances.
 * Used by GET /community/members.
 */
export async function enrichBulkMembers<T extends EnrichableMember>(
  members: T[],
): Promise<Array<T & { displayName: string; username?: string | null; pfpUrl?: string; ipeBalance: string; ipeBalanceRaw: string }>> {
  // Fetch balances
  const addresses = members
    .map(m => m.walletAddress)
    .filter((addr): addr is string => Boolean(addr));
  const balanceMap = await fetchBalances(addresses);

  // Fetch Farcaster profiles
  const fids = members
    .filter(m => m.farcasterFid && m.farcasterFid > 0)
    .map(m => m.farcasterFid!);
  const profileMap = await fetchBulkFarcasterProfiles(fids);

  return members.map(member => {
    const profile = member.farcasterFid ? profileMap.get(member.farcasterFid) : undefined;
    const balance = member.walletAddress ? balanceMap[member.walletAddress.toLowerCase()] : undefined;

    return {
      ...member,
      displayName: profile?.displayName || member.ipeUsername || `Member ${member.id}`,
      username: profile?.username || member.ipeUsername,
      pfpUrl: profile?.pfpUrl,
      bio: profile?.bio || member.bio,
      ipeBalance: balance?.balance || '0',
      ipeBalanceRaw: balance?.balanceRaw || '0',
    };
  });
}

/**
 * Enrich a single member with Farcaster profile and IPE balance.
 * Used by GET /community/members/:memberId.
 */
export async function enrichSingleMember<T extends EnrichableMember>(
  member: T,
  stats: { totalPoints: number; pulseStreak: number },
): Promise<T & { totalPoints: number; pulseStreak: number; displayName: string; username?: string | null; pfpUrl?: string; ipeBalance: string; ipeBalanceRaw: string }> {
  const profile = member.farcasterFid && member.farcasterFid > 0
    ? await fetchFarcasterProfile(member.farcasterFid)
    : null;

  const balance = member.walletAddress
    ? await fetchBalance(member.walletAddress)
    : null;

  return {
    ...member,
    ...stats,
    displayName: profile?.displayName || member.ipeUsername || `Member ${member.id}`,
    username: profile?.username || member.ipeUsername,
    pfpUrl: profile?.pfpUrl,
    bio: profile?.bio || member.bio,
    ipeBalance: balance?.balance || '0',
    ipeBalanceRaw: balance?.balanceRaw || '0',
  };
}
