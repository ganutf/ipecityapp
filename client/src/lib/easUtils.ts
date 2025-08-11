/**
 * Utility functions for EAS (Ethereum Attestation Service) integration
 */

import { getClientChainConfig, getEasScanUrl as getEasScanUrlHelper, getDisplayName } from '@shared/chainConfig';

// Cache the chain config to avoid repeated calls
let chainConfig: ReturnType<typeof getClientChainConfig> | null = null;

function getChainConfig() {
  if (!chainConfig) {
    chainConfig = getClientChainConfig();
  }
  return chainConfig;
}

/**
 * Gets the appropriate EAS scan URL based on the current chain configuration
 * @param attestationUid - The attestation UID to link to
 * @returns The full URL to view the attestation on EAS scan
 */
export function getEasScanUrl(attestationUid: string): string {
  return getEasScanUrlHelper(getChainConfig(), attestationUid);
}

/**
 * Gets the chain name for display purposes
 */
export function getChainName(): string {
  return getDisplayName(getChainConfig());
}

/**
 * Gets the chain ID
 */
export function getChainId(): number {
  return getChainConfig().chainId;
}