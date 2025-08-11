/**
 * Secure Key Management System for Ipê City Pulse
 * 
 * This module provides secure storage and access for cryptographic keys,
 * replacing plaintext environment variable storage with encrypted key management.
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';

const scryptAsync = promisify(scrypt);

/**
 * Configuration for key storage
 */
interface KeyStorageConfig {
  keyDerivationIterations: number;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  algorithm: string;
}

const DEFAULT_CONFIG: KeyStorageConfig = {
  keyDerivationIterations: 100000,
  keyLength: 32,
  ivLength: 16,
  saltLength: 32,
  algorithm: 'aes-256-gcm'
};

/**
 * Encrypted key data structure
 */
interface EncryptedKeyData {
  encryptedData: string;
  iv: string;
  salt: string;
  authTag: string;
  timestamp: number;
  algorithm: string;
}

/**
 * Secure key management class
 */
export class SecureKeyManager {
  private config: KeyStorageConfig;
  private keyStorePath: string;
  private masterPassword: string | null = null;

  constructor(config: Partial<KeyStorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.keyStorePath = join(process.cwd(), '.keys');
    
    // Ensure the keys directory exists with proper permissions
    this.ensureKeyDirectory();
  }

  /**
   * Initialize the key manager with a master password
   */
  public initialize(masterPassword: string): void {
    if (!masterPassword || masterPassword.length < 32) {
      throw new Error('Master password must be at least 32 characters long');
    }
    this.masterPassword = masterPassword;
  }

  /**
   * Derive encryption key from master password and salt
   */
  private async deriveKey(salt: Buffer): Promise<Buffer> {
    if (!this.masterPassword) {
      throw new Error('Key manager not initialized with master password');
    }

    return await scryptAsync(
      this.masterPassword, 
      salt, 
      this.config.keyLength
    ) as Buffer;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  private async encryptData(data: string): Promise<EncryptedKeyData> {
    const salt = randomBytes(this.config.saltLength);
    const iv = randomBytes(this.config.ivLength);
    const key = await this.deriveKey(salt);

    const cipher = createCipheriv(this.config.algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      salt: salt.toString('hex'),
      authTag: authTag.toString('hex'),
      timestamp: Date.now(),
      algorithm: this.config.algorithm
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private async decryptData(encryptedKeyData: EncryptedKeyData): Promise<string> {
    const salt = Buffer.from(encryptedKeyData.salt, 'hex');
    const iv = Buffer.from(encryptedKeyData.iv, 'hex');
    const authTag = Buffer.from(encryptedKeyData.authTag, 'hex');
    const key = await this.deriveKey(salt);

    const decipher = createDecipheriv(encryptedKeyData.algorithm, key, iv);
    (decipher as any).setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedKeyData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Ensure the key storage directory exists with proper permissions
   */
  private ensureKeyDirectory(): void {
    if (!existsSync(this.keyStorePath)) {
      mkdirSync(this.keyStorePath, { mode: 0o700, recursive: true });
    }
  }

  /**
   * Get the file path for a specific key
   */
  private getKeyFilePath(keyName: string): string {
    return join(this.keyStorePath, `${keyName}.enc`);
  }

  /**
   * Store an encrypted key securely
   */
  public async storeKey(keyName: string, keyValue: string): Promise<void> {
    if (!keyName || !keyValue) {
      throw new Error('Key name and value are required');
    }

    try {
      const encryptedData = await this.encryptData(keyValue);
      const filePath = this.getKeyFilePath(keyName);
      
      writeFileSync(filePath, JSON.stringify(encryptedData), { mode: 0o600 });
      
      console.log(`Key '${keyName}' stored securely`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to store key '${keyName}': ${errorMessage}`);
    }
  }

  /**
   * Retrieve and decrypt a stored key
   */
  public async retrieveKey(keyName: string): Promise<string | null> {
    try {
      const filePath = this.getKeyFilePath(keyName);
      
      if (!existsSync(filePath)) {
        return null;
      }

      const encryptedData: EncryptedKeyData = JSON.parse(
        readFileSync(filePath, 'utf8')
      );

      return await this.decryptData(encryptedData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve key '${keyName}': ${errorMessage}`);
    }
  }

  /**
   * Check if a key exists in storage
   */
  public keyExists(keyName: string): boolean {
    return existsSync(this.getKeyFilePath(keyName));
  }

  /**
   * Delete a stored key
   */
  public deleteKey(keyName: string): boolean {
    try {
      const filePath = this.getKeyFilePath(keyName);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`Key '${keyName}' deleted`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete key '${keyName}':`, error);
      return false;
    }
  }

  /**
   * List all stored key names (without decrypting values)
   */
  public async listKeys(): Promise<string[]> {
    try {
      if (!existsSync(this.keyStorePath)) {
        return [];
      }

      const { readdirSync } = await import('fs');
      const files = readdirSync(this.keyStorePath);
      return files
        .filter((file: string) => file.endsWith('.enc'))
        .map((file: string) => file.replace('.enc', ''));
    } catch (error) {
      console.error('Failed to list keys:', error);
      return [];
    }
  }

  /**
   * Rotate encryption for a key (re-encrypt with new salt/iv)
   */
  public async rotateKey(keyName: string): Promise<void> {
    const keyValue = await this.retrieveKey(keyName);
    if (keyValue) {
      await this.storeKey(keyName, keyValue);
      console.log(`Key '${keyName}' rotated successfully`);
    } else {
      throw new Error(`Key '${keyName}' not found for rotation`);
    }
  }
}

/**
 * Singleton instance for secure key management
 */
let keyManager: SecureKeyManager | null = null;

/**
 * Initialize the global key manager instance
 */
export function initializeKeyManager(masterPassword?: string): SecureKeyManager {
  if (!keyManager) {
    keyManager = new SecureKeyManager();
  }

  // If a master password is provided, initialize the manager
  if (masterPassword) {
    keyManager.initialize(masterPassword);
  }

  return keyManager;
}

/**
 * Get the initialized key manager instance
 */
export function getKeyManager(): SecureKeyManager {
  if (!keyManager) {
    throw new Error('Key manager not initialized. Call initializeKeyManager() first.');
  }
  return keyManager;
}

/**
 * Check if running in a production-like environment that should use direct environment variables
 */
function shouldUseDirectEnvironmentVariables(): boolean {
  return !!(
    // Replit environment
    process.env.REPL_ID || 
    process.env.REPL_SLUG || 
    process.env.REPLIT_DB_URL ||
    process.env.REPL_OWNER ||
    // Production environment
    process.env.NODE_ENV === 'production' ||
    // Common production platforms
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.AZURE_FUNCTIONS_ENVIRONMENT ||
    // Manual override for any platform
    process.env.USE_DIRECT_ENV_VARS === 'true'
  );
}

/**
 * Secure environment variable replacement with production compatibility
 * This function retrieves keys from secure storage in development
 * and falls back to direct environment variables in production environments
 */
export async function getSecureEnvironmentVariable(keyName: string, fallbackEnvVar?: string): Promise<string | undefined> {
  // In production-like environments, use direct environment variables
  if (shouldUseDirectEnvironmentVariables()) {
    if (fallbackEnvVar && process.env[fallbackEnvVar]) {
      return process.env[fallbackEnvVar];
    }
    return undefined;
  }

  // Development environment - use secure storage with fallback to env vars
  try {
    const manager = getKeyManager();
    
    // First try to get from secure storage
    const secureValue = await manager.retrieveKey(keyName);
    if (secureValue) {
      return secureValue;
    }

    // If not found in secure storage and fallback is provided, check environment
    if (fallbackEnvVar && process.env[fallbackEnvVar]) {
      console.warn(`Key '${keyName}' not found in secure storage, using environment variable '${fallbackEnvVar}' as fallback`);
      return process.env[fallbackEnvVar];
    }

    console.warn(`Key '${keyName}' not found in secure storage or environment variables`);
    return undefined;
  } catch (error) {
    console.error(`Error retrieving secure environment variable '${keyName}':`, error);
    
    // As a last resort, try the fallback environment variable
    if (fallbackEnvVar && process.env[fallbackEnvVar]) {
      console.warn(`Using environment variable '${fallbackEnvVar}' due to secure storage error`);
      return process.env[fallbackEnvVar];
    }
    
    return undefined;
  }
}

/**
 * Migration helper to move existing environment variables to secure storage
 */
export async function migrateEnvironmentVariablesToSecureStorage(variablesToMigrate: { [keyName: string]: string }): Promise<void> {
  const manager = getKeyManager();
  
  for (const [keyName, envVarName] of Object.entries(variablesToMigrate)) {
    const envValue = process.env[envVarName];
    if (envValue && !manager.keyExists(keyName)) {
      await manager.storeKey(keyName, envValue);
      console.log(`Migrated '${envVarName}' to secure storage as '${keyName}'`);
    }
  }
}