import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const { Client } = pg;

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📝 Step 1: Updating members with unused statuses...');
    const updateResult = await client.query(`
      UPDATE members
      SET status = 'pending_id_verification'
      WHERE status IN ('pending_application', 'email_verified', 'pending_signer')
    `);
    console.log(`✅ Updated ${updateResult.rowCount} members\n`);

    console.log('📝 Step 2: Dropping old CHECK constraint...');
    await client.query(`
      ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check
    `);
    console.log('✅ Constraint dropped\n');

    console.log('📝 Step 3: Adding new CHECK constraint...');
    await client.query(`
      ALTER TABLE members ADD CONSTRAINT members_status_check
      CHECK (status IN (
        'pending_id_verification',
        'pending_application_review',
        'approved_application',
        'denied_application',
        'active_member'
      ))
    `);
    console.log('✅ New constraint added\n');

    console.log('📊 Verifying migration - Current status counts:');
    const result = await client.query(`
      SELECT status, COUNT(*) as count
      FROM members
      GROUP BY status
      ORDER BY status
    `);

    console.table(result.rows);

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
