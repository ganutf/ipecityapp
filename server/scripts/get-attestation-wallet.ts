#!/usr/bin/env tsx

import 'dotenv/config';
import { ethers } from 'ethers';
import { initializeKeyManager, getSecureEnvironmentVariable } from '../lib/keyManagement';
import logger from '../logger';

async function getAttestationWalletAddress() {
  try {
    // Initialize key manager with master password
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    
    try {
      const masterKeyPath = join(process.cwd(), '.master-key');
      const masterPassword = readFileSync(masterKeyPath, 'utf8').trim();
      initializeKeyManager(masterPassword);
    } catch (error) {
      // If no master key file, try environment variable
      if (process.env.MASTER_PASSWORD) {
        initializeKeyManager(process.env.MASTER_PASSWORD);
      } else {
        console.warn('⚠️  No master password found, trying to use direct environment variables');
        // Don't initialize key manager - will fall back to env vars
      }
    }
    
    const mnemonic = await getSecureEnvironmentVariable('eas_attestation_mnemonic', 'EAS_ATTESTATION_MNEMONIC');
    
    if (!mnemonic) {
      logger.error('EAS_ATTESTATION_MNEMONIC is not available in secure storage or environment variables');
      console.error('❌ EAS_ATTESTATION_MNEMONIC is not available in secure storage or environment variables');
      process.exit(1);
    }

    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromPhrase(mnemonic);
    
    logger.info('Retrieved EAS attestation wallet address', { address: wallet.address });
    
    console.log('🔗 EAS Attestation Wallet Address:');
    console.log(wallet.address);
    console.log('\n💡 Send ETH to this address for gas fees when creating attestations');
    
  } catch (error) {
    logger.error('Error getting attestation wallet address', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('Error getting attestation wallet address:', error);
    process.exit(1);
  }
}

getAttestationWalletAddress();