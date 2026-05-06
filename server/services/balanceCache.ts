import NodeCache from 'node-cache';
import { ethers, Contract } from 'ethers';
import logger from '../logger';

/**
 * Balance Cache Service for IPE Token on Base Network
 *
 * IMPORTANT: For production, set BASE_MAINNET_RPC_URL environment variable to use a dedicated RPC provider.
 * Public RPC endpoints are rate-limited and not suitable for production use.
 *
 * Recommended providers:
 * - Coinbase Developer Platform (CDP): https://portal.cdp.coinbase.com/ (FREE)
 * - Alchemy: https://www.alchemy.com/ (FREE tier available)
 *
 * Example environment variable:
 * BASE_MAINNET_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR-API-KEY
 * or
 * BASE_MAINNET_RPC_URL=https://api.developer.coinbase.com/rpc/v1/base/YOUR-API-KEY
 */

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

// Multiple RPC endpoints for fallback
// If BASE_MAINNET_RPC_URL env var is set (e.g., Alchemy, CDP), use it as primary
// Otherwise fall back to public endpoints
const RPC_ENDPOINTS = process.env.BASE_MAINNET_RPC_URL
  ? [
      process.env.BASE_MAINNET_RPC_URL, // Primary: Your configured RPC (Alchemy, CDP, etc.)
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base-rpc.publicnode.com',
      'https://base.gateway.tenderly.co',
    ]
  : [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base-rpc.publicnode.com',
      'https://base.gateway.tenderly.co',
    ];

let currentRpcIndex = 0;

// Initialize provider with fallback support
function createProvider(): ethers.JsonRpcProvider {
  const rpcUrl = RPC_ENDPOINTS[currentRpcIndex];
  const isCustomRpc = currentRpcIndex === 0 && process.env.BASE_MAINNET_RPC_URL;

  logger.info('Creating provider', {
    service: 'balanceCache',
    rpcUrl: isCustomRpc ? 'Custom RPC (from BASE_MAINNET_RPC_URL env)' : rpcUrl,
    index: currentRpcIndex,
    type: isCustomRpc ? 'production' : 'public',
  });

  return new ethers.JsonRpcProvider(rpcUrl, BASE_CHAIN_ID, {
    staticNetwork: true, // Optimization for faster calls
  });
}

let provider = createProvider();
let tokenContract = new Contract(IPE_TOKEN_ADDRESS, ERC20_ABI, provider);

// Log RPC configuration on module load
if (process.env.BASE_MAINNET_RPC_URL) {
  logger.info('Balance cache using custom RPC endpoint from BASE_MAINNET_RPC_URL', {
    service: 'balanceCache',
    fallbackCount: RPC_ENDPOINTS.length - 1,
  });
} else {
  logger.warn('Balance cache using public RPC endpoints (not recommended for production)', {
    service: 'balanceCache',
    recommendation: 'Set BASE_MAINNET_RPC_URL environment variable for production use',
    endpoints: RPC_ENDPOINTS,
  });
}

// Switch to next RPC endpoint on failure
function switchRpcEndpoint() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  logger.warn('Switching RPC endpoint', {
    service: 'balanceCache',
    newRpcUrl: RPC_ENDPOINTS[currentRpcIndex],
    index: currentRpcIndex,
  });
  provider = createProvider();
  tokenContract = new Contract(IPE_TOKEN_ADDRESS, ERC20_ABI, provider);
}

// Delay helper for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Get decimals (only need to fetch once) with retry logic
    let decimals!: number;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        decimals = await tokenContract.decimals();
        logger.debug('Token decimals fetched', {
          service: 'balanceCache',
          decimals,
          attempt,
        });
        break;
      } catch (error) {
        logger.warn('Failed to fetch token decimals', {
          service: 'balanceCache',
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === 3) {
          throw new Error('Failed to fetch token decimals after 3 attempts');
        }

        if (attempt < 3) {
          switchRpcEndpoint();
          await delay(1000);
        }
      }
    }

    // Fetch balances sequentially with retry logic and delays
    // Public RPC endpoints have strict rate limits
    const results: Array<{ address: string; balance: bigint; error: any }> = [];
    let consecutiveFailures = 0;

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      let balance: bigint | null = null;
      let lastError: any = null;

      // Retry up to 3 times with exponential backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          balance = await tokenContract.balanceOf(address);
          consecutiveFailures = 0; // Reset on success
          logger.debug('Fetched balance for address', {
            service: 'balanceCache',
            address,
            balance: balance!.toString(),
            attempt,
          });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          consecutiveFailures++;

          logger.warn('Failed to fetch balance (will retry)', {
            service: 'balanceCache',
            address,
            attempt,
            error: error instanceof Error ? error.message : String(error),
          });

          // If we've had many consecutive failures, switch RPC endpoint
          if (consecutiveFailures >= 3 && attempt < 3) {
            switchRpcEndpoint();
            await delay(1000); // Wait 1s after switching
          } else if (attempt < 3) {
            // Exponential backoff: 500ms, 1000ms
            await delay(500 * attempt);
          }
        }
      }

      if (balance !== null) {
        results.push({ address, balance, error: null });
      } else {
        logger.error('Failed to fetch balance after retries', {
          service: 'balanceCache',
          address,
          error: lastError instanceof Error ? lastError.message : String(lastError),
        });
        results.push({ address, balance: BigInt(0), error: lastError });
      }

      // Add delay between requests to avoid rate limiting (100ms)
      if (i < addresses.length - 1) {
        await delay(100);
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
