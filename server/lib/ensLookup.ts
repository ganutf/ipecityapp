/**
 * ENS Lookup
 *
 * Since IpêCity now controls all *.ipecity.eth subdomains directly via the ENS Registry,
 * the database is the authoritative source for ipecity.eth subdomain → member mappings.
 *
 * Lookup strategy:
 *   1. Check DB for ipecity.eth subdomain linked to this wallet (fast, authoritative)
 *   2. Fallback: viem reverse ENS resolution for any other ENS name the wallet may have
 */

import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { storage } from '../storage';
import logger from '../logger';

interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
  source: 'database' | 'onchain' | null;
  error: string | null;
}

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export async function lookupEnsName(address: string): Promise<EnsLookupResult> {
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      ensName: null,
      ensNames: [],
      source: null,
      error: 'Invalid wallet address format',
    };
  }

  try {
    // 1. Check DB — we now own all *.ipecity.eth subdomains, so DB is authoritative
    const member = await storage.getMemberByWalletAddress(address.toLowerCase());
    if (member?.ipePassport) {
      return {
        ensName: member.ipePassport,
        ensNames: [member.ipePassport],
        source: 'database',
        error: null,
      };
    }

    // Also check member_wallets table in case this is a linked wallet (not the passport wallet)
    const walletRecord = await storage.getMemberWalletByAddress(address.toLowerCase());
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

    // 2. Fallback: viem reverse ENS resolution (for wallets with other ENS names)
    try {
      const ensName = await publicClient.getEnsName({ address: address as Address });
      if (ensName) {
        return {
          ensName,
          ensNames: [ensName],
          source: 'onchain',
          error: null,
        };
      }
    } catch (ensError) {
      logger.warn(`ENS reverse lookup failed for ${address}`, {
        error: ensError instanceof Error ? ensError.message : String(ensError),
      });
    }

    return {
      ensName: null,
      ensNames: [],
      source: null,
      error: null,
    };
  } catch (error) {
    logger.error('ENS lookup error', {
      address,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ensName: null,
      ensNames: [],
      source: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
