import { lookupEnsName } from '../lib/ensLookup';

/**
 * Check if wallet address owns any ipecity.eth subdomain
 * Returns subdomain name or null
 *
 * This service reuses the existing lookupEnsName() function which:
 * - Calls JustaName API
 * - Filters for ipecity.eth domains
 * - Returns array of claimed subdomains
 */
export async function checkWalletForPassport(walletAddress: string): Promise<string | null> {
  if (!walletAddress) {
    return null;
  }

  const result = await lookupEnsName(walletAddress);

  if (result.ensNames && result.ensNames.length > 0) {
    // Return first ipecity.eth subdomain found
    return result.ensNames[0];
  }

  return null;
}
