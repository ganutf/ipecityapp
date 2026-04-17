import { storage } from '../storage';
import { getEnsSubdomainService } from '../lib/ensSubdomainService';
import logger from '../logger';

// Check interval: every hour
const CHECK_INTERVAL = 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Find active members whose membership has expired and revoke their passports.
 * Calls ENS Registry to reclaim the subdomain, then updates DB status to passport_revoked.
 */
async function runPassportExpiryCheck(): Promise<void> {
  if (isRunning) {
    logger.warn('Passport expiry check already in progress, skipping', {
      service: 'passportExpiryJob',
    });
    return;
  }

  try {
    isRunning = true;
    const startTime = Date.now();

    logger.info('Starting passport expiry check', {
      service: 'passportExpiryJob',
    });

    const expiredMembers = await storage.getExpiredActivePassports();

    if (expiredMembers.length === 0) {
      logger.info('Passport expiry check: no expired passports found', {
        service: 'passportExpiryJob',
      });
      return;
    }

    logger.info('Found expired passports to revoke', {
      service: 'passportExpiryJob',
      count: expiredMembers.length,
    });

    const ensService = getEnsSubdomainService();
    let revokedCount = 0;
    let failedCount = 0;

    for (const member of expiredMembers) {
      if (!member.ipeUsername) {
        logger.warn('Member has no ipeUsername, skipping revocation', {
          service: 'passportExpiryJob',
          memberId: member.id,
        });
        continue;
      }

      try {
        const txHash = await ensService.revokeSubdomain(member.ipeUsername);
        await storage.revokePassport(member.id);
        revokedCount++;

        logger.info('Passport revoked for expired member', {
          service: 'passportExpiryJob',
          memberId: member.id,
          ipeUsername: member.ipeUsername,
          txHash,
        });
      } catch (error) {
        failedCount++;
        logger.error('Failed to revoke passport for member', {
          service: 'passportExpiryJob',
          memberId: member.id,
          ipeUsername: member.ipeUsername,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue processing remaining members — don't abort the whole batch
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Passport expiry check completed', {
      service: 'passportExpiryJob',
      revokedCount,
      failedCount,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error('Passport expiry check job failed', {
      service: 'passportExpiryJob',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Start the passport expiry background job.
 * Runs immediately on startup, then every hour.
 */
export function startPassportExpiryJob(): void {
  if (intervalId) {
    logger.warn('Passport expiry job already running', {
      service: 'passportExpiryJob',
    });
    return;
  }

  logger.info('Starting passport expiry background job', {
    service: 'passportExpiryJob',
    interval: `${CHECK_INTERVAL / 1000}s`,
  });

  // Run immediately on startup
  runPassportExpiryCheck().catch((error) => {
    logger.error('Unhandled error in initial passport expiry check', {
      service: 'passportExpiryJob',
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // Then run on interval
  intervalId = setInterval(() => {
    runPassportExpiryCheck().catch((error) => {
      logger.error('Unhandled error in passport expiry check interval', {
        service: 'passportExpiryJob',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, CHECK_INTERVAL);

  logger.info('Passport expiry job started successfully', {
    service: 'passportExpiryJob',
  });
}

/**
 * Stop the passport expiry background job.
 */
export function stopPassportExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Passport expiry job stopped', {
      service: 'passportExpiryJob',
    });
  }
}

/**
 * Get the current status of the passport expiry job.
 */
export function getPassportExpiryJobStatus() {
  return {
    isActive: intervalId !== null,
    isRunning,
    checkInterval: CHECK_INTERVAL,
  };
}

// Exported for manual triggering in tests / admin scripts
export { runPassportExpiryCheck };
