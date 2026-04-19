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
  fallback,
  http,
  namehash,
  zeroAddress,
  type Hash,
  type Address,
  type Transport,
} from 'viem';
import { mainnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import logger from '../logger';

// Public Ethereum mainnet fallbacks. Used by viem's `fallback` transport so
// a single flaky provider can't wedge the read path. Primary (ETHEREUM_RPC_URL)
// is tried first; on failure viem auto-rotates to the next.
const PUBLIC_RPC_FALLBACKS = [
  'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://cloudflare-eth.com',
] as const;

const RPC_TIMEOUT_MS = 3000;

function createMainnetTransport(): Transport {
  const primary = process.env.ETHEREUM_RPC_URL;
  const urls = [primary, ...PUBLIC_RPC_FALLBACKS].filter(Boolean) as string[];
  return fallback(
    urls.map(url => http(url, { timeout: RPC_TIMEOUT_MS })),
  );
}

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

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: createMainnetTransport(),
    });

    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: createMainnetTransport(),
    });

    logger.info(`[ENS] Admin wallet: ${this.adminAddress}`);
  }

  /**
   * Verify that a wallet currently owns a specific `*.ipecity.eth` name on-chain.
   * Reads NameWrapper.ownerOf(namehash(name)) — deterministic and not subject
   * to subgraph indexing lag. Safe to use at passport-verify time.
   *
   * Returns false on any read error (conservative — treat "can't prove" as "no").
   */
  async verifyOnchainOwnership(name: string, wallet: string): Promise<boolean> {
    if (!name.endsWith(`.${PARENT_DOMAIN}`) && name !== PARENT_DOMAIN) {
      return false;
    }
    try {
      const node = namehash(name);
      const owner = await this.publicClient.readContract({
        address: NAME_WRAPPER_ADDRESS,
        abi: NAME_WRAPPER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(node)],
      });
      return owner.toLowerCase() === wallet.toLowerCase();
    } catch (err) {
      logger.warn('On-chain ownership verification failed', {
        name,
        wallet,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
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
   * Two transactions (both paid by IpêCity):
   *   1. NameWrapper.setSubnodeRecord — reclaim ownership to admin and clear
   *      the registry's resolver pointer. This is the authoritative revoke.
   *   2. PublicResolver.setAddr(node, 0x0) — wipe the stored addr record so
   *      direct calls to PublicResolver.addr() no longer return the ex-
   *      member's wallet. Admin is authorised because step 1 made admin the
   *      subnode owner. Best-effort — a failure here is logged but does not
   *      reverse the revocation.
   *
   * Without step 2 the resolver keeps an orphan record forever, which is
   * how deleted subnames can still appear "taken" to direct-resolver queries.
   *
   * @returns Transaction hash of the reclaim tx
   */
  async revokeSubdomain(username: string): Promise<Hash> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);
    logger.info(`[ENS] Revoking subdomain: ${username}.${PARENT_DOMAIN}`);

    const reclaimTxHash = await this.walletClient.writeContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'setSubnodeRecord',
      args: [PARENT_NODE, username, this.adminAddress, zeroAddress, BigInt(0), 0, MAX_EXPIRY],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: reclaimTxHash });
    logger.info(`[ENS] Revocation confirmed: ${reclaimTxHash}`);

    try {
      const clearAddrTxHash = await this.walletClient.writeContract({
        address: PUBLIC_RESOLVER_ADDRESS,
        abi: PUBLIC_RESOLVER_ABI,
        functionName: 'setAddr',
        args: [subnodeHash, zeroAddress],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: clearAddrTxHash });
      logger.info(`[ENS] Resolver addr cleared: ${clearAddrTxHash}`);
    } catch (err) {
      logger.warn('[ENS] Failed to clear resolver addr record (revocation still effective)', {
        username,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return reclaimTxHash;
  }

  /**
   * Check if a subdomain is currently owned (registered) on-chain.
   *
   * Reads NameWrapper.ownerOf(namehash) — the authoritative owner of wrapped
   * ENS subnames. Zero means the subname is free (never minted, or deleted
   * via NameWrapper). Must NOT fall back to PublicResolver.addr(), which
   * stores stale records that persist after the subname is burned.
   */
  async subdomainExists(username: string): Promise<boolean> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);

    try {
      const owner = await this.publicClient.readContract({
        address: NAME_WRAPPER_ADDRESS,
        abi: NAME_WRAPPER_ABI,
        functionName: 'ownerOf',
        args: [BigInt(subnodeHash)],
      });
      return owner !== zeroAddress;
    } catch {
      // A revert on ownerOf typically means the token doesn't exist (never
      // wrapped or already burned). Treat that as "not registered".
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

  /**
   * Get the current NameWrapper token owner of the parent domain (ipecity.eth).
   * Used to resolve who the root admin is — whoever owns ipecity.eth on-chain
   * should automatically be promoted to admin on first login.
   */
  async getParentOwner(): Promise<Address> {
    return await this.publicClient.readContract({
      address: NAME_WRAPPER_ADDRESS,
      abi: NAME_WRAPPER_ABI,
      functionName: 'ownerOf',
      args: [BigInt(PARENT_NODE)],
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
