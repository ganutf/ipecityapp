import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running database migration: migrate-status-cleanup.sql');

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'migrate-status-cleanup.sql');
    const migrationSQL = fs.readFileSync(sqlFilePath, 'utf-8');

    // Split by semicolons and filter out comments/empty lines
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`\n📝 Executing: ${statement.substring(0, 80)}...`);
        await db.execute(sql.raw(statement));
        console.log('✅ Success');
      }
    }

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
