/**
 * PassportService - username availability and ENS lookup
 * Extracted from server/routes.ts (lines ~1627-1710)
 */

import type { IStorage } from '../storage';
import { lookupEnsName } from '../lib/ensLookup';
import logger from '../logger';

interface AvailabilityResult {
  available: boolean;
  reason?: string;
}

interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
  source: 'justaname' | 'onchain';
  error: string | null;
}

export class PassportService {
  constructor(
    private storage: IStorage,
    private justaNameApiKey: string,
  ) {}

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

    // Check blockchain availability via JustaName
    const response = await fetch(
      `https://api.justaname.id/ens/v1/subname/available?subname=${sanitizedUsername}.ipecity.eth&chainId=1`,
      {
        headers: { 'X-API-KEY': this.justaNameApiKey },
      },
    );

    if (!response.ok) {
      throw new Error(`JustaName API error: ${response.status}`);
    }

    const responseData = await response.json();
    const isAvailable = responseData.result.data.isAvailable;

    return {
      available: isAvailable,
      reason: !isAvailable ? 'This subdomain is already registered on-chain' : undefined,
    };
  }

  async lookupEns(address: string): Promise<EnsLookupResult> {
    if (!address) {
      return {
        ensName: null,
        ensNames: [],
        source: 'justaname',
        error: 'Address parameter is required',
      };
    }
    return lookupEnsName(address);
  }
}
