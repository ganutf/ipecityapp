/**
 * ENS Subdomain Service
 *
 * Manages *.ipecity.eth subdomains via the ENS NameWrapper on Ethereum mainnet.
 * ipecity.eth is a wrapped name — all subdomain writes must go through the
 * NameWrapper contract, not the ENS Registry directly.
 *
 * Authorization model:
 *   - Personal wallet owns ipecity.eth (ERC-1155 token in NameWrapper)
 *   - Admin wallet is approved as operator via setApprovalForAll on NameWrapper
 *   - Admin wallet can create/revoke subdomains without touching the personal wallet
 *   - Personal wallet is never at risk — setApprovalForAll is revocable at any time
 *
 * Gas policy: ALL costs are paid by IpêCity via ENS_ADMIN_MNEMONIC wallet.
 * Members never sign a transaction or hold ETH for passport operations.
 *
 * createSubdomain flow (3 txns):
 *   1. NameWrapper.setSubnodeRecord — create subdomain, admin as temp owner
 *   2. PublicResolver.setAddr — set addr record to member's wallet
 *   3. NameWrapper.setSubnodeOwner — transfer subdomain ownership to member
 *
 * revokeSubdomain flow (1 txn):
 *   1. NameWrapper.setSubnodeRecord — reclaim to admin, clear resolver
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  zeroAddress,
  type Hash,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import logger from '../logger';

// ============================================
// CONTRACT ADDRESSES (Ethereum Mainnet)
// ============================================

const NAME_WRAPPER_ADDRESS = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as const;
const PUBLIC_RESOLVER_ADDRESS = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;
const PARENT_DOMAIN = 'ipecity.eth';
const PARENT_NODE = namehash(PARENT_DOMAIN);

// Max uint64 — NameWrapper caps subdomain expiry to parent's expiry automatically
const MAX_EXPIRY = BigInt('18446744073709551615');

// ============================================
// MINIMAL ABIs
// ============================================

const NAME_WRAPPER_ABI = [
  {
    // Create or overwrite a subdomain.
    // label = raw string (e.g. "alice"), NOT labelhash — NameWrapper hashes internally.
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
  {
    // Transfer subdomain ownership without changing resolver/TTL/fuses.
    name: 'setSubnodeOwner',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'parentNode', type: 'bytes32' },
      { name: 'label', type: 'string' },
      { name: 'newOwner', type: 'address' },
      { name: 'fuses', type: 'uint32' },
      { name: 'expiry', type: 'uint64' },
    ],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
  {
    // Returns the ERC-1155 token owner for a given node (as uint256).
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const PUBLIC_RESOLVER_ABI = [
  {
    name: 'setAddr',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'addr', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// ============================================
// SERVICE CLASS
// ============================================

export class EnsSubdomainService {
  private walletClient;
  private publicClient;
  private adminAddress: Address;

  constructor(mnemonic: string) {
    const account = mnemonicToAccount(mnemonic);
    this.adminAddress = account.address;

    const rpcUrl = process.env.ETHEREUM_RPC_URL;

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(rpcUrl),
    });

    logger.info(`[ENS] Admin wallet: ${this.adminAddress}`);
  }

  /**
   * Issue a passport subdomain to a new member.
   *
   * Creates username.ipecity.eth pointing to the member's wallet.
   * Three transactions:
   *   1. NameWrapper.setSubnodeRecord — subdomain created, admin as temp owner
   *   2. PublicResolver.setAddr — addr record set to member's wallet
   *   3. NameWrapper.setSubnodeOwner — ownership transferred to member
   *
   * IpêCity pays gas. Member does nothing on-chain.
   *
   * @returns tx hash of the initial setSubnodeRecord transaction
   */
  async createSubdomain(username: string, memberWalletAddress: string): Promise<Hash> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);
    const memberAddress = memberWalletAddress as Address;

    logger.info(`[ENS] Creating subdomain: ${username}.${PARENT_DOMAIN} → ${memberWalletAddress}`);

    // Step 1: setSubnodeRecord — create subdomain with admin as temp owner.
    // Admin owns it temporarily so we can set the addr record in step 2.
    // fuses=0 means no restrictions burned — parent retains full revocation control.
    const createTxHash = await this.walletClient.writeContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'setSubnodeRecord',
      args: [PARENT_NODE, username, this.adminAddress, PUBLIC_RESOLVER_ADDRESS, BigInt(0), 0, MAX_EXPIRY],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: createTxHash });
    logger.info(`[ENS] Subdomain created (admin owner): ${createTxHash}`);

    // Step 2: setAddr — point the subdomain to the member's wallet.
    // Admin can call this because admin currently owns the subdomain node.
    const addrTxHash = await this.walletClient.writeContract({
      address: PUBLIC_RESOLVER_ADDRESS,
      abi: PUBLIC_RESOLVER_ABI,
      functionName: 'setAddr',
      args: [subnodeHash, memberAddress],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: addrTxHash });
    logger.info(`[ENS] Addr record set: ${addrTxHash}`);

    // Step 3: setSubnodeOwner — transfer subdomain ownership to the member.
    // Member now has a genuine on-chain ENS identity.
    // IpêCity retains revocation power via parent ownership.
    const transferTxHash = await this.walletClient.writeContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'setSubnodeOwner',
      args: [PARENT_NODE, username, memberAddress, 0, MAX_EXPIRY],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: transferTxHash });
    logger.info(`[ENS] Ownership transferred to member: ${transferTxHash}`);

    return createTxHash;
  }

  /**
   * Revoke a member's passport subdomain.
   *
   * Reclaims the subnode from the member and clears the resolver in one tx.
   * Works because admin is an approved operator of the parent ipecity.eth node —
   * the parent always wins regardless of who currently owns the subdomain.
   * The subdomain node still exists on-chain but resolves to nothing.
   *
   * IpêCity pays gas.
   *
   * @returns Transaction hash
   */
  async revokeSubdomain(username: string): Promise<Hash> {
    logger.info(`[ENS] Revoking subdomain: ${username}.${PARENT_DOMAIN}`);

    // setSubnodeRecord with adminAddress + zeroAddress resolver:
    //   - reclaims ownership (admin takes back the node)
    //   - clears resolver (name no longer resolves to anything)
    const txHash = await this.walletClient.writeContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'setSubnodeRecord',
      args: [PARENT_NODE, username, this.adminAddress, zeroAddress, BigInt(0), 0, MAX_EXPIRY],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    logger.info(`[ENS] Revocation confirmed: ${txHash}`);

    return txHash;
  }

  /**
   * Check if a subdomain currently resolves to any non-zero address.
   */
  async subdomainExists(username: string): Promise<boolean> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);

    try {
      const resolvedAddress = await this.publicClient.readContract({
        address: PUBLIC_RESOLVER_ADDRESS,
        abi: PUBLIC_RESOLVER_ABI,
        functionName: 'addr',
        args: [subnodeHash],
      });

      return (
        resolvedAddress !== zeroAddress &&
        resolvedAddress !== '0x0000000000000000000000000000000000000000'
      );
    } catch {
      return false;
    }
  }

  /**
   * Get the current NameWrapper token owner of a subdomain.
   */
  async getSubnodeOwner(username: string): Promise<Address> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);

    return await this.publicClient.readContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [BigInt(subnodeHash)],
    });
  }

  getAdminAddress(): Address {
    return this.adminAddress;
  }
}

// ============================================
// SINGLETON
// ============================================

let _instance: EnsSubdomainService | null = null;

export function getEnsSubdomainService(): EnsSubdomainService {
  if (!_instance) {
    const mnemonic = process.env.ENS_ADMIN_MNEMONIC;
    if (!mnemonic) {
      throw new Error('ENS_ADMIN_MNEMONIC environment variable is not set');
    }
    _instance = new EnsSubdomainService(mnemonic);
  }
  return _instance;
}
