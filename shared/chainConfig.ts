/**
 * Shared chain configuration for both server and client
 */

export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  easContractAddress: string;
  easscanBaseUrl: string;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  'base-sepolia': {
    name: 'base-sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    easContractAddress: '0x4200000000000000000000000000000000000021',
    easscanBaseUrl: 'https://base-sepolia.easscan.org'
  },
  'base': {
    name: 'base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    easContractAddress: '0x4200000000000000000000000000000000000021',
    easscanBaseUrl: 'https://base.easscan.org'
  }
};

/**
 * Get chain configuration for server-side use
 * Uses process.env
 */
export function getServerChainConfig(): ChainConfig {
  const chainName = process.env.CHAIN || 
    (process.env.NODE_ENV === 'development' ? 'base-sepolia' : 'base');
  
  const config = CHAIN_CONFIGS[chainName];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainName}. Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
  }
  
  return config;
}

/**
 * Get chain configuration for client-side use
 * Uses import.meta.env (Vite environment variables)
 */
export function getClientChainConfig(): ChainConfig {
  // Note: This function is designed for client-side use with Vite
  // import.meta.env is only available in client-side code
  const chainName = (import.meta.env.VITE_CHAIN as string) || 
    (import.meta.env.MODE === 'development' ? 'base-sepolia' : 'base');
  
  const config = CHAIN_CONFIGS[chainName];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainName}. Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
  }
  
  return config;
}

/**
 * Helper functions for common chain information
 */
export function getEasScanUrl(chainConfig: ChainConfig, attestationUid: string): string {
  return `${chainConfig.easscanBaseUrl}/attestation/view/${attestationUid}`;
}

export function getDisplayName(chainConfig: ChainConfig): string {
  return chainConfig.name === 'base-sepolia' ? 'Base Sepolia' : 'Base';
}