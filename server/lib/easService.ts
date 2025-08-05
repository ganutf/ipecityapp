import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { config } from 'dotenv';
import { getSecureEnvironmentVariable } from './keyManagement';
import logger, { logUtils } from '../logger';

// Load environment variables
config();

// EAS Configuration - Different for development vs production
const isDevelopment = process.env.NODE_ENV === 'development';

const EAS_CONTRACT_ADDRESS = isDevelopment
  ? "0x4200000000000000000000000000000000000021" // Base Sepolia
  : "0x4200000000000000000000000000000000000021"; // Base Mainnet

const SCHEMA_UID = "0x118aa1ac273ffa930b8b880a1d59da273de0c0dab6303deca9827e45dd20cc1d";
const COMMUNITY_UID = "0x4f28a3bf558485216079bbf254c63c6b29a5917b0cc2117baf5d0b8cff146417";

// Schema fields: bytes32 communityUid,uint8 pulseType,string memberOnchainID,uint16 pulseNumber,uint64 executedAt,string actionsExecuted
const SCHEMA_STRING = "bytes32 communityUid,uint8 pulseType,string memberOnchainID,uint16 pulseNumber,uint64 executedAt,string actionsExecuted";

export interface AttestationData {
  memberOnchainID: string; // IPE passport (subdomain)
  memberWalletAddress: string; // Member's wallet address for recipient
  pulseNumber: number;
  executedAt: number; // Unix timestamp
  actionsExecuted: string; // JSON string of pulse execution actions
}

export interface AttestationResult {
  attestationUID: string;
  transactionHash: string;
}

class EASService {
  private eas!: EAS;
  private provider!: ethers.JsonRpcProvider;
  private signer!: ethers.Wallet;
  private schemaEncoder!: SchemaEncoder;
  private initialized = false;

  private async initialize() {
    if (this.initialized) return;

    // Use different RPC URLs and network configs for development vs production
    const defaultRpcUrl = isDevelopment
      ? "https://sepolia.base.org" // Base Sepolia testnet
      : "https://mainnet.base.org"; // Base mainnet

    const baseRpcUrl = process.env.BASE_RPC_URL || defaultRpcUrl;

    // Configure network with explicit chain ID
    const network = isDevelopment
      ? { name: 'base-sepolia', chainId: 84532, ensAddress: undefined }
      : { name: 'base', chainId: 8453, ensAddress: undefined };
    const mnemonic = await getSecureEnvironmentVariable('eas_attestation_mnemonic', 'EAS_ATTESTATION_MNEMONIC');

    if (!mnemonic) {
      logger.error('EAS Service initialization failed: Missing attestation mnemonic');
      throw new Error("EAS_ATTESTATION_MNEMONIC is not available in secure storage or environment variables");
    }

    // Initialize provider and signer with explicit network configuration
    this.provider = new ethers.JsonRpcProvider(baseRpcUrl, network);
    
    // Wait for provider to be ready before creating wallet
    await this.provider.getNetwork();
    
    this.signer = new ethers.Wallet(ethers.Wallet.fromPhrase(mnemonic).privateKey, this.provider);

    // Initialize EAS
    this.eas = new EAS(EAS_CONTRACT_ADDRESS);
    this.eas.connect(this.signer);

    // Initialize schema encoder
    this.schemaEncoder = new SchemaEncoder(SCHEMA_STRING);

    // Verify network connection
    const connectedNetwork = await this.provider.getNetwork();
    logger.info('EAS Service network connection verified', {
      expectedChainId: network.chainId,
      connectedChainId: connectedNetwork.chainId.toString(),
      networkName: connectedNetwork.name,
      rpcUrl: baseRpcUrl,
      isDevelopment: isDevelopment
    });

    // Verify we're on the correct network
    if (connectedNetwork.chainId !== BigInt(network.chainId)) {
      logger.error('Network mismatch detected', {
        expected: network.chainId,
        actual: connectedNetwork.chainId.toString(),
        isDevelopment: isDevelopment,
        rpcUrl: baseRpcUrl,
        message: 'Check NODE_ENV setting and network configuration'
      });
      throw new Error(`Network mismatch: expected chain ID ${network.chainId}, got ${connectedNetwork.chainId}. Ensure NODE_ENV is set correctly.`);
    }

    this.initialized = true;
    logger.info('EAS Service initialized successfully', {
      network: isDevelopment ? 'Base Sepolia' : 'Base Mainnet',
      chainId: connectedNetwork.chainId.toString(),
      signerAddress: logUtils.sanitize({ address: this.signer.address }).address
    });
  }


  /**
   * Create an attestation for a pulse execution
   */
  async createAttestation(data: AttestationData): Promise<AttestationResult> {
    await this.initialize();

    try {
      logger.info('Creating EAS attestation', {
        memberOnchainID: data.memberOnchainID,
        pulseNumber: data.pulseNumber,
        memberWalletAddress: data.memberWalletAddress
      });

      // Validate wallet address format
      if (!ethers.isAddress(data.memberWalletAddress)) {
        throw new Error(`Invalid wallet address: ${data.memberWalletAddress}`);
      }


      // Encode the attestation data
      const attestationFields = [
        { name: "communityUid", value: COMMUNITY_UID, type: "bytes32" },
        { name: "pulseType", value: 1, type: "uint8" }, // Number for uint8
        { name: "memberOnchainID", value: data.memberOnchainID, type: "string" },
        { name: "pulseNumber", value: Number(data.pulseNumber), type: "uint16" }, // Ensure number
        { name: "executedAt", value: BigInt(data.executedAt), type: "uint64" }, // Keep BigInt for uint64
        { name: "actionsExecuted", value: data.actionsExecuted, type: "string" }, // JSON string of actions
      ];

      logger.debug('Encoding attestation data', {
        fields: attestationFields.map(f => ({
          name: f.name,
          value: f.value.toString(),
          type: f.type
        })),
        schema: SCHEMA_UID,
        communityUid: COMMUNITY_UID
      });

      const encodedData = this.schemaEncoder.encodeData(attestationFields);

      logger.debug('Encoded attestation data', {
        encodedData: encodedData,
        encodedDataLength: encodedData.length
      });

      // Create the attestation (let EAS SDK handle gas automatically)
      const tx = await this.eas.attest({
        schema: SCHEMA_UID,
        data: {
          recipient: data.memberWalletAddress, // Use member's wallet address
          expirationTime: BigInt(0), // Convert to BigInt
          revocable: true,
          data: encodedData,
        },
      });

      logger.info('Attestation transaction submitted', {
        memberOnchainID: data.memberOnchainID,
        pulseNumber: data.pulseNumber
      });

      // Wait for transaction confirmation and get the attestation UID
      const newAttestationUID = await tx.wait();

      if (!newAttestationUID) {
        throw new Error('Failed to get attestation UID from transaction');
      }

      // Get transaction hash from the original transaction
      const transactionHash = typeof tx === 'object' && 'hash' in tx ? String(tx.hash) : 'unknown';

      logger.info('Attestation created successfully', {
        attestationUID: newAttestationUID,
        transactionHash: transactionHash,
        memberOnchainID: data.memberOnchainID,
        pulseNumber: data.pulseNumber
      });

      return {
        attestationUID: newAttestationUID,
        transactionHash: transactionHash,
      };
    } catch (error) {
      logger.error('Error creating EAS attestation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        memberOnchainID: data.memberOnchainID,
        pulseNumber: data.pulseNumber,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to create attestation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if the service configuration is valid
   */
  async validateConfiguration(): Promise<boolean> {
    await this.initialize();

    try {
      // Check if we can connect to the network
      const network = await this.provider.getNetwork();
      logger.info('Connected to EAS network', {
        networkName: network.name,
        chainId: network.chainId.toString()
      });

      // Check signer balance
      const balance = await this.provider.getBalance(this.signer.address);
      const balanceEth = ethers.formatEther(balance);
      logger.info('EAS signer balance check', {
        signerAddress: this.signer.address,
        balance: `${balanceEth} ETH`
      });

      if (balance === BigInt(0)) {
        logger.warn('EAS signer has no ETH balance', {
          signerAddress: this.signer.address,
          message: 'Attestations will fail without gas'
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error validating EAS configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Get the signer address
   */
  async getSignerAddress(): Promise<string> {
    await this.initialize();
    return this.signer.address;
  }
}

// Export singleton instance
export const easService = new EASService();