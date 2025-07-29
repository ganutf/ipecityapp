#!/usr/bin/env tsx
/**
 * Attestation Creation Script for Ipê City Pulse
 * 
 * This script processes completed pulse executions and creates EAS attestations
 * for members who have verified passports. It runs after the 24-hour pulse window closes.
 */

import { storage } from '../storage';
import { easService } from '../lib/easService';
import { initializeDatabase, getDatabase } from '../db';
import { initializeKeyManager } from '../lib/keyManagement';
import { config } from 'dotenv';

// Load environment variables
config();

interface AttestationJobResult {
  processed: number;
  successful: number;
  failed: number;
  retried: number;
  errors: Array<{ executionId: number; error: string; attempts: number }>;
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 2000, // 2 seconds
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  
  // Network and connectivity issues - retryable
  const networkErrors = [
    'network error',
    'network timeout',
    'connection timeout',
    'connection reset',
    'connection refused',
    'socket timeout',
    'fetch failed',
    'enotfound',
    'etimedout'
  ];
  
  // Gas and transaction issues - some retryable
  const gasErrorsRetryable = [
    'insufficient funds for gas', // might resolve if gas price drops
    'gas limit exceeded', // might work with lower gas
    'max fee per gas less than block base fee'
  ];
  
  // Nonce issues - retryable
  const nonceErrors = [
    'nonce too low',
    'nonce has already been used',
    'transaction nonce is too low'
  ];
  
  // Rate limiting - retryable
  const rateLimitErrors = [
    'rate limit',
    'too many requests',
    'service unavailable',
    'temporary failure',
    '429'
  ];
  
  // RPC provider issues - retryable
  const rpcErrors = [
    'internal json-rpc error',
    'execution reverted', // might be temporary
    'transaction underpriced'
  ];
  
  // Check all retryable categories
  const allRetryableErrors = [
    ...networkErrors,
    ...gasErrorsRetryable,
    ...nonceErrors,
    ...rateLimitErrors,
    ...rpcErrors
  ];
  
  // Non-retryable errors (permanent failures)
  const permanentErrors = [
    'invalid signature',
    'invalid schema',
    'schema not found',
    'invalid recipient',
    'invalid attestation data',
    'unauthorized',
    'forbidden',
    'not found',
    'bad request'
  ];
  
  // Check if it's a permanent error first
  if (permanentErrors.some(msg => errorMessage.includes(msg))) {
    return false;
  }
  
  // Check if it's a retryable error
  return allRetryableErrors.some(msg => errorMessage.includes(msg));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
}

/**
 * Create attestation with retry logic
 */
async function createAttestationWithRetry(
  execution: any,
  member: any,
  pulse: any,
  result: AttestationJobResult
): Promise<boolean> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      console.log(`\n📝 Processing attestation for member ${member.ipePassport} (pulse ${pulse.id}) - Attempt ${attempt}/${RETRY_CONFIG.maxAttempts}`);
      
      // Get or create attestation record
      let pendingAttestation = await storage.getAttestation(execution.id);
      
      if (!pendingAttestation) {
        // No record exists, create one (only on first attempt)
        if (attempt === 1) {
          try {
            pendingAttestation = await storage.createAttestation({
              pulseExecutionId: execution.id,
              status: 'pending'
            });
            console.log(`📋 Created pending attestation record (ID: ${pendingAttestation.id})`);
          } catch (dbError: any) {
            // Check if this is a unique constraint violation (race condition)
            if (dbError.message && dbError.message.includes('unique constraint')) {
              console.log(`⚠️  Race condition detected, getting existing attestation...`);
              pendingAttestation = await storage.getAttestation(execution.id);
              if (!pendingAttestation) {
                throw new Error('Failed to get attestation after race condition');
              }
            } else {
              throw dbError; // Re-throw if it's a different error
            }
          }
        } else {
          throw new Error('Attestation record not found for retry');
        }
      } else {
        // Existing record found
        if (pendingAttestation.status === 'completed') {
          console.log(`✅ Attestation already completed for execution ${execution.id}, skipping...`);
          return true; // Already completed successfully
        }
        
        if (attempt === 1) {
          console.log(`🔄 Found existing attestation record (ID: ${pendingAttestation.id}, status: ${pendingAttestation.status})`);
        } else {
          console.log(`🔄 Retrying attestation creation (Record ID: ${pendingAttestation.id}, attempt ${attempt})`);
          result.retried++;
        }
      }

      // Create the actual EAS attestation
      const attestationResult = await easService.createAttestation({
        memberOnchainID: member.ipePassport!,
        memberWalletAddress: member.walletAddress!,
        pulseNumber: pulse.id,
        executedAt: execution.executedAt ? Math.floor(new Date(execution.executedAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
        actionsExecuted: JSON.stringify(execution.actions)
      });

      // Update the attestation record with the results
      await storage.updateAttestationStatus(
        pendingAttestation.id,
        'completed',
        attestationResult.attestationUID,
        attestationResult.transactionHash
      );

      console.log(`✅ Attestation completed successfully (UID: ${attestationResult.attestationUID})`);
      return true;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Attempt ${attempt} failed for execution ${execution.id}:`, lastError.message);
      
      // If this isn't a retryable error or it's the last attempt, don't retry
      if (!isRetryableError(lastError) || attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }
      
      // Wait before retrying
      const delay = getRetryDelay(attempt);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  // All attempts failed
  result.errors.push({
    executionId: execution.id,
    error: lastError?.message || 'Unknown error',
    attempts: RETRY_CONFIG.maxAttempts
  });

  // Try to update the attestation status to failed if it exists
  try {
    const existingAttestation = await storage.getAttestation(execution.id);
    if (existingAttestation) {
      await storage.updateAttestationStatus(existingAttestation.id, 'failed');
    }
  } catch (updateError) {
    console.error(`Failed to update attestation status to failed:`, updateError);
  }
  
  return false;
}

/**
 * Process pending attestations
 */
async function processAttestations(): Promise<AttestationJobResult> {
  const result: AttestationJobResult = {
    processed: 0,
    successful: 0,
    failed: 0,
    retried: 0,
    errors: []
  };

  try {
    console.log('🔍 Fetching pending attestations...');
    
    // Get all pulse executions that need attestations
    const pendingAttestations = await storage.getPendingAttestations();
    
    console.log(`📊 Found ${pendingAttestations.length} pending attestations`);
    
    if (pendingAttestations.length === 0) {
      console.log('✅ No pending attestations to process');
      return result;
    }

    // Validate EAS service configuration
    console.log('🔧 Validating EAS service configuration...');
    const isValid = await easService.validateConfiguration();
    if (!isValid) {
      throw new Error('EAS service configuration is invalid');
    }

    console.log(`🚀 Processing ${pendingAttestations.length} attestations...`);

    for (const { execution, member, pulse } of pendingAttestations) {
      result.processed++;
      
      const success = await createAttestationWithRetry(execution, member, pulse, result);
      
      if (success) {
        result.successful++;
      } else {
        result.failed++;
      }
      
      // Add a small delay between attestations to avoid rate limiting
      await sleep(1000);
    }

    return result;

  } catch (error) {
    console.error('💥 Fatal error in attestation processing:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🏛️ Starting EAS Attestation Creation Job...\n');
  
  const startTime = Date.now();
  
  try {
    // Initialize key manager first (for secure storage)
    try {
      initializeKeyManager();
      console.log('✅ Key manager initialized');
    } catch (error) {
      console.log('⚠️  Key manager not available, using environment variables');
    }

    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connection initialized');

    // Test database connection
    const { db } = getDatabase();
    await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful\n');

    const result = await processAttestations();
    
    const duration = Date.now() - startTime;
    
    console.log('\n📊 ATTESTATION JOB SUMMARY');
    console.log('============================');
    console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📝 Processed: ${result.processed}`);
    console.log(`✅ Successful: ${result.successful}`);
    console.log(`🔄 Retried: ${result.retried}`);
    console.log(`❌ Failed: ${result.failed}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      result.errors.forEach(({ executionId, error, attempts }) => {
        console.log(`  - Execution ${executionId} (${attempts} attempts): ${error}`);
      });
    }
    
    console.log('\n🎉 Attestation creation job completed!');
    
    // Exit with error code if there were failures
    if (result.failed > 0) {
      console.log(`\n⚠️  Job completed with ${result.failed} failures`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Attestation creation job failed:', error);
    process.exit(1);
  }
}

// Export the main function for use in other modules
export { main as createAttestations };

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}