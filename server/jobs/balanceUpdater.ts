import { updateBalanceCache } from '../services/balanceCache';
import { storage } from '../storage';
import logger from '../logger';

// Update interval: 10 minutes (in milliseconds)
const UPDATE_INTERVAL = 10 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Fetch all member wallet addresses and update the balance cache
 */
async function runBalanceUpdate(): Promise<void> {
  if (isRunning) {
    logger.warn('Balance update already in progress, skipping', {
      service: 'balanceUpdater',
    });
    return;
  }

  try {
    isRunning = true;
    logger.info('Starting balance update job', {
      service: 'balanceUpdater',
    });

    const startTime = Date.now();

    // Get all active members with wallet addresses
    const members = await storage.getActiveMembersWithStats();

    // Filter out members without wallet addresses
    const addresses = members
      .map((m) => m.walletAddress)
      .filter((addr): addr is string => Boolean(addr));

    if (addresses.length === 0) {
      logger.info('No wallet addresses found, skipping balance update', {
        service: 'balanceUpdater',
      });
      return;
    }

    logger.info('Fetched member addresses for balance update', {
      service: 'balanceUpdater',
      totalMembers: members.length,
      addressCount: addresses.length,
    });

    // Update the cache
    await updateBalanceCache(addresses);

    const duration = Date.now() - startTime;
    logger.info('Balance update job completed', {
      service: 'balanceUpdater',
      duration: `${duration}ms`,
      addressCount: addresses.length,
    });
  } catch (error) {
    logger.error('Balance update job failed', {
      service: 'balanceUpdater',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the balance updater background job
 */
export async function startBalanceUpdater(): Promise<void> {
  if (intervalId) {
    logger.warn('Balance updater already running', {
      service: 'balanceUpdater',
    });
    return;
  }

  logger.info('Starting balance updater background job', {
    service: 'balanceUpdater',
    interval: `${UPDATE_INTERVAL / 1000}s`,
  });

  // Run immediately on startup
  await runBalanceUpdate();

  // Then run on interval
  intervalId = setInterval(() => {
    runBalanceUpdate().catch((error) => {
      logger.error('Unhandled error in balance update interval', {
        service: 'balanceUpdater',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, UPDATE_INTERVAL);

  logger.info('Balance updater started successfully', {
    service: 'balanceUpdater',
  });
}

/**
 * Stop the balance updater background job
 */
export function stopBalanceUpdater(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Balance updater stopped', {
      service: 'balanceUpdater',
    });
  }
}

/**
 * Get the status of the balance updater
 */
export function getBalanceUpdaterStatus() {
  return {
    isActive: intervalId !== null,
    isRunning,
    updateInterval: UPDATE_INTERVAL,
  };
}
