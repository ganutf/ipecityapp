/**
 * Migration script: Import data from remote (Neon) database to local PostgreSQL
 *
 * Usage: npx tsx server/scripts/migrate-remote.ts
 *
 * This script:
 * 1. Connects to both DATABASE_URL (local) and DATABASE_URL_REMOTE (remote)
 * 2. Deletes all local member data (test/seed data)
 * 3. Imports remote members, pulses, executions, attestations, etc.
 * 4. Populates member_wallets table from imported wallet addresses
 * 5. Resets all ID sequences
 */

import pg from 'pg';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env
config({ path: resolve(process.cwd(), '.env') });

const { Client } = pg;

const LOCAL_URL = process.env.DATABASE_URL;
const REMOTE_URL = process.env.DATABASE_URL_REMOTE;

if (!LOCAL_URL || !REMOTE_URL) {
  console.error('Missing DATABASE_URL or DATABASE_URL_REMOTE in .env');
  process.exit(1);
}

async function migrate() {
  const local = new Client({ connectionString: LOCAL_URL });
  const remote = new Client({ connectionString: REMOTE_URL });

  try {
    await local.connect();
    await remote.connect();
    console.log('Connected to both databases');

    // ─── Step 1: Clear all local data (reverse dependency order) ───
    console.log('\n--- Step 1: Clearing local data ---');

    await local.query('BEGIN');

    // Delete in reverse FK order
    const deleteTables = [
      'attestations',
      'pulse_executions',
      'user_signers',
      'email_verifications',
      'passport_verifications',
      'member_wallets',
      'pulses',
      'members',
      'pulse_types',
    ];

    for (const table of deleteTables) {
      const result = await local.query(`DELETE FROM ${table}`);
      console.log(`  Deleted ${result.rowCount} rows from ${table}`);
    }

    await local.query('COMMIT');
    console.log('Local data cleared');

    // ─── Step 2: Import pulse_types ───
    console.log('\n--- Step 2: Importing pulse_types ---');

    const { rows: pulseTypes } = await remote.query('SELECT * FROM pulse_types ORDER BY id');
    for (const pt of pulseTypes) {
      await local.query(
        `INSERT INTO pulse_types (id, name, description, created_at) VALUES ($1, $2, $3, $4)`,
        [pt.id, pt.name, pt.description, pt.created_at]
      );
    }
    console.log(`  Imported ${pulseTypes.length} pulse types`);

    // ─── Step 3: Import members ───
    console.log('\n--- Step 3: Importing members ---');

    const { rows: remoteMembers } = await remote.query('SELECT * FROM members ORDER BY id');
    for (const m of remoteMembers) {
      await local.query(
        `INSERT INTO members (id, farcaster_fid, wallet_address, status, member_type, email_verified, passport_verified, email, ipe_username, ipe_passport, bio, twitter, linkedin, instagram, profile_tags, created_at, updated_at, user_id, privy_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          m.id,
          m.farcaster_fid,
          m.wallet_address,
          m.status,
          m.member_type,
          m.email_verified,
          m.passport_verified,
          m.email,
          m.ipe_username,
          m.ipe_passport,
          m.bio,
          m.twitter,
          m.linkedin,
          m.instagram,
          m.profile_tags,
          m.created_at,
          m.updated_at,
          null, // user_id — no auth_users linkage yet
          null, // privy_id — will be linked on first Privy login
        ]
      );
    }
    console.log(`  Imported ${remoteMembers.length} members`);

    // ─── Step 4: Import pulses ───
    console.log('\n--- Step 4: Importing pulses ---');

    const { rows: remotePulses } = await remote.query('SELECT * FROM pulses ORDER BY id');
    for (const p of remotePulses) {
      await local.query(
        `INSERT INTO pulses (id, description, created_by, created_at, points, url_embed, datetime_start, pulse_type_id, interval)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [p.id, p.description, p.created_by, p.created_at, p.points, p.url_embed, p.datetime_start, p.pulse_type_id, p.interval]
      );
    }
    console.log(`  Imported ${remotePulses.length} pulses`);

    // ─── Step 5: Import user_signers ───
    console.log('\n--- Step 5: Importing user_signers ---');

    const { rows: remoteSigners } = await remote.query('SELECT * FROM user_signers ORDER BY id');
    for (const s of remoteSigners) {
      await local.query(
        `INSERT INTO user_signers (id, farcaster_fid, signer_uuid, public_key, status, approval_url, created_at, updated_at, member_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [s.id, s.farcaster_fid, s.signer_uuid, s.public_key, s.status, s.approval_url, s.created_at, s.updated_at, s.member_id]
      );
    }
    console.log(`  Imported ${remoteSigners.length} user signers`);

    // ─── Step 6: Import email_verifications ───
    console.log('\n--- Step 6: Importing email_verifications ---');

    const { rows: remoteEmailVer } = await remote.query('SELECT * FROM email_verifications ORDER BY id');
    for (const e of remoteEmailVer) {
      await local.query(
        `INSERT INTO email_verifications (id, farcaster_fid, email, verification_code, expires_at, verified, created_at, member_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [e.id, e.farcaster_fid, e.email, e.verification_code, e.expires_at, e.verified, e.created_at, e.member_id]
      );
    }
    console.log(`  Imported ${remoteEmailVer.length} email verifications`);

    // ─── Step 7: Import passport_verifications ───
    console.log('\n--- Step 7: Importing passport_verifications ---');

    const { rows: remotePassportVer } = await remote.query('SELECT * FROM passport_verifications ORDER BY id');
    for (const pv of remotePassportVer) {
      await local.query(
        `INSERT INTO passport_verifications (id, farcaster_fid, ipe_passport, verification_token, challenge_message, verified, verified_at, expires_at, created_at, member_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [pv.id, pv.farcaster_fid, pv.ipe_passport, pv.verification_token, pv.challenge_message, pv.verified, pv.verified_at, pv.expires_at, pv.created_at, pv.member_id]
      );
    }
    console.log(`  Imported ${remotePassportVer.length} passport verifications`);

    // ─── Step 8: Import pulse_executions ───
    console.log('\n--- Step 8: Importing pulse_executions ---');

    const { rows: remoteExecs } = await remote.query('SELECT * FROM pulse_executions ORDER BY id');
    for (const ex of remoteExecs) {
      // Remote uses varchar for actions, local uses jsonb
      let actionsJsonb: unknown;
      try {
        actionsJsonb = typeof ex.actions === 'string' ? JSON.parse(ex.actions) : ex.actions;
      } catch {
        actionsJsonb = { raw: ex.actions };
      }

      await local.query(
        `INSERT INTO pulse_executions (id, pulse_id, member_id, actions, executed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [ex.id, ex.pulse_id, ex.member_id, JSON.stringify(actionsJsonb), ex.executed_at]
      );
    }
    console.log(`  Imported ${remoteExecs.length} pulse executions`);

    // ─── Step 9: Import attestations ───
    console.log('\n--- Step 9: Importing attestations ---');

    const { rows: remoteAttestations } = await remote.query('SELECT * FROM attestations ORDER BY id');
    for (const a of remoteAttestations) {
      await local.query(
        `INSERT INTO attestations (id, pulse_execution_id, attestation_uid, transaction_hash, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [a.id, a.pulse_execution_id, a.attestation_uid, a.transaction_hash, a.status, a.created_at]
      );
    }
    console.log(`  Imported ${remoteAttestations.length} attestations`);

    // ─── Step 10: Populate member_wallets ───
    console.log('\n--- Step 10: Populating member_wallets ---');

    const membersWithWallets = remoteMembers.filter((m: { wallet_address: string | null }) => m.wallet_address);
    for (const m of membersWithWallets) {
      await local.query(
        `INSERT INTO member_wallets (member_id, wallet_address, wallet_type, linked_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (wallet_address) DO NOTHING`,
        [m.id, m.wallet_address.toLowerCase(), 'external']
      );
    }
    console.log(`  Created ${membersWithWallets.length} member_wallets entries`);

    // ─── Step 11: Reset sequences ───
    console.log('\n--- Step 11: Resetting sequences ---');

    const sequences = [
      { table: 'members', seq: 'members_id_seq' },
      { table: 'pulses', seq: 'pulses_id_seq' },
      { table: 'pulse_types', seq: 'pulse_types_id_seq' },
      { table: 'pulse_executions', seq: 'pulse_executions_id_seq' },
      { table: 'attestations', seq: 'attestations_id_seq' },
      { table: 'user_signers', seq: 'user_signers_id_seq' },
      { table: 'email_verifications', seq: 'email_verifications_id_seq' },
      { table: 'passport_verifications', seq: 'passport_verifications_id_seq' },
      { table: 'member_wallets', seq: 'member_wallets_id_seq' },
    ];

    for (const { table, seq } of sequences) {
      const { rows } = await local.query(`SELECT COALESCE(MAX(id), 0) + 1 as next_val FROM ${table}`);
      await local.query(`SELECT setval('${seq}', $1, false)`, [rows[0].next_val]);
      console.log(`  ${seq} → ${rows[0].next_val}`);
    }

    // ─── Summary ───
    console.log('\n=== Migration Complete ===');
    console.log(`Members: ${remoteMembers.length}`);
    console.log(`Pulses: ${remotePulses.length}`);
    console.log(`Pulse Types: ${pulseTypes.length}`);
    console.log(`Executions: ${remoteExecs.length}`);
    console.log(`Attestations: ${remoteAttestations.length}`);
    console.log(`User Signers: ${remoteSigners.length}`);
    console.log(`Member Wallets: ${membersWithWallets.length}`);
    console.log('\nNote: Remote users have privy_id=NULL. They will be auto-linked on first Privy login.');

  } catch (error) {
    console.error('Migration failed:', error);
    try {
      await local.query('ROLLBACK');
    } catch {
      // Ignore rollback errors
    }
    process.exit(1);
  } finally {
    await local.end();
    await remote.end();
  }
}

migrate();
