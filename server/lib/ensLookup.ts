/**
 * ENS Lookup — determines the `*.ipecity.eth` passport(s) a wallet owns.
 *
 * Strategy:
 *   1. DB pre-check — if this wallet is already linked to a member with an
 *      `ipePassport`, return that (authoritative, no remote call).
 *   2. ENS subgraph — enumerate every `*.ipecity.eth` the wallet currently
 *      owns (including the `ipecity.eth` root) via TheGraph. Required because
 *      ENS NFTs aren't enumerable on-chain and reverse resolution returns
 *      only the wallet's primary name.
 *
 * Returns an empty list on subgraph failure; callers treat that as "no
 * passport detected" and route users to the application flow.
 */

import { storage } from '../storage';
import { fetchIpecitySubdomainsOwnedBy } from './ensSubgraph';

interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
  source: 'database' | 'subgraph' | null;
  error: string | null;
}

export async function lookupEnsName(address: string): Promise<EnsLookupResult> {
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      ensName: null,
      ensNames: [],
      source: null,
      error: 'Invalid wallet address format',
    };
  }

  const normalized = address.toLowerCase();

  // 1. DB pre-check. If this wallet is already linked to a member with a
  //    passport, that record is authoritative — skip the remote call.
  const member = await storage.getMemberByWalletAddress(normalized);
  if (member?.ipePassport) {
    return {
      ensName: member.ipePassport,
      ensNames: [member.ipePassport],
      source: 'database',
      error: null,
    };
  }

  const walletRecord = await storage.getMemberWalletByAddress(normalized);
  if (walletRecord) {
    const memberByWallet = await storage.getMember(walletRecord.memberId);
    if (memberByWallet?.ipePassport) {
      return {
        ensName: memberByWallet.ipePassport,
        ensNames: [memberByWallet.ipePassport],
        source: 'database',
        error: null,
      };
    }
  }

  // 2. Subgraph enumeration for new users. Handles the common case where a
  //    wallet owns an *.ipecity.eth that isn't in our DB yet (e.g. transferred
  //    between wallets), and correctly includes the `ipecity.eth` root for
  //    the admin wallet.
  const names = await fetchIpecitySubdomainsOwnedBy(normalized);

  return {
    ensName: names[0] ?? null,
    ensNames: names,
    source: names.length > 0 ? 'subgraph' : null,
    error: null,
  };
}
