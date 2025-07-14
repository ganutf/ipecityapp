#!/usr/bin/env tsx
/**
 * Key Migration Script for Ipê City Pulse
 * 
 * This script migrates sensitive environment variables to encrypted storage
 * and provides a secure way to manage cryptographic keys.
 */

import { initializeKeyManager, migrateEnvironmentVariablesToSecureStorage } from '../lib/keyManagement';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Environment variables to migrate to secure storage
 */
const VARIABLES_TO_MIGRATE = {
  'farcaster_developer_mnemonic': 'FARCASTER_DEVELOPER_MNEMONIC',
  'neynar_api_key': 'NEYNAR_API_KEY',
  'justaname_api_key': 'JUSTANAME_API_KEY',
  'resend_api_key': 'RESEND_API_KEY',
  'session_secret': 'SESSION_SECRET',
  'database_url': 'DATABASE_URL'
};

/**
 * Generate a secure master password for key encryption
 */
function generateMasterPassword(): string {
  // Generate a 64-character random password
  return randomBytes(32).toString('hex');
}

/**
 * Store master password securely (in production, this should be in a secure vault)
 */
function storeMasterPassword(password: string): void {
  const masterKeyPath = join(process.cwd(), '.master-key');
  writeFileSync(masterKeyPath, password, { mode: 0o600 });
  console.log('Master password stored at:', masterKeyPath);
  console.warn('⚠️  IMPORTANT: In production, store this master password in a secure key vault or HSM');
}

/**
 * Load master password from file
 */
function loadMasterPassword(): string | null {
  try {
    const masterKeyPath = join(process.cwd(), '.master-key');
    return readFileSync(masterKeyPath, 'utf8').trim();
  } catch (error) {
    return null;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🔐 Starting secure key migration for Ipê City Pulse...\n');

  try {
    // Check if master password exists, generate if not
    let masterPassword = loadMasterPassword();
    if (!masterPassword) {
      console.log('Generating new master password...');
      masterPassword = generateMasterPassword();
      storeMasterPassword(masterPassword);
    } else {
      console.log('Using existing master password...');
    }

    // Initialize the key manager
    const keyManager = initializeKeyManager(masterPassword);
    console.log('✅ Key manager initialized successfully\n');

    // Migrate environment variables to secure storage
    console.log('Migrating environment variables to secure storage...');
    console.log('Environment variables to check:');
    Object.entries(VARIABLES_TO_MIGRATE).forEach(([keyName, envVarName]) => {
      const exists = !!process.env[envVarName];
      console.log(`  ${envVarName} -> ${keyName}: ${exists ? '✓' : '✗'}`);
    });
    await migrateEnvironmentVariablesToSecureStorage(VARIABLES_TO_MIGRATE);
    console.log('✅ Environment variables migrated successfully\n');

    // List all stored keys for verification
    const storedKeys = await keyManager.listKeys();
    console.log('📋 Keys stored in secure storage:');
    storedKeys.forEach(key => {
      console.log(`  - ${key}`);
    });

    // Verify that the most critical key (mnemonic) was stored
    const mnemonicExists = keyManager.keyExists('farcaster_developer_mnemonic');
    if (mnemonicExists) {
      console.log('\n✅ Farcaster developer mnemonic securely stored');
      
      // Test retrieval to ensure encryption/decryption works
      const retrievedMnemonic = await keyManager.retrieveKey('farcaster_developer_mnemonic');
      if (retrievedMnemonic && retrievedMnemonic.split(' ').length === 24) {
        console.log('✅ Mnemonic retrieval test successful (24 words detected)');
      } else {
        console.error('❌ Mnemonic retrieval test failed');
      }
    } else {
      console.warn('⚠️  Farcaster developer mnemonic not found in environment variables');
    }

    console.log('\n🎉 Key migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your application code to use getSecureEnvironmentVariable()');
    console.log('2. Remove sensitive variables from .env file');
    console.log('3. Add .master-key and .keys/ to .gitignore');
    console.log('4. In production, use a proper key management service');

  } catch (error) {
    console.error('❌ Key migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as migrateKeys };