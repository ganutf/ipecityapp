/**
 * Test the new streak calculation with fake users
 * This script displays streak calculations using both old and new methods for comparison
 */

import 'dotenv/config';
import { storage } from '../storage';
import { PulseService } from '../services/PulseService';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';

const TEST_FIDS = [900001, 900002, 900003, 900004, 900005, 900006, 900007, 900008];

async function testStreakCalculation() {
  console.log('🧪 Testing new streak calculation logic...');
  console.log('');

  try {
    // Initialize database and key manager
    await initializeKeyManager();
    await initializeDatabase();

    // Create PulseService instance
    const pulseService = new PulseService(storage);

    console.log('📊 Comparing streak calculations:\n');
    console.log('👤 User                | 🏛️ Storage (Old) | ⚡ Service (New) | 📄 Description');
    console.log('─'.repeat(85));

    for (const fid of TEST_FIDS) {
      const member = await storage.getMemberByFarcasterFid(fid);
      
      if (!member) {
        console.log(`❌ Member with FID ${fid} not found`);
        continue;
      }

      // Calculate streak using old storage method (deprecated)
      const oldStreak = await storage.calculatePulseStreak(member.id);
      
      // Calculate streak using new PulseService method (with active pulse logic)
      const newStreak = await pulseService.calculateMemberStreak(member.id);

      // Get user pattern description
      const pattern = getUserPattern(member.ipeUsername || 'unknown');
      
      const statusIcon = oldStreak === newStreak ? '✅' : '🔄';
      
      console.log(
        `${statusIcon} ${(member.ipeUsername || 'unknown').padEnd(18)} | ` +
        `${oldStreak.toString().padEnd(15)} | ` +
        `${newStreak.toString().padEnd(15)} | ` +
        `${pattern}`
      );
    }

    console.log('─'.repeat(85));
    console.log('');
    console.log('🔍 Legend:');
    console.log('  ✅ Same result (no active pulses affecting streak)');
    console.log('  🔄 Different result (new logic handling active pulses)');
    console.log('');
    
    // Check if there are any active pulses
    const activePulses = await pulseService.getActivePulses();
    if (activePulses.length > 0) {
      console.log('⚡ Active pulses detected:');
      for (const pulse of activePulses) {
        const pulseData = pulse.toJSON();
        console.log(`  • Pulse ${pulseData.id}: ${pulseData.description} (ends: ${pulseData.endTime.toLocaleString()})`);
      }
    } else {
      console.log('💤 No active pulses - all calculations should match');
    }

  } catch (error) {
    console.error('❌ Error testing streak calculation:', error);
    process.exit(1);
  }
}

function getUserPattern(username: string): string {
  const patterns: { [key: string]: string } = {
    'alice_perfect': 'Perfect streak - never misses',
    'bob_recent': 'Recently active - good recent streak', 
    'charlie_inconsistent': 'Inconsistent participation',
    'diana_newbie': 'New user - only recent pulses',
    'eve_returning': 'Returning user - gap in middle',
    'frank_weekend': 'Weekend warrior - burst pattern',
    'grace_random': 'Random participation',
    'henry_active': 'Currently active user'
  };
  return patterns[username] || 'Unknown pattern';
}

// Run the test
testStreakCalculation().catch(console.error).finally(() => {
  process.exit(0);
});