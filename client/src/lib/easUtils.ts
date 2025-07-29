/**
 * Utility functions for EAS (Ethereum Attestation Service) integration
 */

/**
 * Determines if we're in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV;
}

/**
 * Gets the appropriate EAS scan URL based on the current environment
 * @param attestationUid - The attestation UID to link to
 * @returns The full URL to view the attestation on EAS scan
 */
export function getEasScanUrl(attestationUid: string): string {
  const baseUrl = isDevelopment() 
    ? 'https://base-sepolia.easscan.org' 
    : 'https://base.easscan.org';
  
  return `${baseUrl}/attestation/view/${attestationUid}`;
}

/**
 * Gets the chain name for display purposes
 */
export function getChainName(): string {
  return isDevelopment() ? 'Base Sepolia' : 'Base';
}

/**
 * Gets the chain ID
 */
export function getChainId(): number {
  return isDevelopment() ? 84532 : 8453;
}