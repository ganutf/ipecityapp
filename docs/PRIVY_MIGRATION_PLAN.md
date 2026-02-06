# Privy Authentication Migration Plan












Redesigned Member Status State Machine - Passport-First Approach
User's Vision
Core Principles:

Passport-first verification: Check JustaName for ipecity.eth subdomain ownership FIRST
Two paths to membership: Apply for subdomain OR connect wallet with existing subdomain
Centralized integrations: Email, Farcaster, Additional Wallet, Passkey on one "connected apps" page
Wallet-centric: Wallet connection is primary, email is optional integration
Correct State Machine (Status + Boolean Flags)
Member has 3 boolean flags:
emailVerified (boolean) - Email verification completed
walletAddress (string | null) - Wallet connected
ipePassport (string | null) - Subdomain linked to wallet
Pre-requisites for active membership:
✅ Wallet connected (walletAddress != null)
✅ Email verified (emailVerified = true)
✅ Subdomain linked (ipePassport != null)

LOGIN (Privy - Email or Wallet)
    ↓
┌────────────────────────────────────┐
│ Create member                      │
│ status: pending_id_verification    │
└────────────┬───────────────────────┘
             │
     ┌───────┴────────────────┐
     │ Check 3 conditions:    │
     │ 1. Has wallet?         │
     │ 2. Email verified?     │
     │ 3. Has subdomain?      │
     └───────┬────────────────┘
             │
     ┌───────┴────────────┐
     │ ALL 3 SATISFIED?   │
     └───────┬────────────┘
             │
     ┌───────┴────────┐
     │ YES            │ NO
     ↓                ↓
┌──────────────────┐  ┌──────────────────────────┐
│ [active_member]  │  │ Missing wallet OR email? │
│ → Main page      │  └──────────┬───────────────┘
└──────────────────┘             │
                         ┌───────┴────────┐
                         │ YES            │ NO (has wallet + email)
                         ↓                ↓
              ┌─────────────────────┐  ┌─────────────────────┐
              │ [pending_id_        │  │ Check JustaName for │
              │  verification]      │  │ subdomain on wallet │
              │ → /connected-apps   │  └─────────┬───────────┘
              │ (connect wallet +   │            │
              │  verify email)      │    ┌───────┴────────┐
              └─────────────────────┘    │ SUBDOMAIN      │
                                         │ FOUND?         │
                                         └───────┬────────┘
                                                 │
                                         ┌───────┴────────┐
                                         │ YES            │ NO
                                         ↓                ↓
                                ┌──────────────────┐  ┌────────────────────┐
                                │ [active_member]  │  │ [email_verified]   │
                                │ Set ipePassport  │  │ → /apply           │
                                │ → Main page      │  │ (submit app)       │
                                └──────────────────┘  └─────────┬──────────┘
                                                                │
                                                                ↓
                                                     ┌─────────────────────────┐
                                                     │ User fills application  │
                                                     │ (ipeUsername, bio, etc) │
                                                     └─────────┬───────────────┘
                                                               ↓
                                                     ┌─────────────────────────┐
                                                     │ [pending_application_   │
                                                     │  review]                │
                                                     │ Awaiting admin          │
                                                     └─────────┬───────────────┘
                                                               │
                                                       ┌───────┴────────┐
                                                       │ ADMIN DECISION │
                                                       └───────┬────────┘
                                                ┌──────────────┴──────────────┐
                                                │ APPROVE                     │ DENY
                                                ↓                             ↓
                                       ┌──────────────────┐          ┌──────────────────┐
                                       │ Reserve subdomain│          │ [denied_         │
                                       │ at JustaName     │          │  application]    │
                                       │ → [approved_     │          │ Rejected         │
                                       │    application]  │          └──────────────────┘
                                       └─────────┬────────┘
                                                 ↓ (User accepts via JustaName SDK)
                                        ┌──────────────────┐
                                        │ [active_member]  │
                                        │ Set ipePassport  │
                                        │ → Main page      │
                                        └──────────────────┘
Status Values Used
pending_id_verification - Incomplete onboarding (missing wallet OR email OR subdomain)
email_verified - Has wallet + email verified, but no subdomain → Show /apply page
pending_application_review - Application submitted, awaiting admin
approved_application - Admin approved, subdomain reserved
denied_application - Application rejected
active_member - All 3 conditions met (wallet + email + subdomain)
Key Changes from Current Implementation
1. Login Flow Changes
CURRENT: Login → Create member with pending_id_verification → Email verification required

NEW:

Login → Create member with pending_id_verification status
Check 3 conditions:
Has wallet? (walletAddress != null)
Email verified? (emailVerified = true)
Has subdomain? (check JustaName)
If missing wallet OR email → Status stays pending_id_verification → Redirect to /connected-apps
If has wallet + email, but NO subdomain → Update to email_verified → Redirect to /apply
If has wallet + email + subdomain → Update to active_member → Redirect to main page
2. Status Flow (Corrected)
Status	Conditions	Redirect To	Next Status
pending_id_verification	Missing wallet OR missing email verification	/connected-apps	→ email_verified (after wallet + email done)
email_verified	Has wallet + email verified, NO subdomain	/apply	→ pending_application_review (after submitting app) OR → active_member (if subdomain found later)
pending_application_review	Application submitted, awaiting admin	/waiting-approval	→ approved_application (approved) OR → denied_application (rejected)
approved_application	Admin approved, subdomain reserved	/accept-subdomain	→ active_member (after user accepts subdomain)
denied_application	Application rejected	/application-denied	End state
active_member	Has wallet + email + subdomain	Main page/dashboard	Final state
3. "Connected Apps" Page
New centralized page for all integrations:

✅ Email verification (optional, not required for membership)
✅ Farcaster connection (optional)
✅ Additional Wallet (optional)
✅ Passkey (optional)
Purpose: Members can be active WITHOUT email/Farcaster, as long as they have passport

4. JustaName Integration Points
NEW API calls needed:

On login (if wallet connected): Check if wallet owns ipecity.eth subdomain
"Connect wallet with passport" button: Check if connected wallet owns subdomain
Existing: Reserve subdomain after admin approval (already implemented)
Implementation Plan
Phase 1: JustaName Passport Check Service
Create: server/services/justanamePassport.ts


import { lookupEnsName } from '../lib/ensLookup';

/**
 * Check if wallet address owns any ipecity.eth subdomain
 * Returns subdomain name or null
 *
 * NOTE: Reuses existing lookupEnsName() which already:
 * - Calls JustaName API
 * - Filters for ipecity.eth domains
 * - Returns array of claimed subdomains
 */
export async function checkWalletForPassport(walletAddress: string): Promise<string | null> {
  const result = await lookupEnsName(walletAddress);

  if (result.ensNames && result.ensNames.length > 0) {
    return result.ensNames[0]; // Return first ipecity.eth subdomain
  }

  return null;
}
Dependencies: Uses existing lookupEnsName() from server/lib/ensLookup.ts (already implemented)

Phase 2: Update Login Flow
File: server/routes/auth.routes.ts - /api/v2/auth/me endpoint

Logic on EVERY /me call:

If NEW member: Create with status: 'pending_id_verification'
Check 3 conditions:
walletAddress != null?
emailVerified = true?
Has subdomain? (call checkWalletForPassport())
If ALL 3 satisfied → Update to active_member (if not already)
If missing wallet OR email → Keep pending_id_verification
If has wallet + email, NO subdomain → Update to email_verified
Return member with current status
This status check happens on EVERY /me call - AuthGuard redirects based on status

File: server/storage.ts - Update createMemberFromPrivy


async createMemberFromPrivy(
  privyId: string,
  email?: string,
  walletAddress?: string
): Promise<Member> {
  // Always create with pending_id_verification status
  // Status will be updated after passport check completes
  const [member] = await db.insert(members).values({
    privyId,
    email,
    walletAddress,
    status: 'pending_id_verification',  // Initial status while checking passport
    memberType: 'pending',
  }).returning();
  return member;
}
NEW Method: server/storage.ts - Add upgradeMemberToActive


async upgradeMemberToActive(
  memberId: number,
  ipePassport: string,
  memberType: string = 'explorer'
): Promise<Member> {
  const [member] = await db
    .update(members)
    .set({
      status: 'active_member',
      ipePassport,
      passportVerified: true,
      memberType,
      updatedAt: new Date(),
    })
    .where(eq(members.id, memberId))
    .returning();
  return member;
}
Phase 3: Connected Apps Page (Priority)
Modify: client/src/pages/id-verification.tsx → Rename to client/src/pages/connected-apps.tsx

Shows (when status = pending_id_verification):

"Complete Your Profile" header
Email Verification Section (reuse EmailVerificationSection component)
Shows status: verified or not
If not verified, allows user to verify email
Wallet Connection Section
Shows connected wallet or "Connect Wallet" button
Uses RainbowKit ConnectButton
Farcaster Section (optional, reuse FarcasterConnectionSection)
User stays on this page until emailVerified = true AND walletAddress != null
Routing: AuthGuard redirects pending_id_verification to /connected-apps

Phase 4: Application Page
Create: client/src/pages/apply.tsx

Shows (when status = email_verified):

"Apply for Membership" header
Application form (reuse existing ApplicationForm component)
User must have wallet + email already (enforced by status)
Submit button creates application → status changes to pending_application_review
Routing: AuthGuard redirects email_verified status to /apply

Phase 5: Update Application Flow
Keep existing:

Application form at client/src/components/ApplicationForm.tsx
Admin approval at server/routes.ts (approve/deny endpoints)
Subdomain reservation via JustaName
Status after submission: pending_application_review (no rename needed)
Phase 6: Additional Pages (Lower Priority)
Create: client/src/pages/waiting-approval.tsx, client/src/pages/accept-subdomain.tsx, client/src/pages/application-denied.tsx

These pages show appropriate messages for each status state.

Phase 7: Status Constants Update
File: shared/constants.ts


export const MEMBER_STATUSES = [
  'pending_id_verification',     // Initial status - checking for passport
  'email_verified',              // No passport found, ready to apply
  'pending_application_review',  // Application submitted, awaiting admin (keep existing name)
  'approved_application',        // Admin approved, subdomain reserved
  'denied_application',          // Application rejected
  'active_member',               // Full member with passport
] as const;

// Remove unused statuses:
// - 'pending_signer' (legacy Farcaster flow)
// - 'pending_application' (never used in any code path)
Phase 8: AuthGuard Updates
File: client/src/components/AuthGuard.tsx

New routing logic:


switch (memberStatus) {
  case 'pending_id_verification':
    // Missing wallet OR email - redirect to connected apps page
    if (location.pathname !== '/connected-apps') {
      return <Navigate to="/connected-apps" replace />;
    }
    break;

  case 'email_verified':
    // Has wallet + email, but no subdomain - show application page
    if (location.pathname !== '/apply') {
      return <Navigate to="/apply" replace />;
    }
    break;

  case 'pending_application_review':
    // Show waiting for admin approval page
    if (location.pathname !== '/waiting-approval') {
      return <Navigate to="/waiting-approval" replace />;
    }
    break;

  case 'approved_application':
    // Show subdomain acceptance page
    if (location.pathname !== '/accept-subdomain') {
      return <Navigate to="/accept-subdomain" replace />;
    }
    break;

  case 'active_member':
    // Full access - allow navigation to main pages
    break;

  case 'denied_application':
    // Show rejection message
    if (location.pathname !== '/application-denied') {
      return <Navigate to="/application-denied" replace />;
    }
    break;
}
Database Schema Changes
Migration Required
File: Create server/scripts/migrate-status-v3.ts


-- Clean up unused status (pending_application never used)
UPDATE members
SET status = 'email_verified'
WHERE status = 'pending_application';

-- No changes needed to pending_application_review (keeping existing name)
-- No changes needed to pending_id_verification (still in use)

-- Update CHECK constraint to remove unused 'pending_application' and 'pending_signer'
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN (
    'pending_id_verification',
    'email_verified',
    'pending_application_review',
    'approved_application',
    'denied_application',
    'active_member'
  ));
New API Endpoints
NONE NEEDED - Passport check happens during login in /api/v2/auth/me endpoint

The login flow will be modified to check JustaName and set status accordingly during member creation.

Files to Create
server/services/justanamePassport.ts - Passport check service
server/storage.ts - Add upgradeMemberToActive() method
client/src/pages/connected-apps.tsx - Wallet + Email completion page (rename from id-verification.tsx)
client/src/pages/apply.tsx - Application page (new)
client/src/pages/waiting-approval.tsx - Waiting for admin approval message
client/src/pages/accept-subdomain.tsx - Accept reserved subdomain (might already exist)
client/src/pages/application-denied.tsx - Application rejection message
server/scripts/migrate-status-v3.ts - Database migration for unused statuses
Files to Modify
Critical Changes
server/storage.ts

Line 1044: Update createMemberFromPrivy signature
Add ipePassport parameter and conditional status
server/routes/auth.routes.ts

/api/v2/auth/login: Add JustaName passport check on login
Add new endpoints: /check-passport, /link-passport
shared/constants.ts

Line 6-15: Update MEMBER_STATUSES array
Remove unused statuses, add waiting_approval
client/src/components/AuthGuard.tsx

Update routing logic for new status flow
Redirect pending_id_verification to /connected-apps
Redirect email_verified to /apply
Redirect pending_application_review to /waiting-approval
client/src/pages/id-verification.tsx

Rename to /connected-apps.tsx
Show Email + Wallet sections (reuse existing components)
User must complete both to proceed
client/src/pages/apply.tsx

NEW page for application form
Only accessible when status = email_verified
Secondary Changes
server/routes.ts

No changes needed - already uses pending_application_review
client/src/components/Layout.tsx

No changes needed (connected-apps is part of onboarding, not main navigation)
JustaName API Research - COMPLETE ✅
Existing Implementation Found: /home/ganutf/projects/ipecity/ipecity-pulse/server/lib/ensLookup.ts

The codebase ALREADY has passport checking functionality:

lookupIpecitySubdomain(address: string) function (line 136)
JustaName API Endpoint:


GET https://api.justaname.id/ens/v1/subname/address?address={address}&chainId=1
Response Format:


{
  statusCode: number;
  result: {
    data: {
      subnames: Array<{
        id: string;
        ens: string;              // e.g. "testuser.ipecity.eth"
        username: string;
        isClaimed: boolean;       // ✅ IMPORTANT: Must be true
        isReserved: boolean;
        claimAddress: string | null;
        // ...
      }>;
    };
    error: string | null;
  };
}
Current Logic:

Queries all ENS subdomains owned by the wallet address
Filters for isClaimed === true AND ens.endsWith('.ipecity.eth')
Returns array of ipecity.eth subdomain names
Usage:

Already exposed via /api/ens/lookup/:address endpoint
Frontend uses useEnsLookup(address) hook
PassportVerificationSection already checks for passport on wallet connection
What We Need to Add
NEW Service: server/services/justanamePassport.ts


import { lookupEnsName } from '../lib/ensLookup';

/**
 * Check if wallet address owns any ipecity.eth subdomain
 * Returns subdomain name or null
 */
export async function checkWalletForPassport(walletAddress: string): Promise<string | null> {
  const result = await lookupEnsName(walletAddress);

  // lookupEnsName already filters for ipecity.eth domains
  if (result.ensNames && result.ensNames.length > 0) {
    return result.ensNames[0]; // Return first ipecity.eth subdomain
  }

  return null;
}
Key Insight: We can reuse the existing lookupEnsName() function! No need to call JustaName API directly.

Caching Strategy
Current Implementation (client-side):

useEnsLookup hook caches results for 5 minutes (line 24 of useEnsLookup.ts)
Uses React Query for automatic caching
Server-side: No caching currently implemented

Optimization for Login Flow:

Option 1: Accept extra API call on every login (simple, always fresh)
Option 2: Cache passport status in members table with lastPassportCheck timestamp
Option 3: Skip check on login if member already has ipePassport set (only check if NULL)
Recommendation: Start with Option 3 - only check JustaName if ipePassport is NULL in database

Verification Steps
1. New User with Wallet + Verified Email + Subdomain

1. Clear cookies/localStorage
2. Go to home page, click "Sign In"
3. Sign in with Privy (wallet that owns "testuser.ipecity.eth")
4. Verify email via Privy
5. Check: /me endpoint detects all 3 conditions satisfied
6. Check: Status changes from pending_id_verification → active_member
7. Check: Redirected to main page/dashboard
8. Check database: status = 'active_member', emailVerified = true, walletAddress set, ipePassport = 'testuser.ipecity.eth'
2. New User Missing Email or Wallet

1. Clear cookies/localStorage
2. Sign in with Privy (email only, no wallet yet)
3. Check: Status = pending_id_verification
4. Check: Redirected to /connected-apps
5. User sees "Complete Your Profile" page
6. Connect wallet via RainbowKit
7. Verify email via EmailVerificationSection
8. Check: After both done, status changes to email_verified
9. Check: Redirected to /apply page
3. New User with Wallet + Email, No Subdomain (Apply Path)

1. User has completed /connected-apps (wallet + email verified)
2. Check: Status = email_verified
3. Check: Redirected to /apply page
4. Fill application form (ipeUsername, bio, etc), submit
5. Check database: status = 'pending_application_review'
6. Admin approves
7. Check database: status = 'approved_application', subdomain reserved
8. User accepts subdomain via JustaName SDK on /accept-subdomain page
9. Check database: status = 'active_member', ipePassport set
10. Check: Redirected to main page
4. Existing User Acquires Subdomain Externally

1. User was in email_verified status (on /apply page)
2. User acquires ipecity.eth subdomain outside the app
3. User refreshes page or logs in again
4. Check: /me endpoint detects subdomain now exists
5. Check: Status updates from email_verified → active_member
6. Check: Redirected to main page
Key Design Decisions
Email is Optional
Current: Email verification required before anything else
New: Email is just another integration on "Connected Apps" page

Impact: Members can be fully active without email if they have passport

Passport Check on Every Login
Benefit: Detects if user acquired passport externally
Cost: Extra JustaName API call on every login
Optimization: Cache passport status in database, recheck periodically

Simplified Flow - One Path to Membership
If wallet has passport on login: Instant active_member status (automatic detection)
If wallet doesn't have passport: Apply → admin approval → subdomain reservation → accept → active_member

User Experience:

Users with existing passport get immediate access (no extra clicks needed)
Users without passport always see application page (simple, clear path)
Centralized Integrations
Current: Email, Farcaster, Passport scattered across different pages
New: One "Connected Apps" page for everything

Benefit: Cleaner UX, easier to understand what's connected

Migration Strategy for Existing Users
Existing users in old statuses:

pending_id_verification → email_verified (start over at membership options)
pending_application → email_verified (never used anyway)
pending_application_review → waiting_approval (rename)
All other statuses remain the same
Run migration script before deployment

Risk Assessment
Low Risk:

Creating new pages/components
Adding new API endpoints
Database migration (only renames existing statuses)
Medium Risk:

Changing AuthGuard routing logic (test thoroughly)
JustaName API integration (depends on API availability)
High Risk:

Removing email verification requirement (breaking change for existing flow)
Status constant changes (affects all code referencing statuses)
Summary
The Vision:

Passport-first membership (check JustaName on login)
Two paths: Apply OR connect wallet with passport
Email/Farcaster/Additional Wallet/Passkey as optional integrations
Core Changes:

Login checks JustaName for ipecity.eth subdomain
New "Membership Options" page (apply or connect wallet)
Rename pending_application_review → waiting_approval
New "Connected Apps" page for all integrations
Remove email verification requirement
Estimated Scope:

7 new files
8 modified files
1 database migration
JustaName API integration research
Next Steps:

Research JustaName API for wallet passport check
Get user approval on this design
Begin implementation with Phase 1 (JustaName service)














## Overview
Migrating from Farcaster-based authentication to Privy (email + passkey + smart wallet), while keeping Farcaster as an optional connected social layer.

**Decision:** Replace Farcaster auth immediately (no dual-auth migration period).

**Last Updated:** 2026-02-02

---

## Current Status

### ✅ DONE - Core Infrastructure

| Component                 | File(s)                                      | Status                                                             |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| Database Schema (Auth V2) | `shared/schema.ts`                           | authUsers, passkeys, smartWallets, farcasterAccounts tables        |
| Migration Script          | `server/scripts/migrate-auth-v2.ts`          | Adds privyId, userId columns, makes farcasterFid nullable          |
| Privy Server Client       | `server/lib/privy.ts`                        | PrivyClient initialized with env vars                              |
| Privy Provider            | `client/src/providers/PrivyProvider.tsx`     | Email, wallet, google login methods configured                     |
| Auth Context              | `client/src/contexts/AuthContext.tsx`        | Conditional Privy support, uses `usePrivy()` hook correctly        |
| Auth Routes               | `server/routes/auth.routes.ts`               | `/api/v2/auth/login`, `/me`, `/logout` endpoints                   |
| Auth Middleware           | `server/middleware/privyAuth.ts`             | Token verification with `verifyAccessToken()`                      |
| Storage Methods           | `server/storage.ts`                          | `getMemberByPrivyId()`, `createMemberFromPrivy()`                  |
| Login Button              | `client/src/components/PrivyLoginButton.tsx` | Basic Privy login/logout UI                                        |
| App Provider Setup        | `client/src/AppWithPrivy.tsx`                | Providers properly nested (QueryClientProvider wraps AuthProvider) |
| CSP Security Headers      | `server/middleware/validation.ts`            | Added `auth.privy.io` to connect-src and frame-src                 |
| Vite Config               | `vite.config.ts`                             | Pre-bundled @privy-io/react-auth for stability                     |

### ✅ DONE - Frontend Integration

| Component          | File(s)                               | Status                                                                              |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Welcome Page       | `client/src/pages/home.tsx`           | Uses `useAuth()` with `login()` for Privy authentication                            |
| AuthGuard          | `client/src/components/AuthGuard.tsx` | Refactored to use Privy AuthContext (`isAuthenticated`, `isMember`, `memberStatus`) |
| Provider Order Fix | `client/src/AppWithPrivy.tsx`         | Fixed - AuthProvider now inside QueryClientProvider                                 |

### ✅ VERIFIED WORKING

| Test                                | Status                           |
| ----------------------------------- | -------------------------------- |
| App loads without white page        | ✅ Working                        |
| Privy login modal opens             | ✅ Working                        |
| Email sign-in works                 | ✅ Working (confirmed 2026-02-02) |
| CSP allows Privy iframe             | ✅ Working                        |
| Member auto-creation on first login | ✅ Working                        |
| Email verification with memberId    | ✅ Working                        |
| Passport verification with memberId | ✅ Working                        |
| Profile updates with memberId       | ✅ Working                        |

### ✅ COMPLETE - farcasterFid → memberId Migration

**Problem:** ✅ RESOLVED - API routes now use `memberId` as the universal identifier.

**Decision:** Replace all `farcasterFid` with `memberId` as the universal identifier.

| Priority | Component                           | Status                                                                |
| -------- | ----------------------------------- | --------------------------------------------------------------------- |
| 🔴 HIGH   | API Routes Migration (v2 endpoints) | ✅ DONE - Created new v2 endpoints                                     |
| 🔴 HIGH   | Auth Context                        | ✅ DONE - Added memberId, auto-create member                           |
| 🟡 MEDIUM | Frontend Updates                    | ✅ DONE - All pages use memberId                                       |
| 🟡 MEDIUM | Onboarding Flow                     | ⏳ PARTIAL - Email verification working, needs Farcaster connection UI |
| 🟢 LOW    | Farcaster Linking                   | 📋 PLANNED - Optional "Connect Farcaster" UI                           |

### ❌ REMAINING - Farcaster Integration

**Strategy:** Keep Farcaster as **optional integration** (not required for membership).

| Priority | Component                 | Description                                                     |
| -------- | ------------------------- | --------------------------------------------------------------- |
| 🔴 HIGH   | Farcaster Connection UI   | Add "Connect Farcaster" flow with two options: Import or Create |
| 🟡 MEDIUM | Import Account            | Link existing Farcaster via Warpcast app (like signer approval) |
| 🟡 MEDIUM | Create New Account        | Programmatic account creation without leaving app               |
| 🟢 LOW    | Admin Endpoints Migration | Update admin routes to use memberId                             |

---

## Target User Flow

```
1. Welcome Page
   ├── [Sign In] → Privy modal (email/passkey)
   └── [Create Account] → Privy modal → email → code → passkey

2. Post-Auth (New User)
   ├── Create smart wallet (automatic via Privy)
   ├── Claim Ipê subdomain (username.ipecity.eth)
   └── Connect Farcaster (optional: import or create)

3. Post-Auth (Returning User)
   └── Direct to dashboard
```

---

## Implementation Phases

### Phase 1: Update Home Page (Priority: HIGH) ✅ COMPLETE
**Files modified:**
- `client/src/pages/home.tsx` - Now uses `useAuth()` with `login()` for Privy

**Changes completed:**
1. ✅ Import `useAuth` from AuthContext
2. ✅ Button calls `login()` from Privy-enabled AuthContext
3. ✅ "How It Works" section reflects email/passkey/wallet flow
4. ✅ Authenticated state redirects to community/dashboard

### Phase 2: Refactor AuthGuard (Priority: HIGH) ✅ COMPLETE
**Files modified:**
- `client/src/components/AuthGuard.tsx`

**Changes completed:**
1. ✅ Import `useAuth` from AuthContext
2. ✅ Uses `isAuthenticated` from Privy AuthContext
3. ✅ Uses `/api/v2/auth/me` via AuthContext query
4. ✅ Updated redirect logic for member status
5. ✅ Removed Farcaster-specific checks

### Phase 3: Onboarding Flow (Priority: MEDIUM) 🔄 IN PROGRESS
**Files to create/modify:**
- `client/src/pages/onboarding.tsx` (new - optional)
- `server/routes/auth.routes.ts` (extend for member creation)

**Current behavior:**
- After Privy auth, AuthContext queries `/api/v2/auth/me`
- New users (no member record) stay on home page
- Need: Create member record automatically or via onboarding

**Steps remaining:**
1. Auto-create member record on first Privy login OR
2. Guide through subdomain claim → Farcaster connection (optional)

### Phase 4: Optional Farcaster Connection (Priority: MEDIUM) 📋 PLANNED
**Files to modify:**
- `client/src/pages/id-verification.tsx` or new component

**Changes:**
1. Add "Connect Farcaster" option (not required)
2. Query by wallet address to find existing FID
3. Or guide through Farcaster account creation flow

---

## Files Modified (All Sessions)

| File                                        | Change                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| `client/src/contexts/AuthContext.tsx`       | Conditional Privy support, proper `usePrivy()` hook usage      |
| `client/src/providers/PrivyProvider.tsx`    | Fixed embeddedWallets config                                   |
| `client/src/AppWithPrivy.tsx`               | Fixed provider order (AuthProvider inside QueryClientProvider) |
| `client/src/pages/home.tsx`                 | Uses `useAuth()` with `login()` for Privy                      |
| `client/src/components/AuthGuard.tsx`       | Refactored for Privy auth only                                 |
| `server/middleware/privyAuth.ts`            | Fixed verifyAccessToken API                                    |
| `server/middleware/validation.ts`           | Added CSP rules for auth.privy.io (connect-src, frame-src)     |
| `server/routes/auth.routes.ts`              | Created auth endpoints                                         |
| `server/routes.ts`                          | Registered auth routes, fixed types                            |
| `server/lib/privy.ts`                       | Added dotenv loading                                           |
| `server/scripts/migrate-auth-v2.ts`         | Added privy_id column                                          |
| `server/services/balanceCache.ts`           | Fixed null checks                                              |
| `server/scripts/verify-member-addresses.ts` | Fixed nullable type                                            |
| `vite.config.ts`                            | Pre-bundled @privy-io/react-auth in optimizeDeps               |

---

## Verification Checklist

1. [x] `npm run check` passes (0 TypeScript errors)
2. [x] `npm run dev` starts without errors
3. [x] App loads (no white page)
4. [x] Privy login modal opens on home page
5. [x] User can sign in with email ✅ Confirmed 2026-02-02
6. [ ] `/api/v2/auth/me` returns user data after login
7. [x] AuthGuard allows access for Privy-authenticated users
8. [ ] New users can complete onboarding (Phase 3)

---

## Environment Variables Required

```env
# Frontend
VITE_PRIVY_APP_ID=your-privy-app-id

# Backend
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
```

---

## Next Immediate Steps

### ✅ RESOLVED - Provider Order Issue (was CRITICAL)

**Root Cause:** `AuthProviderWithPrivy` called `useQueryClient()` but `QueryClientProvider` was nested inside `AuthProvider`.

**Fix Applied:** Moved `AuthProvider` inside `QueryClientProvider` in `AppWithPrivy.tsx`.

### ✅ RESOLVED - CSP Blocking Privy

**Root Cause:** Content Security Policy blocked connections to `auth.privy.io` and iframe loading.

**Fix Applied:** Added to `server/middleware/validation.ts`:
- `connect-src`: `https://auth.privy.io`
- `frame-src`: `https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org`

### 🔴 NEXT - farcasterFid → memberId Migration

**Endpoints to update (server/routes.ts):**

| Endpoint                               | Current           | Target                      |
| -------------------------------------- | ----------------- | --------------------------- |
| `/api/members/check/:farcasterFid`     | GET with FID      | `/api/v2/members/:memberId` |
| `/api/admin/approve-member`            | body.farcasterFid | body.memberId               |
| `/api/admin/deny-member`               | body.farcasterFid | body.memberId               |
| `/api/admin/update-member-type`        | body.farcasterFid | body.memberId               |
| `/api/auth/request-email-verification` | body.farcasterFid | body.memberId               |
| `/api/auth/verify-email`               | body.farcasterFid | body.memberId               |
| `/api/passport/*`                      | body.farcasterFid | body.memberId               |
| `/api/ens/claim`, `/api/ens/accept`    | body.farcasterFid | body.memberId               |

**Implementation order:**
1. Update `/api/v2/auth/me` to return full member with `id` (memberId)
2. Add `memberId` to AuthContext
3. Create member record on first Privy login
4. Update verification/admin endpoints to use memberId
5. Update frontend pages to use memberId from AuthContext

### 📋 PLANNED - Farcaster Connection (Optional)

**Status:** Not started. Lower priority since Privy auth is primary.

**Approach:** Add "Connect Farcaster" button on profile page that:
1. Links existing Farcaster account by wallet address lookup
2. Or creates new Farcaster account via Neynar
