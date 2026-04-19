#!/usr/bin/env tsx

/**
 * Reset User Pulse Executions Script
 * 
 * This script resets all pulse execution records for a specific user.
 * Usage: tsx server/scripts/reset-user-pulse-executions.ts <FID>
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase, getDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';

const MEMBER_FID = process.argv[2];

async function resetUserPulseExecutions() {
  console.log('🔄 Ipê Platform - Reset User Pulse Executions');
  console.log('===============================================\n');

  // Validate FID argument
  if (!MEMBER_FID) {
    console.error('❌ Error: FID is required');
    console.log('Usage: tsx server/scripts/reset-user-pulse-executions.ts <FID>');
    console.log('Example: tsx server/scripts/reset-user-pulse-executions.ts 2790');
    process.exit(1);
  }

  const fid = parseInt(MEMBER_FID);
  if (isNaN(fid)) {
    console.error('❌ Error: FID must be a valid number');
    process.exit(1);
  }

  console.log(`🔍 Looking up member with FID: ${fid}`);

  try {
    // Initialize key manager first (for secure storage)
    try {
      initializeKeyManager();
      console.log('✅ Key manager initialized');
    } catch (error) {
      console.log('⚠️  Key manager not available, using environment variables');
    }

    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connection initialized');

    // Test database connection
    const { db } = getDatabase();
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');

    // Check if member exists
    const member = await storage.getMemberByFarcasterFid(fid);

    if (!member) {
      console.log('❌ Member not found in system');
      console.log(`No member exists with FID: ${fid}`);
      process.exit(1);
    }

    console.log(`✅ Found member: ${member.email || 'No email'} (ID: ${member.id})`);

    // Get current executions
    const executions = await storage.getMemberExecutions(member.id);
    console.log(`📊 Found ${executions.length} pulse execution(s) for this user`);

    if (executions.length === 0) {
      console.log('ℹ️  No pulse executions to reset for this user');
      process.exit(0);
    }

    // Display current executions
    console.log('\n📋 CURRENT PULSE EXECUTIONS');
    console.log('============================');
    executions.forEach((execution: any, index: number) => {
      console.log(`${index + 1}. Pulse ID: ${execution.pulseId}`);
      console.log(`   Actions: ${JSON.stringify(execution.actions)}`);
      console.log(`   Executed: ${execution.executedAt}`);
      console.log('');
    });

    console.log('🔄 Resetting all pulse executions...');
    
    // Delete all pulse executions for this member
    const database = getDatabase();
    const { pulseExecutions } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const result = await database.db.delete(pulseExecutions)
      .where(eq(pulseExecutions.memberId, member.id));

    console.log(`✅ Successfully reset ${executions.length} pulse execution(s) for user ${fid}`);

    // Audit log
    const timestamp = new Date().toISOString();
    console.log('\n📋 AUDIT LOG');
    console.log('============');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Action: RESET_PULSE_EXECUTIONS`);
    console.log(`Target FID: ${fid}`);
    console.log(`Member ID: ${member.id}`);
    console.log(`Executions Reset: ${executions.length}`);

    console.log('\n✅ RESET COMPLETED SUCCESSFULLY');
    console.log('===============================');
    console.log(`All pulse executions for FID ${fid} have been reset`);
    console.log('User can now participate in pulses again');

  } catch (error) {
    console.error('\n❌ Error resetting pulse executions:', error);
    console.error('\nTroubleshooting:');
    console.error('• Check database connection');
    console.error('• Verify FID is valid');
    console.error('• Check database permissions');
    process.exit(1);
  }
}

// Run the script
resetUserPulseExecutions()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });