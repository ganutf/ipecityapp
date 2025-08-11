import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import { getSecureEnvironmentVariable } from "./lib/keyManagement";
import logger from "./logger";

neonConfig.webSocketConstructor = ws;

// Database connection objects - populated after initialization
export let pool: NeonPool | PgPool;
export let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

/**
 * Check if running in a production-like environment that should use direct environment variables
 */
function shouldUseDirectEnvironmentVariables(): boolean {
  return !!(
    // Replit environment
    process.env.REPL_ID || 
    process.env.REPL_SLUG || 
    process.env.REPLIT_DB_URL ||
    process.env.REPL_OWNER ||
    // Production environment
    process.env.NODE_ENV === 'production' ||
    // Common production platforms
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.AZURE_FUNCTIONS_ENVIRONMENT ||
    // Manual override for any platform
    process.env.USE_DIRECT_ENV_VARS === 'true'
  );
}

/**
 * Initialize database connection with secure configuration
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const useDirectEnvVars = shouldUseDirectEnvironmentVariables();
    
    // Get database URL from secure storage with fallback to environment variable
    const databaseUrl = await getSecureEnvironmentVariable('database_url', 'DATABASE_URL');
    
    if (!databaseUrl) {
      const errorMessage = useDirectEnvVars
        ? "DATABASE_URL must be set in production environment variables."
        : "DATABASE_URL must be set in secure storage or environment variables. Run 'npm run keys:migrate' to set up secure storage, or ensure DATABASE_URL is in your .env file.";
      throw new Error(errorMessage);
    }

    logger.info('Initializing database connection', { 
      environment: process.env.NODE_ENV,
      useDirectEnvVars,
      databaseType: databaseUrl.includes('neon.tech') ? 'neon' : 'postgresql'
    });

    // Determine if this is a Neon database URL or local PostgreSQL
    const isNeonDatabase = databaseUrl.includes('neon.tech') || databaseUrl.includes('aws.neon.tech');
    
    if (isNeonDatabase) {
      // Use Neon serverless driver for cloud databases
      pool = new NeonPool({ connectionString: databaseUrl });
      db = neonDrizzle({ client: pool, schema });
      logger.info('Database connection initialized successfully (Neon serverless)');
    } else {
      // Use standard PostgreSQL driver for local development
      pool = new PgPool({ connectionString: databaseUrl });
      db = pgDrizzle({ client: pool, schema });
      logger.info('Database connection initialized successfully (PostgreSQL)');
    }

  } catch (error) {
    logger.error('Failed to initialize database connection', { error: (error as Error)?.message || 'Unknown error' });
    throw error;
  }
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return pool !== undefined && db !== undefined;
}

/**
 * Get database connection (throws if not initialized)
 */
export function getDatabase() {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return { pool, db };
}