#!/usr/bin/env tsx

/**
 * Database Migration Script: Pulse Structure Update
 * 
 * This script migrates the existing pulse structure to the new format:
 * 1. Creates pulse_types table with initial data
 * 2. Migrates pulses table structure
 * 3. Migrates pulse_executions table structure
 * 4. Transforms existing data to new format
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { storage } from "../storage";

interface LegacyPulse {
  id: number;
  farcaster_url: string;
  date: string;
  description: string;
  points: number;
  created_by: string;
  created_at: Date;
}

interface LegacyPulseExecution {
  id: number;
  pulse_id: number;
  member_id: number;
  action_type: string;
  executed_at: Date;
}

async function runMigration() {
  console.log("🚀 Starting pulse structure migration...");

  try {
    // Step 1: Create pulse_types table
    console.log("📋 Step 1: Creating pulse_types table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pulse_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert initial pulse type
    await db.execute(sql`
      INSERT INTO pulse_types (id, name, description)
      VALUES (1, 'Farcaster Post Engagement', 'Liking or sharing a post')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log("✅ pulse_types table created with initial data");

    // Step 2: Backup existing pulses data
    console.log("📋 Step 2: Backing up existing pulse data...");
    const existingPulses = await db.execute(sql`
      SELECT id, farcaster_url, date, description, points, created_by, created_at
      FROM pulses
    `);

    console.log(`📦 Found ${existingPulses.rows.length} existing pulses to migrate`);

    // Step 3: Backup existing pulse_executions data
    console.log("📋 Step 3: Backing up existing pulse_executions data...");
    const existingExecutions = await db.execute(sql`
      SELECT id, pulse_id, member_id, action_type, executed_at
      FROM pulse_executions
    `);

    console.log(`📦 Found ${existingExecutions.rows.length} existing executions to migrate`);

    // Step 4: Drop foreign key constraints temporarily
    console.log("📋 Step 4: Dropping foreign key constraints...");
    await db.execute(sql`
      ALTER TABLE pulse_executions DROP CONSTRAINT IF EXISTS pulse_executions_pulse_id_fkey
    `);
    await db.execute(sql`
      ALTER TABLE attestations DROP CONSTRAINT IF EXISTS attestations_pulse_execution_id_fkey
    `);

    // Step 5: Alter pulses table structure
    console.log("📋 Step 5: Altering pulses table structure...");
    
    // Add new columns
    await db.execute(sql`
      ALTER TABLE pulses 
      ADD COLUMN IF NOT EXISTS url_embed TEXT,
      ADD COLUMN IF NOT EXISTS datetime_start TIMESTAMP,
      ADD COLUMN IF NOT EXISTS interval INTEGER DEFAULT 24,
      ADD COLUMN IF NOT EXISTS pulse_type_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_new INTEGER
    `);

    // Migrate existing data in pulses
    console.log("📋 Step 6: Migrating pulses data...");
    for (const pulse of existingPulses.rows as any[]) {
      const legacyPulse: LegacyPulse = {
        id: pulse.id,
        farcaster_url: pulse.farcaster_url,
        date: pulse.date,
        description: pulse.description,
        points: pulse.points,
        created_by: pulse.created_by,
        created_at: pulse.created_at
      };

      // Convert date to datetime (assuming start of day)
      const datetimeStart = `${legacyPulse.date}T09:00:00`;
      
      // Try to extract member ID from created_by string
      let createdByMemberId = 1; // Default to first admin
      if (legacyPulse.created_by.startsWith('admin-')) {
        const fidStr = legacyPulse.created_by.replace('admin-', '');
        const fid = parseInt(fidStr);
        if (!isNaN(fid)) {
          try {
            const memberByFid = await storage.getMemberByFarcasterFid(fid);
            if (memberByFid) {
              createdByMemberId = memberByFid.id;
            }
          } catch (err) {
            console.warn(`Could not find member for FID ${fid}, using default admin`);
          }
        }
      }

      await db.execute(sql`
        UPDATE pulses 
        SET 
          url_embed = ${legacyPulse.farcaster_url},
          datetime_start = ${datetimeStart}::timestamp,
          interval = 24,
          pulse_type_id = 1,
          created_by_new = ${createdByMemberId}
        WHERE id = ${legacyPulse.id}
      `);
    }

    // Step 7: Drop old columns and rename new ones
    console.log("📋 Step 7: Finalizing pulses table structure...");
    await db.execute(sql`
      ALTER TABLE pulses 
      DROP COLUMN IF EXISTS farcaster_url,
      DROP COLUMN IF EXISTS date,
      DROP COLUMN IF EXISTS created_by
    `);

    await db.execute(sql`
      ALTER TABLE pulses 
      RENAME COLUMN created_by_new TO created_by
    `);

    // Make columns NOT NULL
    await db.execute(sql`
      ALTER TABLE pulses 
      ALTER COLUMN url_embed SET NOT NULL,
      ALTER COLUMN datetime_start SET NOT NULL,
      ALTER COLUMN pulse_type_id SET NOT NULL,
      ALTER COLUMN created_by SET NOT NULL
    `);

    // Step 8: Alter pulse_executions table structure
    console.log("📋 Step 8: Altering pulse_executions table structure...");
    
    // Add new actions column
    await db.execute(sql`
      ALTER TABLE pulse_executions 
      ADD COLUMN IF NOT EXISTS actions JSONB
    `);

    // Migrate existing executions data
    console.log("📋 Step 9: Migrating pulse_executions data...");
    for (const execution of existingExecutions.rows as any[]) {
      const legacyExecution: LegacyPulseExecution = {
        id: execution.id,
        pulse_id: execution.pulse_id,
        member_id: execution.member_id,
        action_type: execution.action_type,
        executed_at: execution.executed_at
      };

      // Convert action_type to actions JSON
      const actions = {
        liked: legacyExecution.action_type === 'like',
        shared: legacyExecution.action_type === 'recast',
        abstained: false
      };

      await db.execute(sql`
        UPDATE pulse_executions 
        SET actions = ${JSON.stringify(actions)}::jsonb
        WHERE id = ${legacyExecution.id}
      `);
    }

    // Drop old action_type column
    await db.execute(sql`
      ALTER TABLE pulse_executions 
      DROP COLUMN IF EXISTS action_type
    `);

    // Make actions column NOT NULL
    await db.execute(sql`
      ALTER TABLE pulse_executions 
      ALTER COLUMN actions SET NOT NULL
    `);

    // Step 10: Add constraints and foreign keys
    console.log("📋 Step 10: Adding constraints and foreign keys...");
    
    // Add foreign key for pulse_type_id
    await db.execute(sql`
      ALTER TABLE pulses 
      ADD CONSTRAINT pulses_pulse_type_id_fkey 
      FOREIGN KEY (pulse_type_id) REFERENCES pulse_types(id)
    `);

    // Add foreign key for created_by
    await db.execute(sql`
      ALTER TABLE pulses 
      ADD CONSTRAINT pulses_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES members(id)
    `);

    // Re-add pulse_executions foreign key
    await db.execute(sql`
      ALTER TABLE pulse_executions 
      ADD CONSTRAINT pulse_executions_pulse_id_fkey 
      FOREIGN KEY (pulse_id) REFERENCES pulses(id)
    `);

    // Add unique constraint for pulse_executions
    await db.execute(sql`
      ALTER TABLE pulse_executions 
      ADD CONSTRAINT pulse_executions_unique_member_pulse 
      UNIQUE (pulse_id, member_id)
    `);

    // Re-add attestations foreign key
    await db.execute(sql`
      ALTER TABLE attestations 
      ADD CONSTRAINT attestations_pulse_execution_id_fkey 
      FOREIGN KEY (pulse_execution_id) REFERENCES pulse_executions(id)
    `);

    console.log("✅ Migration completed successfully!");
    console.log(`📊 Migrated ${existingPulses.rows.length} pulses and ${existingExecutions.rows.length} executions`);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  });

export { runMigration };