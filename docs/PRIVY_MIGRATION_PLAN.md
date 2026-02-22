# Privy Authentication Migration Plan

**Last Updated:** 2026-02-22

## Overview

Migrated from Farcaster-based authentication to Privy (email + passkey + smart wallet), while keeping Farcaster as an optional connected social layer.

**Decision:** Replace Farcaster auth immediately (no dual-auth migration period).

---

## Current Status: Migration ~95% Complete

### Member Status State Machine (Implemented)

```
LOGIN (Privy - Email or Wallet)
    |
    v
+------------------------------------+
| Create member                      |
| status: pending_id_verification    |
+---------------+--------------------+
                |
    +-----------+-----------+
    | ID Verification Page  |
    | (/id-verification)    |
    | - Connect wallet      |
    | - Verify email        |
    | - Check for passport  |
    +-----------+-----------+
                |
    +-----------+-----------+
    | Has ipecity.eth       |
    | subdomain on wallet?  |
    +---+-------------+-----+
        |             |
       YES            NO
        |             |
        v             v
+----------------+  +-------------------------+
| Sign & Activate|  | Submit Application      |
| (SIWE verify)  |  | (ipeUsername, bio, etc)  |
| -> active_member| +------------+------------+
+----------------+               |
                                 v
                    +-------------------------+
                    | pending_application_    |
                    | review                  |
                    | Awaiting admin          |
                    +------------+------------+
                                 |
                    +------------+------------+
                    | ADMIN      |            |
                    | APPROVE    |     DENY   |
                    v            v            v
           +----------------+ +------------------+
           | Reserve subname| | denied_           |
           | at JustaName   | | application       |
           | -> approved_   | | (end state)       |
           |    application | +------------------+
           +-------+--------+
                   |
                   v (User accepts via JustaName SDK)
           +------------------+
           | active_member    |
           | Set ipePassport  |
           | -> Home page     |
           +------------------+
```

### Status Values

| Status | Description | Redirect |
|--------|-------------|----------|
| `pending_id_verification` | Initial state - needs wallet + email | `/id-verification` |
| `pending_application_review` | Application submitted, awaiting admin | `/id-verification` (shows waiting UI) |
| `approved_application` | Admin approved, subdomain reserved | `/id-verification` (shows accept UI) |
| `denied_application` | Application rejected | `/id-verification` (shows rejection) |
| `active_member` | Full member with passport | Home page / full access |

**Removed statuses:** `pending_signer`, `email_verified`, `pending_application` (legacy Farcaster flow)

---

## Completed

### Core Infrastructure

| Component | File(s) | Status |
|-----------|---------|--------|
| Privy Server Client | `server/lib/privy.ts` | Working |
| Privy Provider | `client/src/providers/PrivyProvider.tsx` | Working |
| Auth Context | `client/src/contexts/AuthContext.tsx` | Working - uses `/api/v2/auth/me` |
| Auth Routes | `server/routes/auth.routes.ts` | `/me`, `/logout`, passport verify/accept |
| Auth Middleware | `server/middleware/privyAuth.ts` | Token verification with `verifyAccessToken()` |
| Storage Methods | `server/storage.ts` | `getMemberByPrivyId()`, `createMemberFromPrivy()`, `upgradeMemberToActive()` |
| Login Button | `client/src/components/PrivyLoginButton.tsx` | Privy login/logout UI |
| CSP Headers | `server/middleware/validation.ts` | `auth.privy.io` allowed |
| Vite Config | `vite.config.ts` | Pre-bundled `@privy-io/react-auth` |

### Authentication Flow

| Feature | Status | Notes |
|---------|--------|-------|
| Privy login (email/passkey) | Done | Working |
| Member auto-creation on first login | Done | `createMemberFromPrivy()` |
| Email sync from Privy identity token | Done | Auto-syncs on `/me` |
| Wallet sync from Privy identity token | Done | Prefers external wallet over embedded |
| Bearer token auth on all V2 endpoints | Done | `authenticatedPost`/`authenticatedGet` from `client/src/lib/api.ts` |
| AuthGuard status-based routing | Done | All 5 statuses handled |

### Member Onboarding (Unified Page)

| Feature | Status | Notes |
|---------|--------|-------|
| Unified `/id-verification` page | Done | Handles all statuses in one page |
| Wallet connection (external preferred) | Done | `useActiveWallet` hook prefers external over embedded |
| Email verification | Done | 6-digit code flow |
| Wallet PATCH to server | Done | Saves wallet on connect with error handling |
| ENS domain detection | Done | `useEnsLookup` hook checks for ipecity.eth subdomains |
| SIWE signature verification | Done | Sign & Activate flow for existing passport holders |
| Application form | Done | `ApplicationForm` component for new applicants |
| Pending review UI | Done | Shows "Application Under Review" message |
| Accept subdomain UI | Done | Shows "Passport Ready" with accept button |
| Subdomain acceptance via JustaName SDK | Done | `useAcceptSubname` hook |
| Active member UI | Done | Shows "Welcome to Ipe City" message |

### Admin

| Feature | Status | Notes |
|---------|--------|-------|
| Application approval | Done | Reserves subdomain via JustaName, sets `approved_application` |
| Application denial | Done | Sets `denied_application` |
| Member type management | Done | Admin can change member types |
| Wallet address display | Done | Shows wallet from DB (matches ID verification) |

### Cleanup (Feb 2026)

| Item | Status | Notes |
|------|--------|-------|
| Removed `SubdomainCheckSection` component | Done | Was a duplicate of `PassportVerificationSection` |
| Removed legacy Farcaster props from PassportVerificationSection | Done | `farcasterFid`, `farcasterProfile`, `allowChange` removed |
| Fixed disconnect button | Done | Uses `disconnectExternalWallet` instead of `privyLogout` |
| Fixed `apiRequest` -> `authenticatedPost` | Done | Passport verify/accept now send Bearer token |
| Fixed overlapping UI states | Done | "Sign & Activate" hidden when status is `approved_application` |
| Added `refreshMember()` to ApplicationForm success | Done | Member data refreshes after form submission |
| Navbar shows ipeUsername | Done | Falls back to email prefix, then "User" |

---

## Remaining Work

### 1. Passport Check on Login (Priority: MEDIUM)

**What:** When a user logs in and has a wallet with an existing ipecity.eth subdomain, the server should auto-upgrade them to `active_member` instead of leaving them at `pending_id_verification`.

**Where:** `server/routes/auth.routes.ts` - `/api/v2/auth/me` endpoint

**Service ready:** `server/services/justanamePassport.ts` exists with `checkWalletForPassport()` but is NOT called from the login flow.

**Implementation:**
```typescript
// In /api/v2/auth/me, after member creation/retrieval:
if (member.status === 'pending_id_verification' && member.walletAddress && !member.ipePassport) {
  const passport = await checkWalletForPassport(member.walletAddress);
  if (passport) {
    member = await storage.upgradeMemberToActive(member.id, passport);
  }
}
```

**How to reproduce:**
1. Reset a member: `UPDATE members SET status = 'pending_id_verification', ipe_passport = NULL, passport_verified = false WHERE ipe_username = 'ganutf';`
2. Log in — user lands on `/id-verification` instead of being auto-upgraded

**Caching strategy:** Only check JustaName if `ipePassport` is NULL (Option 3 from original plan).

### 2. Farcaster Connection UI (Priority: LOW - Optional)

**What:** Allow users to optionally link their Farcaster account from their profile page.

**DB ready:** `farcasterAccounts` table exists in schema but no UI or endpoints.

**Not blocking:** Farcaster is optional — members can be fully active without it.

---

## Architectural Decisions

### Unified Page vs Separate Pages
**Plan proposed:** 5 separate pages (`/connected-apps`, `/apply`, `/waiting-approval`, `/accept-subdomain`, `/application-denied`)

**Implemented:** Single `/id-verification` page with `PassportVerificationSection` handling the full state machine. This is simpler, has less routing complexity, and works well.

### Email Requirement
**Plan proposed:** Email as optional integration

**Implemented:** Email verification is part of the onboarding flow on `/id-verification`. Privy handles email collection at login time, so most users have email automatically.

### Wallet Preference
**Implemented:** Both client (`useActiveWallet` hook) and server (identity token parsing) prefer external wallets over Privy embedded wallets. This ensures the wallet address is consistent across admin review and user-facing pages.

---

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/auth.routes.ts` | All V2 auth endpoints (me, logout, verify, accept, application) |
| `server/middleware/privyAuth.ts` | Bearer token verification middleware |
| `server/storage.ts` | DB operations including member CRUD and `upgradeMemberToActive` |
| `server/services/justanamePassport.ts` | Passport check service (not yet integrated into login) |
| `client/src/contexts/AuthContext.tsx` | Auth state management, calls `/api/v2/auth/me` |
| `client/src/components/AuthGuard.tsx` | Status-based route protection |
| `client/src/pages/id-verification.tsx` | Unified onboarding/verification page |
| `client/src/components/PassportVerificationSection.tsx` | Full passport state machine UI |
| `client/src/hooks/useActiveWallet.ts` | Wallet preference logic (external > embedded) |
| `client/src/lib/api.ts` | Authenticated API request helpers with Bearer token |
| `shared/constants.ts` | Member status constants |

---

## Environment Variables Required

```env
# Frontend
VITE_PRIVY_APP_ID=your-privy-app-id

# Backend
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
DATABASE_URL=postgresql://...
NEYNAR_API_KEY=...
JUSTANAME_API_KEY=...
SESSION_SECRET=...
```
