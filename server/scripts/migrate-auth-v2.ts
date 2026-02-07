/**
 * Auth V2 Migration Script
 *
 * Creates the new Auth V2 tables and modifies existing tables.
 * Uses psql directly to bypass drizzle-kit driver detection issues.
 *
 * Usage: npx tsx server/scripts/migrate-auth-v2.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

const execAsync = promisify(exec);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

// SQL migration for Auth V2 tables
const migrationSQL = `
-- ============================================
-- AUTH V2 MIGRATION
-- Run with: psql $DATABASE_URL -f migration.sql
-- ============================================

-- 1. Create auth_users table (primary authentication)
CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- 2. Create passkeys table (WebAuthn credentials)
CREATE TABLE IF NOT EXISTS passkeys (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES auth_users(id),
  credential_id VARCHAR(512) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  sign_count INTEGER DEFAULT 0,
  transports TEXT[],
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

-- 3. Create smart_wallets table (auto-created wallets)
CREATE TABLE IF NOT EXISTS smart_wallets (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES auth_users(id),
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  wallet_type VARCHAR(20) NOT NULL,
  chain_id INTEGER DEFAULT 8453,
  passkey_id INTEGER REFERENCES passkeys(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create farcaster_accounts table (optional Farcaster connection)
CREATE TABLE IF NOT EXISTS farcaster_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES auth_users(id),
  farcaster_fid INTEGER NOT NULL UNIQUE,
  username VARCHAR(255),
  custody_address VARCHAR(42),
  imported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Add user_id column to members table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE members ADD COLUMN user_id VARCHAR(36) REFERENCES auth_users(id);
  END IF;
END $$;

-- 6. Make farcaster_fid nullable on members (if it's currently NOT NULL)
-- First check if it's NOT NULL, then alter
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'members'
    AND column_name = 'farcaster_fid'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE members ALTER COLUMN farcaster_fid DROP NOT NULL;
  END IF;
END $$;

-- 7. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_wallets_user_id ON smart_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_farcaster_accounts_user_id ON farcaster_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);

-- 8. Add missing constraints to pulse_executions (if needed)
DO $$
BEGIN
  -- Add unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pulse_executions_unique_member_pulse'
  ) THEN
    ALTER TABLE pulse_executions
    ADD CONSTRAINT pulse_executions_unique_member_pulse
    UNIQUE (pulse_id, member_id);
  END IF;
END $$;

-- Done!
SELECT 'Auth V2 migration completed successfully!' as status;
`;

async function runMigration() {
  console.log('Starting Auth V2 migration...');
  console.log('Database URL:', DATABASE_URL?.substring(0, 30) + '...');

  try {
    // Write SQL to temp file and execute with psql
    const fs = await import('fs');
    const tempFile = '/tmp/auth-v2-migration.sql';
    fs.writeFileSync(tempFile, migrationSQL);

    console.log('Running migration with psql...');

    const { stdout, stderr } = await execAsync(`psql "${DATABASE_URL}" -f ${tempFile}`);

    if (stderr && !stderr.includes('NOTICE')) {
      console.error('Migration warnings/errors:', stderr);
    }

    console.log('Migration output:', stdout);
    console.log('\n✅ Auth V2 migration completed!');

    // Clean up temp file
    fs.unlinkSync(tempFile);

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    if (error.stderr) {
      console.error('psql error:', error.stderr);
    }
    process.exit(1);
  }
}

runMigration();
