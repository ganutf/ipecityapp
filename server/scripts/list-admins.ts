#!/usr/bin/env tsx

/**
 * Admin List Script
 * 
 * This script lists all admin users in the system.
 * Usage: tsx server/scripts/list-admins.ts
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase, getDatabase } from '../db';

async function listAdmins() {
  console.log('🔍 Ipê Platform - Admin User List');
  console.log('===================================\n');

  try {
    // Initialize database connection (script context — not booted by server)
    await initializeDatabase();
    const { db } = getDatabase();
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful\n');

    // Get all members
    const allMembers = await storage.getAllMembers();
    
    // Filter for admin users
    const adminUsers = allMembers.filter(member => member.memberType === 'admin');
    
    if (adminUsers.length === 0) {
      console.log('⚠️  No admin users found in the system');
      console.log('\nTo create an admin user, run:');
      console.log('tsx server/scripts/create-admin.ts <FID>');
      return;
    }
    
    console.log(`👑 Found ${adminUsers.length} admin user(s):\n`);
    
    adminUsers.forEach((admin, index) => {
      console.log(`${index + 1}. Admin User`);
      console.log(`   Member ID: ${admin.id}`);
      console.log(`   FID: ${admin.farcasterFid ?? 'Not set'}`);
      console.log(`   Status: ${admin.status}`);
      console.log(`   Email: ${admin.email || 'Not set'}`);
      console.log(`   Wallet: ${admin.walletAddress || 'Not set'}`);
      console.log(`   ENS Passport: ${admin.ipePassport || 'Not set'}`);
      console.log(`   Privy ID: ${admin.privyId || 'Not set'}`);
      console.log(`   Created: ${admin.createdAt}`);
      console.log(`   Last Updated: ${admin.updatedAt || 'Never'}`);
      console.log('');
    });
    
    console.log('🔐 Security Information:');
    console.log('• All admin actions are logged for audit purposes');
    console.log('• Admins can create/edit pulses and approve members');
    console.log('• Regularly review this list for unauthorized access');
    
  } catch (error) {
    console.error('\n❌ Error listing admins:', error);
    console.error('\nTroubleshooting:');
    console.error('• Check database connection');
    console.error('• Verify database permissions');
    process.exit(1);
  }
}

// Run the script
listAdmins()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });