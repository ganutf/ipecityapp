#!/usr/bin/env tsx
/**
 * JustaName → ENS On-Chain Migration Script
 *
 * One-time script to migrate all existing *.ipecity.eth subdomains from JustaName
 * to direct ENS Registry control. After migration, subdomains are owned by each
 * member's wallet address and can be revoked by the admin wallet at any time.
 *
 * Uses the DB as the source of truth — every issued passport is recorded in the
 * members table (ipePassport column), so we don't need to call the JustaName API
 * to enumerate subdomains.
 *
 * Usage:
 *   npm run migrate:justaname-to-ens -- --dry-run
 *   npm run migrate:justaname-to-ens -- --skip-existing
 *   npm run migrate:justaname-to-ens
 *
 * Flags:
 *   --dry-run        Print what would happen, no ENS transactions
 *   --skip-existing  Skip subdomains already registered on-chain (safe for re-runs)
 */

import { config } from 'dotenv';
config();

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../db';
import { storage } from '../storage';
import { EnsSubdomainService } from '../lib/ensSubdomainService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  backoffMultiplier: 2,
};

// Delay between transactions — give mainnet time to confirm
const TX_DELAY_MS = 3000;

// ============================================
// TYPES
// ============================================

type MigrationStatus = 'migrated' | 'skipped_existing' | 'skipped_no_address' | 'failed' | 'dry_run';

interface MigrationResult {
  ens: string;
  username: string;
  memberId: number;
  walletAddress: string | null;
  status: MigrationStatus;
  txHash?: string;
  error?: string;
  attempts: number;
}

interface MigrationSummary {
  total: number;
  migrated: number;
  skippedExisting: number;
  skippedNoAddress: number;
  failed: number;
  dryRun: number;
  errors: Array<{ ens: string; error: string; attempts: number }>;
  results: MigrationResult[];
}

// ============================================
// HELPERS
// ============================================

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseFlags() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
  };
}

async function createWithRetry(
  ensService: EnsSubdomainService,
  username: string,
  walletAddress: string,
): Promise<string> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const txHash = await ensService.createSubdomain(username, walletAddress);
      return txHash;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < RETRY_CONFIG.maxAttempts) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
        console.log(`   ⚠️  Attempt ${attempt} failed, retrying in ${delay / 1000}s... (${lastError.message})`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function saveResults(summary: MigrationSummary): string {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `migrate-justaname-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  return outputPath;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const { dryRun, skipExisting } = parseFlags();

  console.log('🌿 JustaName → ENS On-Chain Migration');
  console.log('======================================');
  if (dryRun) console.log('🔍 DRY RUN MODE — no transactions will be sent\n');
  if (skipExisting) console.log('⏭️  SKIP EXISTING — will skip subdomains already on-chain\n');

  // ── Initialize database ───────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }
  await initializeDatabase();

  // ── Validate environment ──────────────────────────────────────────────────
  const ensMnemonic = process.env.ENS_ADMIN_MNEMONIC;

  if (!ensMnemonic && !dryRun) {
    console.error('❌ ENS_ADMIN_MNEMONIC is not set (required for non-dry-run)');
    process.exit(1);
  }

  // ── Init ENS service ──────────────────────────────────────────────────────
  const ensService = ensMnemonic ? new EnsSubdomainService(ensMnemonic) : null;
  if (ensService) {
    console.log(`🔑 ENS admin wallet: ${ensService.getAdminAddress()}`);
  }

  // ── Fetch members with passports from DB ──────────────────────────────────
  console.log('\n📡 Fetching members with passports from database...');
  const allMembers = await storage.getAllMembers();
  const membersWithPassport = allMembers.filter(
    (m) => m.ipePassport && m.ipePassport.endsWith('.ipecity.eth'),
  );

  console.log(`   Found ${allMembers.length} total members, ${membersWithPassport.length} with ipecity.eth passports\n`);

  if (membersWithPassport.length === 0) {
    console.log('ℹ️  No members with passports found. Nothing to migrate.');
    process.exit(0);
  }

  // ── Process each subdomain ────────────────────────────────────────────────
  const summary: MigrationSummary = {
    total: membersWithPassport.length,
    migrated: 0,
    skippedExisting: 0,
    skippedNoAddress: 0,
    failed: 0,
    dryRun: 0,
    errors: [],
    results: [],
  };

  console.log(`Processing ${membersWithPassport.length} subdomains...\n`);

  for (let i = 0; i < membersWithPassport.length; i++) {
    const member = membersWithPassport[i];
    const ens = member.ipePassport!;
    // Extract username (everything before .ipecity.eth)
    const username = ens.replace('.ipecity.eth', '');
    const progress = `[${i + 1}/${membersWithPassport.length}]`;

    const result: MigrationResult = {
      ens,
      username,
      memberId: member.id,
      walletAddress: null,
      status: 'failed',
      attempts: 0,
    };

    try {
      // 1. Resolve wallet address from DB
      const walletAddress = member.walletAddress ?? null;
      result.walletAddress = walletAddress;

      if (!walletAddress) {
        console.log(`${progress} ⚠️  ${ens} (member #${member.id}) — no wallet address, skipping`);
        result.status = 'skipped_no_address';
        summary.skippedNoAddress++;
        summary.results.push(result);
        continue;
      }

      // 2. Skip if already on-chain
      if (skipExisting && ensService) {
        const exists = await ensService.subdomainExists(username);
        if (exists) {
          console.log(`${progress} ⏭️  ${ens} — already on-chain, skipping`);
          result.status = 'skipped_existing';
          summary.skippedExisting++;
          summary.results.push(result);
          continue;
        }
      }

      // 3. Dry run — just print
      if (dryRun) {
        console.log(`${progress} 🔍 ${ens} → ${walletAddress}`);
        result.status = 'dry_run';
        summary.dryRun++;
        summary.results.push(result);
        continue;
      }

      // 4. Create on-chain
      console.log(`${progress} ⏳ ${ens} → ${walletAddress}...`);
      result.attempts = 1;

      let txHash: string;
      try {
        txHash = await createWithRetry(ensService!, username, walletAddress);
      } catch (retryError) {
        result.attempts = RETRY_CONFIG.maxAttempts;
        throw retryError;
      }

      result.txHash = txHash;
      result.status = 'migrated';
      summary.migrated++;
      console.log(`${progress} ✅ ${ens} — tx: ${txHash}`);

      // Delay between transactions
      if (i < membersWithPassport.length - 1) {
        await sleep(TX_DELAY_MS);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      result.error = errorMessage;
      summary.failed++;
      summary.errors.push({ ens, error: errorMessage, attempts: result.attempts });
      console.error(`${progress} ❌ ${ens} — ${errorMessage}`);
    }

    summary.results.push(result);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n======================================');
  console.log('📊 Migration Summary');
  console.log('======================================');
  console.log(`Total subdomains:    ${summary.total}`);
  if (dryRun) {
    console.log(`Would migrate:       ${summary.dryRun}`);
  } else {
    console.log(`Migrated:            ${summary.migrated}`);
  }
  console.log(`Skipped (existing):  ${summary.skippedExisting}`);
  console.log(`Skipped (no addr):   ${summary.skippedNoAddress}`);
  console.log(`Failed:              ${summary.failed}`);

  if (summary.errors.length > 0) {
    console.log('\n❌ Failures:');
    for (const { ens, error, attempts } of summary.errors) {
      console.log(`   ${ens} (${attempts} attempts): ${error}`);
    }
  }

  // ── Save results ──────────────────────────────────────────────────────────
  const outputPath = saveResults(summary);
  console.log(`\n💾 Results saved to: ${outputPath}`);

  // Exit with error code if any failures
  if (summary.failed > 0) {
    console.log('\n⚠️  Some migrations failed. Re-run with --skip-existing to retry only failures.');
    process.exit(1);
  }

  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
