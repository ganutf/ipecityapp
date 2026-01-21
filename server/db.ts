import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import logger from "./logger";

neonConfig.webSocketConstructor = ws;

// Database connection objects - populated after initialization
export let pool: NeonPool | PgPool;
export let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Get database URL directly from environment variable
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set in environment variables (.env file)");
    }

    logger.info('Initializing database connection', {
      environment: process.env.NODE_ENV,
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