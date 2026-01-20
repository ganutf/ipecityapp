/**
 * Generate fake users with realistic pulse execution patterns for testing streak calculation
 * This script creates diverse user scenarios to test the new active pulse logic
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';
import { db } from '../db';
import { members, pulses, pulseExecutions } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface FakeUser {
  farcasterFid: number;
  email: string;
  ipeUsername: string;
  ipePassport: string;
  bio: string;
  twitter?: string;
  profileTags: string[];
  executionPattern: 'perfect' | 'recent_active' | 'inconsistent' | 'new_user' | 'returning_user' | 'weekend_warrior' | 'random';
}

const fakeUsers: FakeUser[] = [
  {
    farcasterFid: 900001,
    email: 'alice.perfect@test.dev',
    ipeUsername: 'alice',
    ipePassport: 'alice.ipecity.eth',
    bio: 'Perfect user who never misses a pulse - testing high streaks',
    twitter: 'alice_perfect',
    profileTags: ['developer', 'web3', 'consistent'],
    executionPattern: 'perfect'
  },
  {
    farcasterFid: 900002,
    email: 'bob.recent@test.dev',
    ipeUsername: 'bob',
    ipePassport: 'bob.ipecity.eth',
    bio: 'Recently active user - good recent streak but missed some old ones',
    twitter: 'bob_recent',
    profileTags: ['designer', 'farcaster', 'active'],
    executionPattern: 'recent_active'
  },
  {
    farcasterFid: 900003,
    email: 'charlie.inconsistent@test.dev',
    ipeUsername: 'charlie',
    ipePassport: 'charlie.ipecity.eth',
    bio: 'Inconsistent user - sometimes participates, sometimes doesn\'t',
    profileTags: ['artist', 'casual', 'creative'],
    executionPattern: 'inconsistent'
  },
  {
    farcasterFid: 900004,
    email: 'diana.newbie@test.dev',
    ipeUsername: 'diana',
    ipePassport: 'diana.ipecity.eth',
    bio: 'New user who just joined - testing new user experience',
    twitter: 'diana_newbie',
    profileTags: ['newcomer', 'learning', 'excited'],
    executionPattern: 'new_user'
  },
  {
    farcasterFid: 900005,
    email: 'eve.returning@test.dev',
    ipeUsername: 'eve',
    ipePassport: 'eve.ipecity.eth',
    bio: 'Returning user - was inactive but came back recently',
    profileTags: ['entrepreneur', 'busy', 'comeback'],
    executionPattern: 'returning_user'
  },
  {
    farcasterFid: 900006,
    email: 'frank.weekend@test.dev',
    ipeUsername: 'frank',
    ipePassport: 'frank.ipecity.eth',
    bio: 'Weekend warrior - participates in bursts but not consistently',
    twitter: 'frank_weekend',
    profileTags: ['weekend', 'builder', 'burst'],
    executionPattern: 'weekend_warrior'
  },
  {
    farcasterFid: 900007,
    email: 'grace.random@test.dev',
    ipeUsername: 'grace',
    ipePassport: 'grace.ipecity.eth',
    bio: 'Completely random participation - good for edge case testing',
    profileTags: ['random', 'unpredictable', 'tester'],
    executionPattern: 'random'
  },
  {
    farcasterFid: 900008,
    email: 'henry.active@test.dev',
    ipeUsername: 'henry',
    ipePassport: 'henry.ipecity.eth',
    bio: 'Currently active user - has been executing recent pulses but missed earlier ones',
    twitter: 'henry_active',
    profileTags: ['developer', 'active', 'recent'],
    executionPattern: 'recent_active'
  }
];

async function generateTestUsers() {
  console.log('🚀 Starting test user generation...');

  try {
    // Initialize database and key manager
    await initializeKeyManager();
    await initializeDatabase();

    // Get all pulses ordered by datetime_start (oldest first for streak calculation)
    const allPulses = await storage.getAllPulses();

    console.log(`📊 Found ${allPulses.length} pulses in database`);

    if (allPulses.length === 0) {
      console.error('❌ No pulses found in database. Please create some pulses first.');
      process.exit(1);
    }

    // Create each fake user
    for (const fakeUser of fakeUsers) {
      console.log(`👤 Creating user: ${fakeUser.ipeUsername} (${fakeUser.executionPattern} pattern)`);

      // Check if user already exists
      let member = await storage.getMemberByFarcasterFid(fakeUser.farcasterFid);
      let memberId: number;

      if (member) {
        console.log(`  ♻️  User already exists, updating...`);
        const updatedMember = await storage.updateMember(member.id, {
          email: fakeUser.email,
          ipeUsername: fakeUser.ipeUsername,
          ipePassport: fakeUser.ipePassport,
          bio: fakeUser.bio,
          twitter: fakeUser.twitter,
          profileTags: fakeUser.profileTags,
          status: 'active_member',
          memberType: 'explorer',
          emailVerified: true,
          passportVerified: true
        });
        memberId = updatedMember.id;
      } else {
        // Create new user
        const newMember = await storage.createMember({
          farcasterFid: fakeUser.farcasterFid,
          email: fakeUser.email,
          ipeUsername: fakeUser.ipeUsername,
          ipePassport: fakeUser.ipePassport,
          bio: fakeUser.bio,
          twitter: fakeUser.twitter,
          profileTags: fakeUser.profileTags,
          status: 'active_member',
          memberType: 'explorer',
          emailVerified: true,
          passportVerified: true,
          walletAddress: `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}` // Fake wallet address
        });
        memberId = newMember.id;
      }

      // Delete existing pulse executions for this user to start fresh
      await db
        .delete(pulseExecutions)
        .where(eq(pulseExecutions.memberId, memberId));

      // Generate pulse executions based on pattern
      const executions = generateExecutionPattern(allPulses, fakeUser.executionPattern);
      console.log(`  🎯 Generating ${executions.length} pulse executions...`);

      for (const execution of executions) {
        await db
          .insert(pulseExecutions)
          .values({
            pulseId: execution.pulseId,
            memberId: memberId,
            actions: execution.actions,
            executedAt: execution.executedAt
          });
      }

      console.log(`  ✅ Created user ${fakeUser.ipeUsername} with ${executions.length} executions`);
    }

    console.log('🎉 Test user generation completed successfully!');
    console.log('');
    console.log('📋 Generated users:');
    fakeUsers.forEach(user => {
      console.log(`  • ${user.ipeUsername} (FID: ${user.farcasterFid}) - ${user.executionPattern} pattern`);
    });
    
  } catch (error) {
    console.error('❌ Error generating test users:', error);
    process.exit(1);
  }
}

function generateExecutionPattern(allPulses: any[], pattern: string) {
  const executions: Array<{
    pulseId: number;
    actions: { liked: boolean; shared: boolean; abstained: boolean };
    executedAt: Date;
  }> = [];

  const currentTime = new Date();

  switch (pattern) {
    case 'perfect':
      // Execute every single pulse
      allPulses.forEach(pulse => {
        executions.push({
          pulseId: pulse.id,
          actions: { liked: true, shared: Math.random() > 0.3, abstained: false },
          executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
        });
      });
      break;

    case 'recent_active':
      // Execute last 5-7 pulses consistently, miss some older ones
      allPulses.forEach((pulse, index) => {
        if (index >= allPulses.length - 7) {
          // Recent pulses - high execution rate
          if (Math.random() > 0.1) { // 90% chance
            executions.push({
              pulseId: pulse.id,
              actions: { liked: true, shared: Math.random() > 0.4, abstained: false },
              executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
            });
          }
        } else {
          // Older pulses - lower execution rate  
          if (Math.random() > 0.6) { // 40% chance
            executions.push({
              pulseId: pulse.id,
              actions: { liked: true, shared: Math.random() > 0.7, abstained: false },
              executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
            });
          }
        }
      });
      break;

    case 'inconsistent':
      // Random 50% execution rate with some streaks and breaks
      allPulses.forEach(pulse => {
        if (Math.random() > 0.5) { // 50% chance
          executions.push({
            pulseId: pulse.id,
            actions: { 
              liked: true, 
              shared: Math.random() > 0.6,
              abstained: false 
            },
            executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
          });
        }
      });
      break;

    case 'new_user':
      // Only execute the most recent 2-3 pulses
      allPulses.slice(-3).forEach(pulse => {
        if (Math.random() > 0.2) { // 80% chance for recent pulses
          executions.push({
            pulseId: pulse.id,
            actions: { liked: true, shared: true, abstained: false },
            executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
          });
        }
      });
      break;

    case 'returning_user':
      // Execute some early pulses, then a gap, then recent pulses
      allPulses.forEach((pulse, index) => {
        if (index < 3 || index >= allPulses.length - 4) {
          // Early pulses or recent pulses
          if (Math.random() > 0.3) { // 70% chance
            executions.push({
              pulseId: pulse.id,
              actions: { liked: true, shared: Math.random() > 0.5, abstained: false },
              executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
            });
          }
        }
        // Skip middle pulses (inactive period)
      });
      break;

    case 'weekend_warrior':
      // Execute pulses in bursts (simulate weekend activity)
      allPulses.forEach((pulse, index) => {
        const burstPattern = Math.floor(index / 3) % 3; // Create burst pattern
        if (burstPattern === 0 && Math.random() > 0.2) { // 80% during burst
          executions.push({
            pulseId: pulse.id,
            actions: { liked: true, shared: true, abstained: false },
            executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
          });
        } else if (burstPattern === 1 && Math.random() > 0.8) { // 20% during low activity
          executions.push({
            pulseId: pulse.id,
            actions: { liked: true, shared: false, abstained: false },
            executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
          });
        }
        // burstPattern === 2: complete inactivity
      });
      break;

    case 'random':
      // Completely random execution pattern
      allPulses.forEach(pulse => {
        if (Math.random() > 0.4) { // 60% chance
          const actionType = Math.random();
          executions.push({
            pulseId: pulse.id,
            actions: {
              liked: actionType > 0.3,
              shared: actionType > 0.7,
              abstained: actionType <= 0.1
            },
            executedAt: getRandomExecutionTime(pulse.datetimeStart, pulse.interval)
          });
        }
      });
      break;

    default:
      console.warn(`Unknown pattern: ${pattern}`);
      break;
  }

  return executions;
}

function getRandomExecutionTime(pulseStart: Date, intervalHours: number): Date {
  // Generate random execution time within the pulse window
  const startTime = new Date(pulseStart);
  const endTime = new Date(startTime.getTime() + (intervalHours * 60 * 60 * 1000));
  
  // Random time between start and end (or end time if pulse has ended)
  const now = new Date();
  const effectiveEndTime = endTime > now ? now : endTime;
  
  if (effectiveEndTime <= startTime) {
    return startTime; // Pulse hasn't started yet, execute at start
  }
  
  const randomTime = startTime.getTime() + 
    Math.random() * (effectiveEndTime.getTime() - startTime.getTime());
  
  return new Date(randomTime);
}

// Run the script and ensure proper cleanup
generateTestUsers().catch(console.error).finally(() => {
  process.exit(0);
});