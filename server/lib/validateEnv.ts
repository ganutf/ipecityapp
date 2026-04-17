import logger from "../logger";

interface EnvVarConfig {
  name: string;
  required: boolean;
  sensitive?: boolean;
}

const envVars: EnvVarConfig[] = [
  // Database
  { name: 'DATABASE_URL', required: true, sensitive: true },

  // Authentication
  { name: 'PRIVY_APP_ID', required: true },
  { name: 'PRIVY_APP_SECRET', required: true, sensitive: true },
  { name: 'SESSION_SECRET', required: true, sensitive: true },

  // Farcaster / Neynar
  { name: 'NEYNAR_API_KEY', required: true, sensitive: true },
  { name: 'FARCASTER_DEVELOPER_MNEMONIC', required: true, sensitive: true },

  // EAS Attestations
  { name: 'EAS_ATTESTATION_MNEMONIC', required: true, sensitive: true },

  // ENS Subdomain Management (ipecity.eth controller wallet)
  { name: 'ENS_ADMIN_MNEMONIC', required: true, sensitive: true },

  // Optional services
  { name: 'RESEND_API_KEY', required: false, sensitive: true },
  { name: 'EMAIL_TEST_MODE', required: false },
];

/**
 * Validates that required environment variables are set.
 * Logs warnings for optional missing vars.
 * Throws if any required var is missing.
 */
export function validateEnvironment(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const { name, required, sensitive } of envVars) {
    const value = process.env[name];
    if (!value) {
      if (required) {
        missing.push(name);
      } else {
        warnings.push(name);
      }
    } else if (!sensitive) {
      logger.info(`Environment: ${name} = ${value}`);
    } else {
      logger.info(`Environment: ${name} = [set]`);
    }
  }

  if (warnings.length > 0) {
    logger.warn(`Optional environment variables not set: ${warnings.join(', ')}`);
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info('Environment validation passed');
}
