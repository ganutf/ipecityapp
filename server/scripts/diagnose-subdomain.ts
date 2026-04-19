#!/usr/bin/env tsx
import 'dotenv/config';
import { createPublicClient, fallback, http, namehash, zeroAddress } from 'viem';
import { mainnet } from 'viem/chains';

const USERNAME = process.argv[2];
if (!USERNAME) {
  console.error('Usage: tsx server/scripts/diagnose-subdomain.ts <username>');
  process.exit(1);
}

const NAME_WRAPPER = '0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401' as const;
const PUBLIC_RESOLVER = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;

const NAME = `${USERNAME}.ipecity.eth`;
const NODE = namehash(NAME);

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    process.env.ETHEREUM_RPC_URL,
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
    'https://cloudflare-eth.com',
  ].filter(Boolean).map(url => http(url as string))),
});

async function main() {
  console.log(`\n🔎 Diagnosing ${NAME}`);
  console.log(`namehash: ${NODE}\n`);

  // NameWrapper.ownerOf — what subdomainExists() reads now
  try {
    const wrapperOwner = await client.readContract({
      address: NAME_WRAPPER,
      abi: [{ name: 'ownerOf', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'id', type: 'uint256' }],
        outputs: [{ name: '', type: 'address' }] }] as const,
      functionName: 'ownerOf',
      args: [BigInt(NODE)],
    });
    console.log(`NameWrapper.ownerOf        : ${wrapperOwner}`);
    console.log(`  → zero? ${wrapperOwner === zeroAddress}  (false means code will report TAKEN)`);
  } catch (err) {
    console.log(`NameWrapper.ownerOf        : REVERT (token never minted / fully burned) → AVAILABLE`);
    console.log(`  reason: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
  }

  // ENS Registry.owner — what the ENS app UI typically manipulates
  try {
    const registryOwner = await client.readContract({
      address: ENS_REGISTRY,
      abi: [{ name: 'owner', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'node', type: 'bytes32' }],
        outputs: [{ name: '', type: 'address' }] }] as const,
      functionName: 'owner',
      args: [NODE],
    });
    console.log(`ENSRegistry.owner          : ${registryOwner}`);
  } catch (err) {
    console.log(`ENSRegistry.owner          : ERROR ${err instanceof Error ? err.message.split('\n')[0] : err}`);
  }

  // ENS Registry.resolver
  try {
    const registryResolver = await client.readContract({
      address: ENS_REGISTRY,
      abi: [{ name: 'resolver', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'node', type: 'bytes32' }],
        outputs: [{ name: '', type: 'address' }] }] as const,
      functionName: 'resolver',
      args: [NODE],
    });
    console.log(`ENSRegistry.resolver       : ${registryResolver}`);
  } catch {
    console.log(`ENSRegistry.resolver       : ERROR`);
  }

  // PublicResolver.addr — stale record from pre-b0e0ecd bug
  try {
    const resolverAddr = await client.readContract({
      address: PUBLIC_RESOLVER,
      abi: [{ name: 'addr', type: 'function', stateMutability: 'view',
        inputs: [{ name: 'node', type: 'bytes32' }],
        outputs: [{ name: '', type: 'address' }] }] as const,
      functionName: 'addr',
      args: [NODE],
    });
    console.log(`PublicResolver.addr        : ${resolverAddr}  (ignored by current check, but kept for context)`);
  } catch {
    console.log(`PublicResolver.addr        : ERROR`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
