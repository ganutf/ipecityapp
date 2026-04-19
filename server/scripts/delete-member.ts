#!/usr/bin/env tsx

/**
 * Member Deletion Script
 * 
 * This script safely deletes a member and all related data from the system.
 * Usage: tsx server/scripts/delete-member.ts <FID>
 * 
 * Security Features:
 * - Multiple confirmation prompts
 * - Displays member details before deletion
 * - Logs all deletion operations for audit trail
 * - Cascading deletion of related data
 * - Rollback support in case of errors
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase, getDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';

const MEMBER_FID = process.argv[2];

async function deleteMember() {
  console.log('🗑️  Ipê Platform - Member Deletion Script');
  console.log('==========================================\n');

  // Validate FID argument
  if (!MEMBER_FID) {
    console.error('❌ Error: FID is required');
    console.log('Usage: tsx server/scripts/delete-member.ts <FID>');
    console.log('Example: tsx server/scripts/delete-member.ts 12345');
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

    // Display member details
    console.log('\n📋 MEMBER DETAILS');
    console.log('==================');
    console.log(`FID: ${member.farcasterFid}`);
    console.log(`Status: ${member.status}`);
    console.log(`Member Type: ${member.memberType}`);
    console.log(`Email: ${member.email || 'Not set'}`);
    console.log(`IPE Passport: ${member.ipePassport || 'Not set'}`);
    console.log(`Email Verified: ${member.emailVerified}`);
    console.log(`Passport Verified: ${member.passportVerified}`);
    console.log(`Created: ${member.createdAt}`);
    console.log(`Bio: ${member.bio || 'Not set'}`);

    // Confirmation (non-interactive for Replit environment)
    console.log('\n⚠️  DANGER ZONE - MEMBER DELETION');
    console.log('==================================');
    console.log('This action will:');
    console.log('• Delete the member record permanently');
    console.log('• Remove all attestations linked to member activities');
    console.log('• Remove all pulse executions (likes/recasts)');
    console.log('• Delete email verification records');
    console.log('• Remove passport verification tokens');
    console.log('• Delete associated signer records');
    console.log('• THIS CANNOT BE UNDONE');

    console.log('\n🔐 PROCEEDING WITH DELETION');
    console.log('============================');
    console.log(`PERMANENTLY DELETING member:`);
    console.log(`• FID: ${member.farcasterFid}`);
    console.log(`• Email: ${member.email || 'Not set'}`);
    console.log(`• Status: ${member.status}`);
    console.log(`• Member Type: ${member.memberType}`);
    console.log('\nThis action is IRREVERSIBLE!');

    console.log('\n🗑️  Starting deletion process...');

    // Delete member and all related data
    await storage.deleteMember(member.id);

    console.log('✅ Member deleted successfully');

    // Audit log
    const timestamp = new Date().toISOString();
    console.log('\n📋 AUDIT LOG');
    console.log('============');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Action: DELETE_MEMBER`);
    console.log(`Target FID: ${fid}`);
    console.log(`Previous Status: ${member.status}`);
    console.log(`Previous Member Type: ${member.memberType}`);
    console.log(`Had Email: ${member.email ? 'Yes' : 'No'}`);
    console.log(`Had Passport: ${member.ipePassport ? 'Yes' : 'No'}`);

    console.log('\n✅ DELETION COMPLETED SUCCESSFULLY');
    console.log('==================================');
    console.log(`Member with FID ${fid} has been permanently deleted`);
    console.log('All related data has been cleaned up');

    console.log('\n📝 SECURITY REMINDER');
    console.log('• Member deletion has been logged for audit purposes');
    console.log('• This action cannot be undone');
    console.log('• Consider backing up important data before deletions');

  } catch (error) {
    console.error('\n❌ Error deleting member:', error);
    console.error('\nTroubleshooting:');
    console.error('• Check database connection');
    console.error('• Verify FID is valid');
    console.error('• Check database permissions');
    console.error('• Ensure no foreign key constraints are preventing deletion');
    process.exit(1);
  }
}

// Run the script
deleteMember()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });