/**
 * Test active pulse execution status for fake users
 * Shows which users have executed the active pulse and how it affects their streak
 */

import 'dotenv/config';
import { storage } from '../storage';
import { PulseService } from '../services/PulseService';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';

const TEST_FIDS = [900001, 900002, 900003, 900004, 900005, 900006, 900007, 900008];

async function testActivePulseStatus() {
  console.log('🔥 Testing active pulse execution status...');
  console.log('');

  try {
    // Initialize database and key manager
    await initializeKeyManager();
    await initializeDatabase();

    // Create PulseService instance
    const pulseService = new PulseService(storage);

    // Get active pulses
    const activePulses = await pulseService.getActivePulses();
    
    if (activePulses.length === 0) {
      console.log('💤 No active pulses found');
      return;
    }

    const activePulse = activePulses[0];
    const pulseData = activePulse.toJSON();
    
    console.log(`⚡ Active Pulse: #${pulseData.id} - "${pulseData.description}"`);
    console.log(`📅 Started: ${new Date(pulseData.datetimeStart).toLocaleString()}`);
    console.log(`⏰ Ends: ${pulseData.endTime.toLocaleString()}`);
    console.log('');

    console.log('👤 User Status for Active Pulse:');
    console.log('─'.repeat(70));
    console.log('User                | Executed | Old Streak | New Streak | Impact');
    console.log('─'.repeat(70));

    for (const fid of TEST_FIDS) {
      const member = await storage.getMemberByFarcasterFid(fid);
      
      if (!member) {
        console.log(`❌ Member with FID ${fid} not found`);
        continue;
      }

      // Check if user executed the active pulse
      const execution = await pulseService.getPulseExecutionStatus(pulseData.id, member.id);
      const hasExecuted = !!execution;

      // Calculate streaks
      const oldStreak = await storage.calculatePulseStreak(member.id);
      const newStreak = await pulseService.calculateMemberStreak(member.id);
      
      const impact = oldStreak === newStreak ? 'None' : 
                    newStreak > oldStreak ? `+${newStreak - oldStreak}` : 
                    `${newStreak - oldStreak}`;
      
      const executedIcon = hasExecuted ? '✅' : '❌';
      const impactIcon = impact === 'None' ? '➖' : impact.startsWith('+') ? '⬆️' : '⬇️';
      
      console.log(
        `${(member.ipeUsername || 'unknown').padEnd(18)} | ` +
        `${executedIcon}       | ` +
        `${oldStreak.toString().padEnd(10)} | ` +
        `${newStreak.toString().padEnd(10)} | ` +
        `${impactIcon} ${impact}`
      );
    }

    console.log('─'.repeat(70));
    console.log('');
    console.log('🔍 Analysis:');
    console.log('  ✅ User executed active pulse - counts toward streak');
    console.log('  ❌ User has NOT executed active pulse - new logic skips it (doesn\'t break streak)');
    console.log('  ⬆️ New logic increased streak (active pulse skipped)');
    console.log('  ➖ No difference (user executed active pulse or has no streak)');

  } catch (error) {
    console.error('❌ Error testing active pulse status:', error);
    process.exit(1);
  }
}

// Run the test
testActivePulseStatus().catch(console.error).finally(() => {
  process.exit(0);
});