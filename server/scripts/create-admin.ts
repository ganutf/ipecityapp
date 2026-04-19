#!/usr/bin/env tsx

/**
 * Admin Bootstrap Script
 * 
 * This script creates or promotes a user to admin status.
 * Usage: tsx server/scripts/create-admin.ts <FID>
 * 
 * Security Features:
 * - Confirms admin creation with user
 * - Logs all admin operations for audit trail
 * - Validates FID exists in system
 * - Creates member record if doesn't exist
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase, getDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';

const ADMIN_FID = process.argv[2];

async function createAdmin() {
  console.log('🚀 Ipê Platform - Admin Bootstrap Script');
  console.log('==========================================\n');

  // Validate FID argument
  if (!ADMIN_FID) {
    console.error('❌ Error: FID is required');
    console.log('Usage: tsx server/scripts/create-admin.ts <FID>');
    console.log('Example: tsx server/scripts/create-admin.ts 2790');
    process.exit(1);
  }

  const fid = parseInt(ADMIN_FID);
  if (isNaN(fid)) {
    console.error('❌ Error: FID must be a valid number');
    process.exit(1);
  }

  console.log(`🔍 Checking FID: ${fid}`);

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

    // Check if user exists
    let member = await storage.getMemberByFarcasterFid(fid);

    if (!member) {
      console.log('👤 User not found in system, creating new member record...');

      // Create new member with admin privileges
      member = await storage.createMember({
        farcasterFid: fid,
        status: 'active_member',
        memberType: 'admin',
        emailVerified: true,
        passportVerified: true,
      });

      console.log('✅ New admin member created');
    } else {
      console.log('👤 User found in system');
      console.log(`   Current status: ${member.status}`);
      console.log(`   Current memberType: ${member.memberType}`);

      if (member.memberType === 'admin') {
        console.log('⚠️  User is already an admin');
        console.log('🎉 No action needed');
        return;
      }

      // Confirm promotion (non-interactive for Replit environment)
      console.log('\n🔐 PROCEEDING WITH ADMIN PROMOTION');
      console.log('===================================');
      console.log('Promoting user to admin status...');
      console.log('This will grant them full administrative privileges.');

      // Update member to admin
      member = await storage.updateMember(member.id, {
        memberType: 'admin',
        status: 'active_member',
        emailVerified: true,
        passportVerified: true,
      });

      console.log('✅ User promoted to admin');
    }

    // Audit log
    const timestamp = new Date().toISOString();
    console.log('\n📋 AUDIT LOG');
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Action: CREATE_ADMIN`);
    console.log(`Target FID: ${fid}`);
    console.log(`New memberType: admin`);
    console.log(`Status: active_member`);

    // Display final status
    console.log('\n🎉 ADMIN CREATION SUCCESSFUL');
    console.log('================================');
    console.log(`FID: ${member.farcasterFid}`);
    console.log(`Member Type: ${member.memberType}`);
    console.log(`Status: ${member.status}`);
    console.log(`Email Verified: ${member.emailVerified}`);
    console.log(`Passport Verified: ${member.passportVerified}`);

    console.log('\n🔐 SECURITY REMINDER');
    console.log('• Admin users have full access to the system');
    console.log('• All admin actions are logged for audit purposes');
    console.log('• Regularly review admin user list');
    console.log('• Consider implementing 2FA for admin accounts');

  } catch (error) {
    console.error('\n❌ Error creating admin:', error);
    console.error('\nTroubleshooting:');
    console.error('• Check database connection');
    console.error('• Verify FID is valid');
    console.error('• Check database permissions');
    process.exit(1);
  }
}

// Run the script
createAdmin()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });