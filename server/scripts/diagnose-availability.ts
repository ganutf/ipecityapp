#!/usr/bin/env tsx
import 'dotenv/config';
import { initializeDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';
import { storage } from '../storage';
import { PassportService } from '../services/PassportService';

const USERNAME = process.argv[2];
if (!USERNAME) {
  console.error('Usage: tsx server/scripts/diagnose-availability.ts <username>');
  process.exit(1);
}

async function main() {
  try { initializeKeyManager(); } catch {}
  await initializeDatabase();

  const svc = new PassportService(storage);

  console.log(`\nDB  getMemberByIpePassport("${USERNAME}"):`);
  const dbHit = await storage.getMemberByIpePassport(USERNAME);
  console.log(dbHit ? { id: dbHit.id, status: dbHit.status, email: dbHit.email } : 'no match');

  console.log(`\nSVC checkUsernameAvailability("${USERNAME}"):`);
  const result = await svc.checkUsernameAvailability(USERNAME);
  console.log(result);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
