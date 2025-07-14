import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import { getSecureEnvironmentVariable } from "./lib/keyManagement";

neonConfig.webSocketConstructor = ws;

// Database connection objects - populated after initialization
export let pool: NeonPool | PgPool;
export let db: ReturnType<typeof neonDrizzle> | ReturnType<typeof pgDrizzle>;

/**
 * Initialize database connection with secure configuration
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Get database URL from secure storage with fallback to environment variable
    const databaseUrl = await getSecureEnvironmentVariable('database_url', 'DATABASE_URL');
    
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL must be set in secure storage or environment variables. " +
        "Run 'npm run keys:migrate' to set up secure storage, or ensure DATABASE_URL is in your .env file."
      );
    }

    // Determine if this is a Neon database URL or local PostgreSQL
    const isNeonDatabase = databaseUrl.includes('neon.tech') || databaseUrl.includes('aws.neon.tech');
    
    if (isNeonDatabase) {
      // Use Neon serverless driver for cloud databases
      pool = new NeonPool({ connectionString: databaseUrl });
      db = neonDrizzle({ client: pool, schema });
      console.log('Database connection initialized successfully (Neon serverless)');
    } else {
      // Use standard PostgreSQL driver for local development
      pool = new PgPool({ connectionString: databaseUrl });
      db = pgDrizzle({ client: pool, schema });
      console.log('Database connection initialized successfully (PostgreSQL)');
    }

  } catch (error) {
    console.error('Failed to initialize database connection:', error);
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