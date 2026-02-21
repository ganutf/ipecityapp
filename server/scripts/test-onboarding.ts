#!/usr/bin/env tsx

/**
 * Onboarding Testing Toolkit
 *
 * Unified CLI for testing, resetting, and stress-testing the member onboarding flow.
 *
 * Usage: npm run onboarding <command> [identifier] [options]
 *
 * Identifier can be: memberId (number), email, ipeUsername, or privyId (did:privy:...)
 *
 * Commands:
 *   info <id>                    Show full member state and related data
 *   reset <id>                   Reset member to pending_id_verification
 *   set-status <id> <status>     Force any valid status
 *   verify-email <id> [email]    Mark email as verified
 *   submit-app <id> [username]   Auto-submit application with test data
 *   approve <id> [type]          Approve application (default: explorer)
 *   deny <id>                    Deny application
 *   activate <id> [passport]     Set to active_member with passport
 *   create [--email x] [--wallet x] [--status x] [--type x] [--privy-id x]
 *   delete <id>                  Delete member and all related data
 *   list [--status x]            List members, optionally filtered
 */

import 'dotenv/config';
import { storage } from '../storage';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';
import { MEMBER_STATUSES, MEMBER_TYPES } from '../../shared/constants';
import { db } from '../db';
import { emailVerifications, passportVerifications, pulseExecutions } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import type { Member } from '../../shared/schema';

// ============================================
// DB INITIALIZATION
// ============================================

async function initDb() {
  try {
    initializeKeyManager();
  } catch {
    // Key manager not available, fine for scripts
  }
  await initializeDatabase();
}

// ============================================
// MEMBER LOOKUP (flexible identifier)
// ============================================

async function lookupMember(identifier: string): Promise<Member> {
  let member: Member | undefined;

  if (/^\d+$/.test(identifier)) {
    member = await storage.getMember(parseInt(identifier));
  } else if (identifier.includes('@') && !identifier.startsWith('did:')) {
    member = await storage.getMemberByEmail(identifier);
  } else if (identifier.startsWith('did:privy:')) {
    member = await storage.getMemberByPrivyId(identifier);
  } else {
    member = await storage.getMemberByIpeUsername(identifier);
  }

  if (!member) {
    console.error(`Member not found: ${identifier}`);
    process.exit(1);
  }

  return member;
}

// ============================================
// DISPLAY HELPERS
// ============================================

function printMember(member: Member, label = 'MEMBER') {
  console.log(`\n${label}`);
  console.log('='.repeat(50));
  console.log(`  ID:              ${member.id}`);
  console.log(`  Status:          ${member.status}`);
  console.log(`  Member Type:     ${member.memberType}`);
  console.log(`  Email:           ${member.email || '-'}`);
  console.log(`  Email Verified:  ${member.emailVerified}`);
  console.log(`  Wallet:          ${member.walletAddress || '-'}`);
  console.log(`  Username:        ${member.ipeUsername || '-'}`);
  console.log(`  Passport:        ${member.ipePassport || '-'}`);
  console.log(`  Pass. Verified:  ${member.passportVerified}`);
  console.log(`  Privy ID:        ${member.privyId || '-'}`);
  console.log(`  Farcaster FID:   ${member.farcasterFid ?? '-'}`);
  console.log(`  Created:         ${member.createdAt}`);
  console.log(`  Updated:         ${member.updatedAt}`);
}

function getOnboardingStep(member: Member): string {
  switch (member.status) {
    case 'active_member':
      return 'COMPLETE - Active member';
    case 'approved_application':
      return 'Step 5/5 - Accept passport (approved, awaiting acceptance)';
    case 'denied_application':
      return 'DENIED - Application was rejected';
    case 'pending_application_review':
      return 'Step 4/5 - Awaiting admin approval';
    case 'pending_id_verification':
      if (!member.emailVerified) {
        return 'Step 1/5 - Email verification needed';
      }
      if (!member.walletAddress) {
        return 'Step 2/5 - Wallet connection needed';
      }
      return 'Step 3/5 - Application submission needed';
    default:
      return `Unknown status: ${member.status}`;
  }
}

// ============================================
// COMMANDS
// ============================================

async function cmdInfo(identifier: string) {
  const member = await lookupMember(identifier);
  printMember(member);

  // Onboarding progress
  console.log(`\n  Onboarding:      ${getOnboardingStep(member)}`);

  // Bio & profile
  if (member.bio) console.log(`  Bio:             ${member.bio.slice(0, 80)}${member.bio.length > 80 ? '...' : ''}`);
  if ((member as any).profileTags?.length) console.log(`  Tags:            ${(member as any).profileTags.join(', ')}`);

  // Related data counts
  const [emailVerifCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailVerifications)
    .where(eq(emailVerifications.memberId, member.id));

  const [passportVerifCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(passportVerifications)
    .where(eq(passportVerifications.memberId, member.id));

  const [executionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pulseExecutions)
    .where(eq(pulseExecutions.memberId, member.id));

  console.log('\nRELATED DATA');
  console.log('='.repeat(50));
  console.log(`  Email verifications:    ${emailVerifCount.count}`);
  console.log(`  Passport verifications: ${passportVerifCount.count}`);
  console.log(`  Pulse executions:       ${executionCount.count}`);
}

async function cmdReset(identifier: string) {
  const member = await lookupMember(identifier);
  printMember(member, 'BEFORE RESET');

  // Clear verification records
  await db.delete(emailVerifications).where(eq(emailVerifications.memberId, member.id));
  await db.delete(passportVerifications).where(eq(passportVerifications.memberId, member.id));

  // Reset member fields
  const updated = await storage.updateMember(member.id, {
    status: 'pending_id_verification' as any,
    emailVerified: false,
    passportVerified: false,
    ipePassport: null,
    ipeUsername: null,
    memberType: 'pending' as any,
    bio: null,
    twitter: null,
    linkedin: null,
    instagram: null,
    profileTags: null,
  });

  printMember(updated, 'AFTER RESET');
  console.log('\nEmail/passport verification records deleted.');
  console.log('Member reset to pending_id_verification. Ready to re-test onboarding.');
}

async function cmdSetStatus(identifier: string, status: string) {
  if (!MEMBER_STATUSES.includes(status as any)) {
    console.error(`Invalid status: ${status}`);
    console.error(`Valid statuses: ${MEMBER_STATUSES.join(', ')}`);
    process.exit(1);
  }

  const member = await lookupMember(identifier);
  const updated = await storage.updateMemberStatus(member.id, status);
  console.log(`Status changed: ${member.status} -> ${updated.status}`);
  printMember(updated);
}

async function cmdVerifyEmail(identifier: string, email?: string) {
  const member = await lookupMember(identifier);

  if (email) {
    await storage.updateMember(member.id, { email });
    console.log(`Email set to: ${email}`);
  }

  await storage.markEmailVerified(member.id);
  const updated = await storage.getMember(member.id);
  console.log(`Email verified for member ${member.id}`);
  printMember(updated!);
}

async function cmdSubmitApp(identifier: string, username?: string) {
  const member = await lookupMember(identifier);
  const testUsername = username || `testuser${member.id}`;
  const testWallet = member.walletAddress || '0x' + 'a'.repeat(40);

  const updated = await storage.submitApplicationByMemberId(member.id, {
    ipeUsername: testUsername,
    walletAddress: testWallet,
    bio: `Test application for ${testUsername}`,
    profileTags: ['developer', 'researcher'],
  });

  console.log(`Application submitted with username: ${testUsername}`);
  printMember(updated);
}

async function cmdApprove(identifier: string, memberType = 'explorer') {
  if (!MEMBER_TYPES.includes(memberType as any)) {
    console.error(`Invalid member type: ${memberType}`);
    console.error(`Valid types: ${MEMBER_TYPES.join(', ')}`);
    process.exit(1);
  }

  const member = await lookupMember(identifier);
  const updated = await storage.approveApplication(member.id, memberType);
  console.log(`Application approved with type: ${memberType}`);
  console.log('Note: No JustaName subdomain reserved (test mode).');
  printMember(updated);
}

async function cmdDeny(identifier: string) {
  const member = await lookupMember(identifier);
  const updated = await storage.denyApplication(member.id);
  console.log('Application denied.');
  printMember(updated);
}

async function cmdActivate(identifier: string, passport?: string) {
  const member = await lookupMember(identifier);
  const testPassport = passport
    || (member.ipeUsername ? `${member.ipeUsername}.ipecity.eth` : `test${member.id}.ipecity.eth`);

  const updated = await storage.upgradeMemberToActive(member.id, testPassport, member.memberType === 'pending' ? 'explorer' : member.memberType!);
  console.log(`Member activated with passport: ${testPassport}`);
  printMember(updated);
}

async function cmdCreate(args: string[]) {
  const flags = parseFlags(args);
  const email = flags['email'] || undefined;
  const wallet = flags['wallet'] || undefined;
  const status = flags['status'] || 'pending_id_verification';
  const memberType = flags['type'] || 'pending';
  const privyId = flags['privy-id'] || undefined;
  const username = flags['username'] || undefined;

  if (!MEMBER_STATUSES.includes(status as any)) {
    console.error(`Invalid status: ${status}. Valid: ${MEMBER_STATUSES.join(', ')}`);
    process.exit(1);
  }
  if (!MEMBER_TYPES.includes(memberType as any)) {
    console.error(`Invalid type: ${memberType}. Valid: ${MEMBER_TYPES.join(', ')}`);
    process.exit(1);
  }

  let member: Member;
  if (privyId) {
    member = await storage.createMemberFromPrivy(privyId, email, wallet);
    // Update additional fields if needed
    if (status !== 'pending_id_verification' || memberType !== 'pending' || username) {
      member = await storage.updateMember(member.id, {
        status: status as any,
        memberType: memberType as any,
        ...(username ? { ipeUsername: username } : {}),
      });
    }
  } else {
    member = await storage.createMember({
      email,
      walletAddress: wallet,
      status: status as any,
      memberType: memberType as any,
      emailVerified: false,
      passportVerified: false,
      ...(username ? { ipeUsername: username } : {}),
    });
  }

  console.log('Test member created.');
  printMember(member);
}

async function cmdDelete(identifier: string) {
  const member = await lookupMember(identifier);
  printMember(member, 'DELETING MEMBER');

  await storage.deleteMember(member.id);
  console.log(`\nMember ${member.id} and all related data deleted.`);
}

async function cmdList(args: string[]) {
  const flags = parseFlags(args);
  const statusFilter = flags['status'];

  const allMembers = await storage.getAllMembers();
  const filtered = statusFilter
    ? allMembers.filter(m => m.status === statusFilter)
    : allMembers;

  if (filtered.length === 0) {
    console.log(statusFilter ? `No members with status: ${statusFilter}` : 'No members found.');
    return;
  }

  // Header
  console.log('');
  console.log(
    'ID'.padEnd(6) +
    'Status'.padEnd(28) +
    'Type'.padEnd(12) +
    'Email'.padEnd(8) +
    'Pass'.padEnd(7) +
    'Username'.padEnd(18) +
    'Email Address'
  );
  console.log('-'.repeat(100));

  for (const m of filtered) {
    console.log(
      String(m.id).padEnd(6) +
      (m.status || '').padEnd(28) +
      (m.memberType || '').padEnd(12) +
      (m.emailVerified ? 'yes' : 'no').padEnd(8) +
      (m.passportVerified ? 'yes' : 'no').padEnd(7) +
      (m.ipeUsername || '-').padEnd(18) +
      (m.email || '-')
    );
  }

  console.log(`\nTotal: ${filtered.length} member(s)`);
}

// ============================================
// CLI ARGUMENT PARSING
// ============================================

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return flags;
}

function printUsage() {
  console.log(`
Onboarding Testing Toolkit

Usage: npm run onboarding <command> [identifier] [options]

Identifier can be: memberId (number), email, ipeUsername, or privyId

Commands:
  info <id>                    Show full member state and related data
  reset <id>                   Reset member to pending_id_verification
  set-status <id> <status>     Force any valid status
  verify-email <id> [email]    Mark email as verified (skip email flow)
  submit-app <id> [username]   Auto-submit application with test data
  approve <id> [type]          Approve application (default: explorer)
  deny <id>                    Deny application
  activate <id> [passport]     Set to active_member with passport
  create [options]             Create new test member
    --email <email>            Set email
    --wallet <address>         Set wallet address
    --status <status>          Set initial status (default: pending_id_verification)
    --type <type>              Set member type (default: pending)
    --privy-id <id>            Set Privy ID
    --username <name>          Set ipeUsername
  delete <id>                  Delete member and all related data
  list [--status <status>]     List members, optionally filtered by status

Valid statuses: ${MEMBER_STATUSES.join(', ')}
Valid types: ${MEMBER_TYPES.join(', ')}

Examples:
  npm run onboarding info 42
  npm run onboarding reset john@example.com
  npm run onboarding set-status 42 approved_application
  npm run onboarding verify-email 42 newemail@test.com
  npm run onboarding submit-app 42 myusername
  npm run onboarding approve 42 architect
  npm run onboarding activate 42 myuser.ipecity.eth
  npm run onboarding create --email test@x.com --status active_member --type explorer
  npm run onboarding delete 42
  npm run onboarding list --status pending_application_review
`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  await initDb();

  switch (command) {
    case 'info':
      if (!args[1]) { console.error('Usage: info <identifier>'); process.exit(1); }
      await cmdInfo(args[1]);
      break;

    case 'reset':
      if (!args[1]) { console.error('Usage: reset <identifier>'); process.exit(1); }
      await cmdReset(args[1]);
      break;

    case 'set-status':
      if (!args[1] || !args[2]) { console.error('Usage: set-status <identifier> <status>'); process.exit(1); }
      await cmdSetStatus(args[1], args[2]);
      break;

    case 'verify-email':
      if (!args[1]) { console.error('Usage: verify-email <identifier> [email]'); process.exit(1); }
      await cmdVerifyEmail(args[1], args[2]);
      break;

    case 'submit-app':
      if (!args[1]) { console.error('Usage: submit-app <identifier> [username]'); process.exit(1); }
      await cmdSubmitApp(args[1], args[2]);
      break;

    case 'approve':
      if (!args[1]) { console.error('Usage: approve <identifier> [type]'); process.exit(1); }
      await cmdApprove(args[1], args[2]);
      break;

    case 'deny':
      if (!args[1]) { console.error('Usage: deny <identifier>'); process.exit(1); }
      await cmdDeny(args[1]);
      break;

    case 'activate':
      if (!args[1]) { console.error('Usage: activate <identifier> [passport]'); process.exit(1); }
      await cmdActivate(args[1], args[2]);
      break;

    case 'create':
      await cmdCreate(args.slice(1));
      break;

    case 'delete':
      if (!args[1]) { console.error('Usage: delete <identifier>'); process.exit(1); }
      await cmdDelete(args[1]);
      break;

    case 'list':
      await cmdList(args.slice(1));
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message || error);
    process.exit(1);
  });
