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
 * Check if running in Replit environment
 */
function isReplitEnvironment(): boolean {
  return !!(
    process.env.REPL_ID || 
    process.env.REPL_SLUG || 
    process.env.REPLIT_DB_URL ||
    process.env.REPL_OWNER
  );
}

/**
 * Initialize database connection with secure configuration
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const isReplit = isReplitEnvironment();
    
    // Get database URL from secure storage with fallback to environment variable
    const databaseUrl = await getSecureEnvironmentVariable('database_url', 'DATABASE_URL');
    
    if (!databaseUrl) {
      const errorMessage = isReplit
        ? "DATABASE_URL must be set in Replit secrets."
        : "DATABASE_URL must be set in secure storage or environment variables. Run 'npm run keys:migrate' to set up secure storage, or ensure DATABASE_URL is in your .env file.";
      throw new Error(errorMessage);
    }

    logger.info('Initializing database connection', { 
      environment: process.env.NODE_ENV,
      isReplit,
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