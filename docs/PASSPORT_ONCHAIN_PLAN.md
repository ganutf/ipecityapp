# Passport On-Chain Migration Plan
## Move from JustaName to Direct ENS Control + Payment-Based Revocation

**Date:** 2026-04-14  
**Status:** Ready for implementation

---

## 1. Context & Problem

The current passport system delegates all ENS subdomain operations to JustaName's API:

- **Reserve**: Server calls `POST https://api.justaname.id/ens/v1/subname/reserve` to hold a subdomain
- **Accept**: User calls JustaName SDK hook `useAcceptSubname()` on the frontend, paying gas, to take ownership
- **Lookup**: Server/client query JustaName's API to resolve `.ipecity.eth` names

**Problems with this:**
1. JustaName is a centralized dependency — if they go down or change their API, passports break
2. No revocation capability — once a member is `active_member` there is no mechanism to revoke their passport
3. No payment tracking — membership has no expiry
4. User pays gas to accept (bad UX)
5. Lookup is rate-limited by JustaName's free tier

**Goal:** Replace JustaName write operations with direct ENS Registry contract calls. Add membership expiry tracking and automatic passport revocation for non-paying members.

---

## 2. Gas Fee Policy: Zero Cost to Members

**All on-chain passport operations are paid by IpêCity, not the member.**

| Operation | Who pays gas |
|---|---|
| Issue passport (`setSubnodeRecord` + `setAddr`) | IpêCity admin wallet |
| Revoke passport (`setSubnodeRecord`) | IpêCity admin wallet |
| Reinstate passport (`setSubnodeRecord` + `setAddr`) | IpêCity admin wallet |

Members never sign a transaction or hold ETH for passport operations. The `ENS_ADMIN_MNEMONIC` wallet covers all costs. This wallet must be funded with ETH on Ethereum mainnet (see [Gas Cost Estimates](#20-gas-cost-estimates-ethereum-mainnet)).

This is a deliberate departure from the previous JustaName flow, where the user had to call `useAcceptSubname()` and pay gas (~$2–10) to claim their subdomain. That friction is eliminated entirely.

---

## 3. Architecture Decision: Plain (Unwrapped) Subnames

We use the **plain subname pattern** — the same model Basenames (Base's identity system) uses.

### How it works

The `ipecity.eth` owner (our admin wallet) calls `setSubnodeRecord` on the ENS Registry to assign `alice.ipecity.eth` to Alice's wallet address. Alice becomes the on-chain **owner** of that ENS node — she can set her own resolver records, use it for reverse resolution, and it shows up in every ENS-aware wallet as hers.

**The key revocation property:** Because we own the parent `ipecity.eth`, we can call `setSubnodeRecord` again at any time to **overwrite** Alice's subname ownership. The parent always wins. There are no cryptographic guarantees to the user — the trust model is "IpêCity controls `ipecity.eth`, so IpêCity can reclaim any subname."

This is exactly how `jesse.base.eth` and `vitalik.base.eth` work. The Base team owns `base.eth` and can revoke any `*.base.eth` subname at any time.

### Why not NameWrapper?

ENS NameWrapper adds fuses that can permanently prevent parent revocation (`PARENT_CANNOT_CONTROL` fuse). We explicitly do **not** want this. The plain registry approach gives us full revocation power without any on-chain commitment that we'll keep it.

### Contracts (Ethereum Mainnet)

| Contract | Address |
|---|---|
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| Public Resolver | `0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63` |

---

## 4. New Member Flow (After Migration)

### Before (JustaName flow)
```
Admin approves
  → Server calls JustaName reserve API
  → Member status: approved_application
  → User clicks "Accept Passport" in UI
  → JustaName SDK fires on-chain tx (user pays gas ~$2–10)
  → User calls backend to confirm
  → Member status: active_member
```

### After (direct ENS flow)
```
Admin approves
  → Server calls ENS Registry setSubnodeRecord (admin pays gas, ~$1–5 on mainnet)
  → Server calls Public Resolver setAddr
  → Member status: active_member (directly)
  → No user action required
```

### Revocation flow (new)
```
Membership expires (membershipExpiresAt < now)
  OR Admin manually revokes
  → Server calls ENS Registry setSubnodeRecord (reclaim + clear resolver)
  → Member status: passport_revoked
```

### Reinstatement flow (new)
```
Admin reinstates (after member pays)
  → Admin sets new membershipExpiresAt
  → Server calls ENS Registry setSubnodeRecord (re-assign to member)
  → Server calls Public Resolver setAddr
  → Member status: active_member
```

---

## 5. Prerequisites

### 4.1 ENS Setup

The wallet derived from `ENS_ADMIN_MNEMONIC` must be the **controller** (manager) of `ipecity.eth` in ENS.

- Go to [app.ens.domains](https://app.ens.domains)
- Look up `ipecity.eth`
- Under **Manager**, set it to the address of the `ENS_ADMIN_MNEMONIC` wallet
- The **Owner** can remain a separate cold wallet for security

> The Manager (controller) can create/modify records but cannot transfer the name. This is the key we use in the server.

### 4.2 Funding the ENS Admin Wallet

Each subdomain creation costs approximately $1–5 in ETH gas on mainnet (varies with congestion).  
Each revocation costs approximately the same.

Fund the ENS admin wallet with enough ETH for expected operations. Add a script to check its balance similar to `get-attestation-wallet.ts`.

---

## 5. Schema Changes

### `shared/schema.ts`

Add two columns to the `members` table:

```typescript
// In the members pgTable definition, add after updatedAt:
membershipExpiresAt: timestamp("membership_expires_at"),
// null = permanent membership (no expiry)
// set date = membership expires on that date, triggers revocation

passportRevokedAt: timestamp("passport_revoked_at"),
// null = passport is not revoked
// set date = when the revocation occurred (audit trail)
```

Full context in file (add after existing `updatedAt` field):
```typescript
export const members = pgTable("members", {
  // ... existing fields ...
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
  
  // NEW FIELDS:
  membershipExpiresAt: timestamp("membership_expires_at"),
  passportRevokedAt: timestamp("passport_revoked_at"),
});
```

### `shared/constants.ts`

Add `passport_revoked` to `MEMBER_STATUSES`:

```typescript
export const MEMBER_STATUSES = [
  'pending_id_verification',
  'pending_application_review',
  'approved_application',
  'denied_application',
  'active_member',
  'passport_revoked',           // NEW: suspended, eligible for reinstatement without re-applying
] as const;
```

Also update `ACTIVE_MEMBER_STATUSES` if it exists — `passport_revoked` should NOT be in it.

---

## 6. New File: `server/lib/ensSubdomainService.ts`

Full implementation:

```typescript
import { createPublicClient, createWalletClient, http, namehash, labelhash, zeroAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import logger from './logger';

// ENS Registry ABI (only the functions we use)
const ENS_REGISTRY_ABI = [
  {
    name: 'setSubnodeRecord',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'label', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'ttl', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// Public Resolver ABI (addr setter/getter)
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

const ENS_REGISTRY_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;
const PUBLIC_RESOLVER_ADDRESS = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63' as const;
const IPECITY_ETH_NODE = namehash('ipecity.eth');
const PARENT_DOMAIN = 'ipecity.eth';

export class EnsSubdomainService {
  private walletClient;
  private publicClient;
  private adminAddress: `0x${string}`;

  constructor(mnemonic: string) {
    const account = mnemonicToAccount(mnemonic);
    this.adminAddress = account.address;

    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });

    this.walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    logger.info(`ENS admin wallet: ${this.adminAddress}`);
  }

  /**
   * Create a subdomain for a new member.
   * Sets the subnode owner to the member's wallet and resolves their address.
   * Admin pays gas (~$1–5 on mainnet).
   *
   * Trust model: because we own ipecity.eth, we can overwrite this at any time.
   */
  async createSubdomain(username: string, memberWalletAddress: string): Promise<string> {
    const label = labelhash(username);
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);
    const memberAddress = memberWalletAddress as `0x${string}`;

    logger.info(`Creating ENS subdomain: ${username}.${PARENT_DOMAIN} → ${memberWalletAddress}`);

    // Step 1: Set subnode record — user becomes owner, with public resolver
    const registryTxHash = await this.walletClient.writeContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: 'setSubnodeRecord',
      args: [IPECITY_ETH_NODE, label, memberAddress, PUBLIC_RESOLVER_ADDRESS, BigInt(0)],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: registryTxHash });
    logger.info(`Registry tx confirmed: ${registryTxHash}`);

    // Step 2: Set addr record on the resolver so the subdomain resolves to their wallet
    // Note: admin can set this because admin owns ipecity.eth (parent resolver rights)
    const resolverTxHash = await this.walletClient.writeContract({
      address: PUBLIC_RESOLVER_ADDRESS,
      abi: PUBLIC_RESOLVER_ABI,
      functionName: 'setAddr',
      args: [subnodeHash, memberAddress],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: resolverTxHash });
    logger.info(`Resolver tx confirmed: ${resolverTxHash}`);

    return registryTxHash;
  }

  /**
   * Revoke a member's passport.
   * Reclaims subnode ownership from the member and clears resolver in one tx.
   * Works even if the member currently owns the subnode (parent always wins).
   */
  async revokeSubdomain(username: string): Promise<string> {
    const label = labelhash(username);

    logger.info(`Revoking ENS subdomain: ${username}.${PARENT_DOMAIN}`);

    // Reclaim ownership to admin address + clear resolver in one call
    const txHash = await this.walletClient.writeContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: 'setSubnodeRecord',
      args: [IPECITY_ETH_NODE, label, this.adminAddress, zeroAddress, BigInt(0)],
    });

    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    logger.info(`Revocation tx confirmed: ${txHash}`);

    return txHash;
  }

  /**
   * Check if a subdomain currently resolves to any address.
   * Used to verify state before/after operations.
   */
  async subdomainExists(username: string): Promise<boolean> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);

    const resolvedAddress = await this.publicClient.readContract({
      address: PUBLIC_RESOLVER_ADDRESS,
      abi: PUBLIC_RESOLVER_ABI,
      functionName: 'addr',
      args: [subnodeHash],
    });

    return resolvedAddress !== zeroAddress && resolvedAddress !== '0x0000000000000000000000000000000000000000';
  }

  /**
   * Get the current on-chain owner of a subdomain node.
   */
  async getSubnodeOwner(username: string): Promise<string> {
    const subnodeHash = namehash(`${username}.${PARENT_DOMAIN}`);

    return await this.publicClient.readContract({
      address: ENS_REGISTRY_ADDRESS,
      abi: ENS_REGISTRY_ABI,
      functionName: 'owner',
      args: [subnodeHash],
    });
  }
}

// Singleton — instantiated once at server startup
let _ensSubdomainService: EnsSubdomainService | null = null;

export function getEnsSubdomainService(): EnsSubdomainService {
  if (!_ensSubdomainService) {
    const mnemonic = process.env.ENS_ADMIN_MNEMONIC;
    if (!mnemonic) throw new Error('ENS_ADMIN_MNEMONIC not set');
    _ensSubdomainService = new EnsSubdomainService(mnemonic);
  }
  return _ensSubdomainService;
}
```

---

## 7. New File: `server/jobs/passportExpiryJob.ts`

Mirrors `server/jobs/balanceUpdater.ts` structure:

```typescript
import { storage } from '../storage';
import { getEnsSubdomainService } from '../lib/ensSubdomainService';
import logger from '../lib/logger';

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runPassportExpiryCheck(): Promise<void> {
  if (isRunning) {
    logger.warn('Passport expiry check already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const expiredMembers = await storage.getExpiredActivePassports();

    if (expiredMembers.length === 0) {
      logger.info('Passport expiry check: no expired passports found');
      return;
    }

    logger.info(`Passport expiry check: found ${expiredMembers.length} expired passports`);

    const ensService = getEnsSubdomainService();
    let revokedCount = 0;
    let failedCount = 0;

    for (const member of expiredMembers) {
      if (!member.ipeUsername) {
        logger.warn(`Member ${member.id} has no ipeUsername, skipping revocation`);
        continue;
      }

      try {
        await ensService.revokeSubdomain(member.ipeUsername);
        await storage.revokePassport(member.id);
        revokedCount++;
        logger.info(`Revoked passport for member ${member.id} (${member.ipeUsername})`);
      } catch (error) {
        failedCount++;
        logger.error(`Failed to revoke passport for member ${member.id}: ${error}`);
        // Don't throw — continue processing other members
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Passport expiry check complete: ${revokedCount} revoked, ${failedCount} failed (${elapsed}ms)`);
  } finally {
    isRunning = false;
  }
}

export function startPassportExpiryJob(): void {
  logger.info('Starting passport expiry job (interval: 1 hour)');
  runPassportExpiryCheck(); // Run immediately on startup
  intervalId = setInterval(runPassportExpiryCheck, CHECK_INTERVAL);
}

export function stopPassportExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Passport expiry job stopped');
  }
}

export function getPassportExpiryJobStatus() {
  return {
    running: isRunning,
    scheduled: intervalId !== null,
    intervalMs: CHECK_INTERVAL,
  };
}
```

---

## 8. Changes to `server/storage.ts`

### Add to `IStorage` interface

```typescript
// Passport lifecycle
setMembershipExpiry(memberId: number, expiresAt: Date | null): Promise<Member>;
revokePassport(memberId: number): Promise<Member>;
reinstatePassport(memberId: number, expiresAt?: Date): Promise<Member>;
getExpiredActivePassports(): Promise<Member[]>;
```

### Add to `DatabaseStorage` class

```typescript
async setMembershipExpiry(memberId: number, expiresAt: Date | null): Promise<Member> {
  const [member] = await db
    .update(members)
    .set({ membershipExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(members.id, memberId))
    .returning();
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  return member;
}

async revokePassport(memberId: number): Promise<Member> {
  const [member] = await db
    .update(members)
    .set({
      status: 'passport_revoked',
      passportRevokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId))
    .returning();
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  return member;
}

async reinstatePassport(memberId: number, expiresAt?: Date): Promise<Member> {
  const [member] = await db
    .update(members)
    .set({
      status: 'active_member',
      passportRevokedAt: null,
      membershipExpiresAt: expiresAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId))
    .returning();
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  return member;
}

async getExpiredActivePassports(): Promise<Member[]> {
  return await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.status, 'active_member'),
        isNotNull(members.membershipExpiresAt),
        lt(members.membershipExpiresAt, new Date()),
      )
    );
}
```

---

## 9. Changes to `server/services/MemberAdminService.ts`

### Import ENS service

```typescript
import { getEnsSubdomainService } from '../lib/ensSubdomainService';
```

### Replace `reserveSubdomain()` with `createSubdomainOnChain()`

Remove:
```typescript
// DELETE this entire method
private async reserveSubdomain(username: string, walletAddress: string): Promise<void> {
  const reserveResponse = await fetch('https://api.justaname.id/ens/v1/subname/reserve', ...);
  // ...
}
```

Replace with:
```typescript
private async createSubdomainOnChain(username: string, walletAddress: string): Promise<string> {
  const ensService = getEnsSubdomainService();
  return await ensService.createSubdomain(username, walletAddress);
}
```

### Update `approveMember()` flow

Current flow: reserve → `approved_application` → user accepts → `active_member`

New flow: create on-chain → `active_member` directly (admin pays gas, user does nothing)

```typescript
async approveMember(params: ApproveMemberParams): Promise<Member> {
  const { memberId, ipeUsername, userWalletAddress, memberType } = params;

  // Validate member exists and is in correct state
  const member = await this.storage.getMemberById(memberId);
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  
  const walletAddress = userWalletAddress ?? member.walletAddress;
  if (!walletAddress) throw new ValidationError('Member has no wallet address');

  // Create subdomain on-chain (admin pays gas)
  let txHash: string;
  try {
    txHash = await this.createSubdomainOnChain(ipeUsername, walletAddress);
  } catch (error) {
    // ENS creation failed — fall back to approved_application so admin can retry
    logger.error(`ENS subdomain creation failed for ${ipeUsername}: ${error}`);
    const pendingMember = await this.storage.updateMember(memberId, {
      status: 'approved_application',
      ipeUsername,
      ipePassport: `${ipeUsername}.ipecity.eth`,
      memberType: memberType ?? member.memberType,
    });
    // Send approval email even on ENS failure — admin will retry
    await this.sendApprovalEmail(pendingMember);
    throw new Error(`Subdomain creation failed — member set to approved_application for retry: ${error}`);
  }

  // ENS creation succeeded — go directly to active_member
  const updatedMember = await this.storage.updateMember(memberId, {
    status: 'active_member',
    ipeUsername,
    ipePassport: `${ipeUsername}.ipecity.eth`,
    memberType: memberType ?? member.memberType,
    passportVerified: true,
    emailVerified: member.emailVerified ?? true,
  });

  logger.info(`Member ${memberId} approved. ENS tx: ${txHash}`);
  await this.sendApprovalEmail(updatedMember);
  return updatedMember;
}
```

### Add `revokePassport()`

```typescript
async revokePassport(memberId: number): Promise<Member> {
  const member = await this.storage.getMemberById(memberId);
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  if (member.status !== 'active_member') {
    throw new ValidationError(`Member ${memberId} is not active (status: ${member.status})`);
  }
  if (!member.ipeUsername) {
    throw new ValidationError(`Member ${memberId} has no passport username`);
  }

  const ensService = getEnsSubdomainService();
  await ensService.revokeSubdomain(member.ipeUsername);

  return await this.storage.revokePassport(memberId);
}
```

### Add `reinstatePassport()`

```typescript
async reinstatePassport(memberId: number, expiresAt?: Date): Promise<Member> {
  const member = await this.storage.getMemberById(memberId);
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  if (member.status !== 'passport_revoked') {
    throw new ValidationError(`Member ${memberId} is not revoked (status: ${member.status})`);
  }
  if (!member.ipeUsername || !member.walletAddress) {
    throw new ValidationError(`Member ${memberId} missing username or wallet address`);
  }

  const ensService = getEnsSubdomainService();
  await ensService.createSubdomain(member.ipeUsername, member.walletAddress);

  return await this.storage.reinstatePassport(memberId, expiresAt);
}
```

### Add `setMembershipExpiry()`

```typescript
async setMembershipExpiry(memberId: number, expiresAt: Date | null): Promise<Member> {
  const member = await this.storage.getMemberById(memberId);
  if (!member) throw new NotFoundError(`Member ${memberId} not found`);
  return await this.storage.setMembershipExpiry(memberId, expiresAt);
}
```

---

## 10. Changes to `server/routes/admin.routes.ts`

### New Zod schemas (add alongside existing schemas)

```typescript
const revokePassportSchema = z.object({
  memberId: z.number().int().positive(),
});

const reinstatePassportSchema = z.object({
  memberId: z.number().int().positive(),
  expiresAt: z.string().datetime().optional(), // ISO 8601 date string
});

const membershipExpirySchema = z.object({
  memberId: z.number().int().positive(),
  expiresAt: z.string().datetime().nullable(), // null = remove expiry
});
```

### New endpoints (add after the deny-member route)

```typescript
// POST /api/v2/admin/revoke-passport
router.post(
  '/revoke-passport',
  requireAdminV2,
  auditLoggerV2('admin.revoke_passport'),
  async (req: Request, res: Response) => {
    const parsed = revokePassportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const member = await memberAdminService.revokePassport(parsed.data.memberId);
      return res.json({ success: true, member });
    } catch (error) {
      return handleServiceError(error, res);
    }
  }
);

// POST /api/v2/admin/reinstate-passport
router.post(
  '/reinstate-passport',
  requireAdminV2,
  auditLoggerV2('admin.reinstate_passport'),
  async (req: Request, res: Response) => {
    const parsed = reinstatePassportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;

    try {
      const member = await memberAdminService.reinstatePassport(parsed.data.memberId, expiresAt);
      return res.json({ success: true, member });
    } catch (error) {
      return handleServiceError(error, res);
    }
  }
);

// PATCH /api/v2/admin/membership-expiry
router.patch(
  '/membership-expiry',
  requireAdminV2,
  auditLoggerV2('admin.set_membership_expiry'),
  async (req: Request, res: Response) => {
    const parsed = membershipExpirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    try {
      const member = await memberAdminService.setMembershipExpiry(parsed.data.memberId, expiresAt);
      return res.json({ success: true, member });
    } catch (error) {
      return handleServiceError(error, res);
    }
  }
);
```

---

## 11. Changes to `server/index.ts`

```typescript
// Add import
import { startPassportExpiryJob, stopPassportExpiryJob } from './jobs/passportExpiryJob';

// In server startup (alongside startBalanceUpdater()):
startPassportExpiryJob();

// In graceful shutdown handler (alongside stopBalanceUpdater()):
stopPassportExpiryJob();
```

---

## 12. Changes to `server/lib/validateEnv.ts`

Add to the list of required env vars:

```typescript
'ENS_ADMIN_MNEMONIC',
```

---

## 13. Frontend Changes

### `client/src/App.tsx`

Remove the `JustaNameProvider` wrapper and all config:

```typescript
// DELETE:
import { JustaNameProvider } from '@justaname.id/react';
const justaNameConfig = { ... };

// Change from:
<JustaNameProvider config={justaNameConfig}>
  <RouterProvider router={router} />
</JustaNameProvider>

// Change to:
<RouterProvider router={router} />
```

Remove `VITE_JUSTANAME_API_KEY` from any config references.

### `client/src/components/PassportVerificationSection.tsx`

**Remove:**
- `import { useAcceptSubname } from '@justaname.id/react'`
- The `acceptSubname()` call and all JustaName SDK logic
- The `isAcceptSubnamePending` loading state tied to JustaName

**Update `acceptSubdomainMutation`** — now just a backend call:

```typescript
const acceptSubdomainMutation = useMutation({
  mutationFn: async () => {
    // Subdomain is already created on-chain by admin.
    // This call just confirms the member has seen their approved state.
    return authenticatedPost('/api/v2/auth/passport/accept', { memberId: member.id });
  },
  onSuccess: () => {
    refreshMember();
    queryClient.invalidateQueries({ queryKey: queryKeys.member(member.id) });
  },
  onError: (error) => {
    toast({ title: 'Error', description: 'Failed to confirm passport activation', variant: 'destructive' });
    logger.error('Accept passport error:', error);
  },
});
```

**Update `approved_application` UI section:**

```tsx
{member.status === 'approved_application' && (
  <div className="space-y-4">
    <div className="flex items-center space-x-3 p-4 bg-lime-50 border border-lime-200 rounded-lg">
      <Clock className="h-5 w-5 text-lime-600" />
      <div>
        <p className="text-sm font-semibold text-lime-800">Passport Being Created</p>
        <p className="text-sm text-lime-700">
          Your <strong>{member.ipePassport}</strong> passport is being registered on-chain.
          This usually completes within a few minutes.
        </p>
      </div>
    </div>
    <Button
      onClick={() => acceptSubdomainMutation.mutate()}
      disabled={acceptSubdomainMutation.isPending}
      className="bg-lime-400 text-slate-900 hover:bg-lime-500"
    >
      {acceptSubdomainMutation.isPending ? 'Confirming...' : 'Confirm Passport Activation'}
    </Button>
  </div>
)}
```

**Add `passport_revoked` UI section:**

```tsx
{member.status === 'passport_revoked' && (
  <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
    <AlertTriangle className="h-5 w-5 text-red-600" />
    <div>
      <p className="text-sm font-semibold text-red-800">Passport Suspended</p>
      <p className="text-sm text-red-700">
        Your <strong>{member.ipePassport}</strong> passport has been suspended.
        Please contact the IpêCity team to reinstate your membership.
      </p>
    </div>
  </div>
)}
```

### `client/src/pages/id-verification.tsx`

Update the PassportStep component to remove any JustaName-specific messaging about "accepting" the subdomain. The step now just shows confirmation that the admin is handling the ENS registration.

### Remove JustaName packages (final cleanup step)

After confirming everything works:
```bash
npm uninstall @justaname.id/react @justaname.id/sdk
```

---

## 14. ENS Lookup Migration (`server/lib/ensLookup.ts`)

The current file queries JustaName's API for `*.ipecity.eth` subdomains owned by a wallet. Replace with viem's ENS resolution:

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

const publicClient = createPublicClient({ chain: mainnet, transport: http() });

export async function lookupEnsName(address: string): Promise<EnsLookupResult> {
  // Check database first — we're now the authoritative source for ipecity.eth subdomains
  const member = await storage.getMemberByWalletAddress(address.toLowerCase());
  if (member?.ipePassport) {
    return { ensName: member.ipePassport, ensNames: [member.ipePassport], source: 'database' };
  }

  // Fallback: reverse ENS resolution for any other ENS name this wallet might have
  try {
    const ensName = await publicClient.getEnsName({ address: address as `0x${string}` });
    if (ensName) {
      return { ensName, ensNames: [ensName], source: 'onchain' };
    }
  } catch (error) {
    logger.warn(`ENS reverse lookup failed for ${address}: ${error}`);
  }

  return { ensName: null, ensNames: [], source: null };
}
```

Since we now control all `*.ipecity.eth` subdomains, the database is the authoritative source — no need to query an external API for ipecity subdomains.

---

## 15. New Environment Variable

```bash
# .env and .env.example
ENS_ADMIN_MNEMONIC="word1 word2 word3 ..."
# BIP-39 mnemonic of the wallet set as manager/controller of ipecity.eth on ENS
# Fund this wallet with ETH on mainnet for subdomain gas fees
# ~$1–5 per subdomain creation or revocation
```

**Remove (after migration):**
```bash
# Remove these:
JUSTANAME_API_KEY=
VITE_JUSTANAME_API_KEY=
```

---

## 16. Database Migration

```bash
npm run db:push
# This will add membershipExpiresAt and passportRevokedAt columns to the members table
# Run interactively (not piped) — the TUI requires a terminal
```

---

## 17. Existing Member Migration

**No data migration needed.** Existing `active_member` records stay as-is.

For **revocation** of existing members (who accepted via JustaName and own their subnode):
- The admin wallet can still call `setSubnodeRecord(parentNode, label, adminAddress, zeroAddress, 0)` to reclaim ownership — **the parent always wins** regardless of who currently owns the subnode.
- This will work for all existing members.

For **reinstatement** of existing revoked members:
- Call `createSubdomain(username, walletAddress)` which re-assigns ownership to the member via `setSubnodeRecord`.
- Works the same as for new members.

---

## 18. Implementation Order

Execute in this sequence to avoid breaking existing functionality:

1. **Schema + constants** — add DB columns and `passport_revoked` status (`shared/schema.ts`, `shared/constants.ts`)
2. **DB migration** — `npm run db:push`
3. **ENS service** — create `server/lib/ensSubdomainService.ts`
4. **Storage methods** — add 4 new methods to `server/storage.ts`
5. **Expiry job** — create `server/jobs/passportExpiryJob.ts`
6. **MemberAdminService** — replace JustaName with ENS service, add revoke/reinstate/setExpiry
7. **Admin routes** — add 3 new endpoints in `server/routes/admin.routes.ts`
8. **validateEnv** — add `ENS_ADMIN_MNEMONIC`
9. **server/index.ts** — start expiry job
10. **Frontend: PassportVerificationSection** — remove JustaName SDK, add revoked UI state
11. **Frontend: App.tsx** — remove JustaNameProvider
12. **ensLookup.ts** — replace JustaName read API with viem + DB lookup
13. **Remove packages** — `npm uninstall @justaname.id/react @justaname.id/sdk`
14. **Verification** (see section below)

---

## 19. Verification Plan

### ENS Service Tests

```bash
# Create a test script: server/scripts/test-ens-service.ts
ts-node server/scripts/test-ens-service.ts
```

Script should:
1. Call `createSubdomain('testipecity', '0xYOUR_TEST_WALLET')` — verify on [app.ens.domains](https://app.ens.domains) that `testipecity.ipecity.eth` resolves to the test wallet
2. Call `subdomainExists('testipecity')` → should return `true`
3. Call `revokeSubdomain('testipecity')` — verify on ENS that the name no longer resolves
4. Call `subdomainExists('testipecity')` → should return `false`

### API Endpoint Tests

```bash
# Revoke a member's passport
curl -X POST http://localhost:5000/api/v2/admin/revoke-passport \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId": 1}'

# Reinstate with 1-year expiry
curl -X POST http://localhost:5000/api/v2/admin/reinstate-passport \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId": 1, "expiresAt": "2027-04-14T00:00:00Z"}'

# Set/update membership expiry
curl -X PATCH http://localhost:5000/api/v2/admin/membership-expiry \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberId": 1, "expiresAt": "2027-04-14T00:00:00Z"}'
```

### Expiry Job Test

1. In psql: `UPDATE members SET membership_expires_at = NOW() - INTERVAL '1 day' WHERE id = <test_member_id>;`
2. Restart server or call `runPassportExpiryCheck()` directly
3. Verify member status changed to `passport_revoked`
4. Verify ENS name no longer resolves

### Frontend Smoke Tests

1. Log in as a member with `passport_revoked` status → verify suspended UI appears
2. Log in as a member with `approved_application` status → verify "Passport Being Created" message (no JustaName button)
3. Run `npm run check` — no TypeScript errors after JustaName removal

---

## 20. Gas Cost Estimates (Ethereum Mainnet)

| Operation | Gas Units | Cost at 10 gwei |
|---|---|---|
| `setSubnodeRecord` (create) | ~50,000 | ~$1.50 |
| `setAddr` (resolver) | ~45,000 | ~$1.35 |
| **Total per issuance** | ~95,000 | **~$2.85** |
| `setSubnodeRecord` (revoke) | ~50,000 | **~$1.50** |

These are rough estimates. Mainnet gas prices vary widely. Budget ~$5 per full passport lifecycle (issue + revoke).
