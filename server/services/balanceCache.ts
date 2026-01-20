import NodeCache from 'node-cache';
import { ethers, Contract } from 'ethers';
import logger from '../logger';

// Constants
const IPE_TOKEN_ADDRESS = '0x5d48b042d4c479a5A9c25410fe0D66b742DC47dE';
const BASE_CHAIN_ID = 8453;
const CACHE_KEY = 'ipe_balances';
const CACHE_TTL = 600; // 10 minutes in seconds

// ERC20 ABI - minimal interface for balanceOf and decimals
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// Initialize cache with 10 minute TTL
const cache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Better performance, we don't mutate cached objects
});

// Initialize provider for Base network
// Using public RPC - can upgrade to Alchemy/Infura later if needed
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');

// Token contract instance
const tokenContract = new Contract(IPE_TOKEN_ADDRESS, ERC20_ABI, provider);

// Balance data structure
export interface BalanceData {
  address: string;
  balance: string; // Formatted balance (e.g., "1234.56")
  balanceRaw: string; // Raw balance as string (for sorting)
  decimals: number;
  lastUpdated: number; // Timestamp
}

export interface BalanceMap {
  [address: string]: BalanceData;
}

/**
 * Fetch IPE token balances for multiple addresses using multicall pattern
 */
export async function fetchBulkBalances(addresses: string[]): Promise<BalanceMap> {
  if (!addresses || addresses.length === 0) {
    logger.info('No addresses provided to fetchBulkBalances', { service: 'balanceCache' });
    return {};
  }

  try {
    logger.info('Fetching bulk IPE balances', {
      service: 'balanceCache',
      addressCount: addresses.length,
    });

    const startTime = Date.now();

    // Get decimals (only need to fetch once)
    const decimals = await tokenContract.decimals();
    logger.debug('Token decimals fetched', {
      service: 'balanceCache',
      decimals,
    });

    // Fetch balances sequentially to avoid RPC rate limits
    // Public RPC endpoints have strict batch limits (max 10 calls)
    const results: Array<{ address: string; balance: bigint; error: any }> = [];

    for (const address of addresses) {
      try {
        const balance = await tokenContract.balanceOf(address);
        results.push({ address, balance, error: null });
        logger.debug('Fetched balance for address', {
          service: 'balanceCache',
          address,
          balance: balance.toString(),
        });
      } catch (error) {
        logger.error('Failed to fetch balance for address', {
          service: 'balanceCache',
          address,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({ address, balance: BigInt(0), error });
      }
    }

    // Build balance map
    const balanceMap: BalanceMap = {};
    const timestamp = Date.now();

    for (const result of results) {
      const formattedBalance = ethers.formatUnits(result.balance, decimals);
      const displayBalance = parseFloat(formattedBalance).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      balanceMap[result.address.toLowerCase()] = {
        address: result.address,
        balance: displayBalance,
        balanceRaw: result.balance.toString(),
        decimals: Number(decimals),
        lastUpdated: timestamp,
      };
    }

    const duration = Date.now() - startTime;
    logger.info('Bulk balance fetch completed', {
      service: 'balanceCache',
      addressCount: addresses.length,
      successCount: Object.keys(balanceMap).length,
      duration: `${duration}ms`,
    });

    return balanceMap;
  } catch (error) {
    logger.error('Failed to fetch bulk balances', {
      service: 'balanceCache',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Update the balance cache with fresh data
 */
export async function updateBalanceCache(addresses: string[]): Promise<void> {
  try {
    logger.info('Updating balance cache', {
      service: 'balanceCache',
      addressCount: addresses.length,
    });

    const balances = await fetchBulkBalances(addresses);
    cache.set(CACHE_KEY, balances);

    logger.info('Balance cache updated successfully', {
      service: 'balanceCache',
      balanceCount: Object.keys(balances).length,
    });
  } catch (error) {
    logger.error('Failed to update balance cache', {
      service: 'balanceCache',
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - we want the background job to continue even if one update fails
  }
}

/**
 * Get cached balances, or fetch if not in cache
 */
export async function getCachedBalances(addresses: string[]): Promise<BalanceMap> {
  // Try to get from cache first
  const cached = cache.get<BalanceMap>(CACHE_KEY);

  if (cached) {
    logger.debug('Returning cached balances', {
      service: 'balanceCache',
      cachedAddressCount: Object.keys(cached).length,
      requestedAddressCount: addresses.length,
    });

    // Filter to only requested addresses
    const filtered: BalanceMap = {};
    for (const addr of addresses) {
      const lowerAddr = addr.toLowerCase();
      if (cached[lowerAddr]) {
        filtered[lowerAddr] = cached[lowerAddr];
      }
    }

    // If we have all requested addresses in cache, return immediately
    if (Object.keys(filtered).length === addresses.length) {
      return filtered;
    }

    logger.debug('Cache miss for some addresses, fetching missing balances', {
      service: 'balanceCache',
      cachedCount: Object.keys(filtered).length,
      requestedCount: addresses.length,
    });
  }

  // Cache miss or incomplete - fetch fresh data
  logger.info('Cache miss, fetching fresh balances', {
    service: 'balanceCache',
    addressCount: addresses.length,
  });

  const balances = await fetchBulkBalances(addresses);
  cache.set(CACHE_KEY, balances);

  return balances;
}

/**
 * Get balance for a single address
 */
export async function getCachedBalance(address: string): Promise<BalanceData | null> {
  const balances = await getCachedBalances([address]);
  return balances[address.toLowerCase()] || null;
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cache.del(CACHE_KEY);
  logger.info('Balance cache cleared', { service: 'balanceCache' });
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const keys = cache.keys();
  const stats = cache.getStats();

  return {
    hasCache: keys.includes(CACHE_KEY),
    stats,
    ttl: CACHE_TTL,
  };
}
