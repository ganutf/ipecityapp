#!/usr/bin/env tsx

/**
 * Member Address Verification Script
 *
 * This script verifies that wallet addresses stored in the database match
 * the addresses resolved from their ENS subdomains via JustaName API.
 *
 * Usage: npm run members:verify-addresses
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase, getDatabase } from '../db';
import { lookupEnsName } from '../lib/ensLookup';

interface VerificationResult {
  memberId: number;
  farcasterFid: number;
  ipeUsername: string | null;
  ipePassport: string | null;
  storedAddress: string | null;
  resolvedAddress: string | null;
  status: 'match' | 'mismatch' | 'no-passport' | 'no-address' | 'resolution-failed';
  message: string;
}

async function verifyMemberAddresses() {
  console.log('🔍 Ipê City Pulse - Member Address Verification');
  console.log('================================================\n');

  try {
    // Initialize database connection
    await initializeDatabase();
    const { db } = getDatabase();
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful\n');

    // Get all members
    const allMembers = await storage.getAllMembers();
    console.log(`📊 Found ${allMembers.length} total members\n`);

    const results: VerificationResult[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let noPassportCount = 0;
    let noAddressCount = 0;
    let resolutionFailedCount = 0;

    console.log('🔄 Verifying addresses...\n');

    for (const member of allMembers) {
      const result: VerificationResult = {
        memberId: member.id,
        farcasterFid: member.farcasterFid,
        ipeUsername: member.ipeUsername,
        ipePassport: member.ipePassport,
        storedAddress: member.walletAddress,
        resolvedAddress: null,
        status: 'no-passport',
        message: ''
      };

      // Skip if no passport
      if (!member.ipePassport) {
        result.status = 'no-passport';
        result.message = 'No ENS passport registered';
        noPassportCount++;
        results.push(result);
        continue;
      }

      // Skip if no stored address
      if (!member.walletAddress) {
        result.status = 'no-address';
        result.message = 'No wallet address stored in database';
        noAddressCount++;
        results.push(result);
        continue;
      }

      // Resolve subdomain to address using JustaName
      try {
        console.log(`  Checking ${member.ipePassport} (FID: ${member.farcasterFid})...`);

        // Use the existing ensLookup to get resolved addresses
        const lookupResult = await lookupEnsName(member.walletAddress);

        // Check if the passport is in the resolved names
        const hasMatchingPassport = lookupResult.ensNames.some(
          name => name.toLowerCase() === member.ipePassport?.toLowerCase()
        );

        if (lookupResult.error || lookupResult.ensNames.length === 0) {
          result.status = 'resolution-failed';
          result.message = `Failed to resolve subdomain: ${lookupResult.error || 'No ENS names found'}`;
          result.resolvedAddress = null;
          resolutionFailedCount++;
          console.log(`    ⚠️  Resolution failed: ${result.message}`);
        } else if (hasMatchingPassport) {
          // Address resolves back to the correct passport
          result.status = 'match';
          result.resolvedAddress = member.walletAddress;
          result.message = `✅ Address matches passport (${lookupResult.ensNames.join(', ')})`;
          matchCount++;
          console.log(`    ✅ Match confirmed`);
        } else {
          // Address exists but doesn't resolve to expected passport
          result.status = 'mismatch';
          result.resolvedAddress = member.walletAddress;
          result.message = `Address resolves to: ${lookupResult.ensNames.join(', ')} (expected: ${member.ipePassport})`;
          mismatchCount++;
          console.log(`    ❌ Mismatch: ${result.message}`);
        }

      } catch (error) {
        result.status = 'resolution-failed';
        result.message = `Error during verification: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.resolvedAddress = null;
        resolutionFailedCount++;
        console.log(`    ⚠️  Error: ${result.message}`);
      }

      results.push(result);

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Verification Summary');
    console.log('='.repeat(50));
    console.log(`Total Members:        ${allMembers.length}`);
    console.log(`✅ Matches:           ${matchCount}`);
    console.log(`❌ Mismatches:        ${mismatchCount}`);
    console.log(`⚠️  No Passport:       ${noPassportCount}`);
    console.log(`⚠️  No Address:        ${noAddressCount}`);
    console.log(`⚠️  Resolution Failed: ${resolutionFailedCount}`);
    console.log('='.repeat(50) + '\n');

    // Show detailed results for issues
    if (mismatchCount > 0) {
      console.log('❌ MISMATCHES FOUND:');
      console.log('-'.repeat(50));
      results
        .filter(r => r.status === 'mismatch')
        .forEach(r => {
          console.log(`\nMember ID: ${r.memberId} (FID: ${r.farcasterFid})`);
          console.log(`  Passport:       ${r.ipePassport}`);
          console.log(`  Stored Address: ${r.storedAddress}`);
          console.log(`  Issue:          ${r.message}`);
        });
      console.log('\n');
    }

    if (resolutionFailedCount > 0) {
      console.log('⚠️  RESOLUTION FAILURES:');
      console.log('-'.repeat(50));
      results
        .filter(r => r.status === 'resolution-failed')
        .forEach(r => {
          console.log(`\nMember ID: ${r.memberId} (FID: ${r.farcasterFid})`);
          console.log(`  Passport:       ${r.ipePassport}`);
          console.log(`  Stored Address: ${r.storedAddress}`);
          console.log(`  Issue:          ${r.message}`);
        });
      console.log('\n');
    }

    // Save detailed results to JSON file
    const fs = await import('fs/promises');
    const outputPath = 'member-address-verification.json';
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed results saved to: ${outputPath}\n`);

    // Exit with error code if mismatches found
    if (mismatchCount > 0) {
      console.log('⚠️  WARNING: Address mismatches detected. Review before token distribution!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    console.error('\nTroubleshooting:');
    console.error('• Check database connection');
    console.error('• Verify JustaName API is accessible');
    console.error('• Check network connectivity');
    process.exit(1);
  }
}

// Run the script
verifyMemberAddresses()
  .then(() => {
    console.log('✨ Verification completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error);
    process.exit(1);
  });
