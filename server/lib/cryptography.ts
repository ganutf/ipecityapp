/**
 * Secure Cryptographic Operations for Ipê Platform
 * 
 * This module provides secure signature verification for both EOA wallets
 * and smart contract wallets, implementing industry-standard cryptographic
 * practices and proper EIP-1271 support.
 */

import { SiweMessage } from 'siwe';
import { isAddress } from 'viem';
import { createPublicClient, http, getContract } from 'viem';
import { mainnet } from 'viem/chains';
import { randomBytes, createHash } from 'crypto';

// EIP-1271 Magic Value for valid signatures
const EIP1271_MAGIC_VALUE = '0x1626ba7e';

// Create a public client for contract verification
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

/**
 * EIP-1271 contract interface for signature verification
 */
const EIP1271_ABI = [
  {
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' }
    ],
    name: 'isValidSignature',
    outputs: [{ name: 'magicValue', type: 'bytes4' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Enhanced signature verification result
 */
export interface SignatureVerificationResult {
  success: boolean;
  walletType: 'eoa' | 'smart_contract' | 'unknown';
  verificationMethod: 'eip191' | 'eip1271' | 'content_only' | 'failed';
  error?: string;
  details?: {
    contractAddress?: string;
    signatureLength: number;
    messageHash?: string;
  };
}

/**
 * Secure nonce generation for message uniqueness
 */
export function generateSecureNonce(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate message timestamp to prevent replay attacks
 */
export function validateMessageTimestamp(
  issuedAt: string, 
  expirationTime?: string,
  clockSkewTolerance: number = 300 // 5 minutes
): boolean {
  const now = new Date();
  const issued = new Date(issuedAt);
  const timeDiff = (now.getTime() - issued.getTime()) / 1000;

  // Check if message is too old or from the future
  if (Math.abs(timeDiff) > clockSkewTolerance) {
    return false;
  }

  // Check expiration if provided
  if (expirationTime) {
    const expiration = new Date(expirationTime);
    if (now > expiration) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an address is a smart contract
 */
export async function isSmartContract(address: string): Promise<boolean> {
  try {
    if (!isAddress(address)) {
      return false;
    }

    const bytecode = await publicClient.getBytecode({
      address: address as `0x${string}`
    });

    // Contract has bytecode, EOA has null/undefined
    const hasCode = bytecode !== undefined && bytecode !== '0x';
    
    console.log(`Smart contract check for ${address}: ${hasCode ? 'SMART CONTRACT' : 'EOA'}`);
    return hasCode;
  } catch (error) {
    console.error('Error checking if address is smart contract:', error);
    // On error, assume it's a smart contract for security
    return true;
  }
}

/**
 * Detect if signature is from a smart contract wallet based on signature characteristics
 */
export function isSmartContractSignature(signature: string): boolean {
  // Standard EOA signatures are 65 bytes (130 hex chars + 0x prefix = 132 chars)
  // Smart contract signatures are typically much longer
  const standardEOALength = 132;
  const isLongSignature = signature.length > standardEOALength * 2;
  
  // Check for known smart contract wallet patterns
  const hasSmartContractPatterns = 
    signature.includes('ca11bde05977b3631167028862be2a173976ca11') || // Coinbase Smart Wallet
    signature.includes('webauthn.get') || // WebAuthn signatures
    signature.length > 1000; // Very long signatures are typically smart contracts
  
  return isLongSignature || hasSmartContractPatterns;
}

/**
 * Verify signature using EIP-1271 for smart contracts
 */
export async function verifyEIP1271Signature(
  contractAddress: string,
  messageHash: string,
  signature: string
): Promise<boolean> {
  try {
    if (!isAddress(contractAddress)) {
      throw new Error('Invalid contract address');
    }

    const contract = getContract({
      address: contractAddress as `0x${string}`,
      abi: EIP1271_ABI,
      client: publicClient
    });

    const result = await contract.read.isValidSignature([
      messageHash as `0x${string}`,
      signature as `0x${string}`
    ]);

    return result === EIP1271_MAGIC_VALUE;
  } catch (error) {
    console.error('EIP-1271 verification failed:', error);
    return false;
  }
}

/**
 * Enhanced SIWE message validation
 */
export function validateSiweMessage(
  message: string,
  expectedAddress: string,
  expectedDomain: string,
  requiredStatement?: string
): { valid: boolean; siweMessage?: SiweMessage; error?: string } {
  try {
    const siweMessage = new SiweMessage(message);

    // Validate address match
    if (siweMessage.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { valid: false, error: 'Address mismatch in SIWE message' };
    }

    // Validate domain
    if (siweMessage.domain !== expectedDomain) {
      return { valid: false, error: 'Domain mismatch in SIWE message' };
    }

    // Validate required statement if provided
    if (requiredStatement && !siweMessage.statement?.includes(requiredStatement)) {
      return { valid: false, error: 'Required statement not found in message' };
    }

    // Validate timestamp
    if (siweMessage.issuedAt && !validateMessageTimestamp(siweMessage.issuedAt, siweMessage.expirationTime)) {
      return { valid: false, error: 'Message timestamp validation failed' };
    }

    return { valid: true, siweMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: `SIWE message parsing failed: ${errorMessage}` };
  }
}

/**
 * Comprehensive signature verification for both EOA and smart contract wallets
 */
export async function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string,
  options: {
    domain?: string;
    requiredStatement?: string;
    allowContentOnlyVerification?: boolean;
  } = {}
): Promise<SignatureVerificationResult> {
  const { 
    domain = 'localhost:5000', 
    requiredStatement,
    allowContentOnlyVerification = false 
  } = options;

  try {
    // First validate the SIWE message format and content
    const messageValidation = validateSiweMessage(message, expectedAddress, domain, requiredStatement);
    if (!messageValidation.valid || !messageValidation.siweMessage) {
      return {
        success: false,
        walletType: 'unknown',
        verificationMethod: 'failed',
        error: messageValidation.error,
        details: { signatureLength: signature.length }
      };
    }

    const siweMessage = messageValidation.siweMessage;

    // Determine if the address is a smart contract
    // Use both on-chain detection and signature characteristics
    const isContract = await isSmartContract(expectedAddress);
    const hasSmartContractSig = isSmartContractSignature(signature);
    const walletType = (isContract || hasSmartContractSig) ? 'smart_contract' : 'eoa';
    
    console.log(`Wallet type detection: on-chain=${isContract}, signature-based=${hasSmartContractSig}, final=${walletType}`);

    if (walletType === 'eoa') {
      // For EOA wallets, use standard SIWE verification
      try {
        const verificationResult = await siweMessage.verify({ signature });
        return {
          success: verificationResult.success,
          walletType: 'eoa',
          verificationMethod: 'eip191',
          details: {
            signatureLength: signature.length,
            messageHash: (verificationResult.data as any)?.message || undefined
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          walletType: 'eoa',
          verificationMethod: 'failed',
          error: `EOA signature verification failed: ${errorMessage}`,
          details: { signatureLength: signature.length }
        };
      }
    } else {
      // For smart contract wallets, try EIP-1271 verification
      try {
        // Generate the message hash that would be signed
        const messageHash = siweMessage.toMessage();
        const hash = createHash('sha256').update(messageHash, 'utf8').digest();
        const hashHex = '0x' + hash.toString('hex');

        const eip1271Valid = await verifyEIP1271Signature(expectedAddress, hashHex, signature);
        
        if (eip1271Valid) {
          return {
            success: true,
            walletType: 'smart_contract',
            verificationMethod: 'eip1271',
            details: {
              contractAddress: expectedAddress,
              signatureLength: signature.length,
              messageHash: hashHex
            }
          };
        }

        // If EIP-1271 fails and content-only verification is allowed as fallback
        if (allowContentOnlyVerification) {
          console.warn(`EIP-1271 verification failed for ${expectedAddress}, falling back to content-only verification`);
          return {
            success: true,
            walletType: 'smart_contract',
            verificationMethod: 'content_only',
            error: 'Fallback to content-only verification due to EIP-1271 failure',
            details: {
              contractAddress: expectedAddress,
              signatureLength: signature.length
            }
          };
        }

        return {
          success: false,
          walletType: 'smart_contract',
          verificationMethod: 'failed',
          error: 'EIP-1271 verification failed and content-only verification not allowed',
          details: {
            contractAddress: expectedAddress,
            signatureLength: signature.length,
            messageHash: hashHex
          }
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          walletType: 'smart_contract',
          verificationMethod: 'failed',
          error: `Smart contract signature verification failed: ${errorMessage}`,
          details: {
            contractAddress: expectedAddress,
            signatureLength: signature.length
          }
        };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      walletType: 'unknown',
      verificationMethod: 'failed',
      error: `Signature verification error: ${errorMessage}`,
      details: { signatureLength: signature.length }
    };
  }
}

/**
 * Generate a secure challenge message for wallet verification
 */
export function generateChallengeMessage(
  address: string,
  domain: string,
  statement: string,
  nonce?: string
): string {
  const challengeNonce = nonce || generateSecureNonce();
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  return `${domain} wants you to sign in with your Ethereum account:
${address}

${statement}

URI: https://${domain}
Version: 1
Chain ID: 1
Nonce: ${challengeNonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;
}

/**
 * Enhanced security audit logging for signature verification
 */
export function logSignatureVerification(
  result: SignatureVerificationResult,
  address: string,
  userAgent?: string,
  ipAddress?: string
) {
  const logData = {
    timestamp: new Date().toISOString(),
    address: address,
    walletType: result.walletType,
    verificationMethod: result.verificationMethod,
    success: result.success,
    signatureLength: result.details?.signatureLength,
    userAgent: userAgent,
    ipAddress: ipAddress,
    error: result.error
  };

  if (result.success) {
    console.log('[SIGNATURE_VERIFICATION_SUCCESS]', JSON.stringify(logData));
  } else {
    console.warn('[SIGNATURE_VERIFICATION_FAILURE]', JSON.stringify(logData));
  }
}