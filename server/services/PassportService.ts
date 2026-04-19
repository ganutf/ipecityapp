/**
 * PassportService - username availability and ENS lookup
 */

import type { IStorage } from '../storage';
import { lookupEnsName } from '../lib/ensLookup';
import { getEnsSubdomainService } from '../lib/ensSubdomainService';
import logger from '../logger';

interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
  source: 'database' | 'subgraph' | null;
  error: string | null;
}

export class PassportService {
  constructor(private storage: IStorage) {}

  async checkUsernameAvailability(username: string): Promise<AvailabilityResult> {
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    // Sanitize: lowercase alphanumeric only
    const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sanitizedUsername !== username.toLowerCase()) {
      throw new Error('Username can only contain letters and numbers');
    }

    // Check DB for existing member
    const existingMember = await this.storage.getMemberByIpePassport(sanitizedUsername);
    if (existingMember) {
      return { available: false, reason: 'This username is already taken' };
    }

    // Check on-chain availability via ENS NameWrapper
    try {
      const ensService = getEnsSubdomainService();
      const exists = await ensService.subdomainExists(sanitizedUsername);
      if (exists) {
        return { available: false, reason: 'This subdomain is already registered on-chain' };
      }
    } catch (error) {
      logger.warn('On-chain ENS availability check failed, relying on DB check only:', error);
    }

    return { available: true };
  }

  async lookupEns(address: string): Promise<EnsLookupResult> {
    if (!address) {
      return {
        ensName: null,
        ensNames: [],
        source: null,
        error: 'Address parameter is required',
      };
    }
    return lookupEnsName(address);
  }
}
