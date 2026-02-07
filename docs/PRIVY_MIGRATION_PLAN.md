# Privy Authentication Migration Plan

## Overview
Migrating from Farcaster-based authentication to Privy (email + passkey + smart wallet), while keeping Farcaster as an optional connected social layer.

**Decision:** Replace Farcaster auth immediately (no dual-auth migration period).

---

## Current Status

### ✅ DONE - Core Infrastructure

| Component | File(s) | Status |
|-----------|---------|--------|
| Database Schema (Auth V2) | `shared/schema.ts` | authUsers, passkeys, smartWallets, farcasterAccounts tables |
| Migration Script | `server/scripts/migrate-auth-v2.ts` | Adds privyId, userId columns, makes farcasterFid nullable |
| Privy Server Client | `server/lib/privy.ts` | PrivyClient initialized with env vars |
| Privy Provider | `client/src/providers/PrivyProvider.tsx` | Email, wallet, google login methods configured |
| Auth Context | `client/src/contexts/AuthContext.tsx` | Conditional Privy support, fallback when disabled |
| Auth Routes | `server/routes/auth.routes.ts` | `/api/v2/auth/login`, `/me`, `/logout` endpoints |
| Auth Middleware | `server/middleware/privyAuth.ts` | Token verification with `verifyAccessToken()` |
| Storage Methods | `server/storage.ts` | `getMemberByPrivyId()`, `createMemberFromPrivy()` |
| Login Button | `client/src/components/PrivyLoginButton.tsx` | Basic Privy login/logout UI |
| App Provider Setup | `client/src/App.tsx` | Providers properly nested |

### ⚠️ PARTIALLY DONE

| Component | Issue | Action Needed |
|-----------|-------|---------------|
| AuthGuard | Still uses Farcaster FID (`profile?.fid`) | Refactor to use Privy AuthContext |
| Home Page | Uses Farcaster `SignInButton` | Replace with Privy login |
| Member Endpoints | Legacy `/api/members/{fid}/*` | Add Privy-compatible endpoints |

### ❌ MISSING - Target Flow

| Priority | Component | Description |
|----------|-----------|-------------|
| 🔴 HIGH | Welcome Page Update | Replace Farcaster SignIn with Privy login modal |
| 🔴 HIGH | AuthGuard Refactor | Support Privy auth alongside/instead of Farcaster |
| 🟡 MEDIUM | Onboarding Flow | Email → Passkey → Wallet → Username → Farcaster (optional) |
| 🟡 MEDIUM | Subdomain Claiming | Integrate JustaName after wallet creation |
| 🟡 MEDIUM | Farcaster Linking | Optional "Connect Farcaster" after Privy auth |
| 🟢 LOW | Passkey Management UI | View/delete registered passkeys |
| 🟢 LOW | Smart Wallet UI | Display wallet address, link to explorer |

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

### Phase 1: Update Home Page (Priority: HIGH)
**Files to modify:**
- `client/src/pages/home.tsx` - Replace Farcaster SignInButton with Privy

**Changes:**
1. Import `useAuth` from AuthContext
2. Replace `SignInButton` with `PrivyLoginButton` or custom button calling `login()`
3. Update "How It Works" section to reflect new flow
4. Handle authenticated state to redirect to dashboard

### Phase 2: Refactor AuthGuard (Priority: HIGH)
**Files to modify:**
- `client/src/components/AuthGuard.tsx`

**Changes:**
1. Import `useAuth` from AuthContext
2. Check `isPrivyAuthenticated` only (no Farcaster fallback)
3. Use `/api/v2/auth/me` for member status instead of FID-based endpoint
4. Update redirect logic for new onboarding flow
5. Remove Farcaster-specific checks (`profile?.fid`, signer status)

### Phase 3: Onboarding Flow (Priority: MEDIUM)
**Files to create/modify:**
- `client/src/pages/onboarding.tsx` (new)
- `server/routes/auth.routes.ts` (extend)

**Steps:**
1. After Privy auth, check if member exists
2. If new: guide through subdomain claim → Farcaster connection
3. If existing: redirect to appropriate page based on status

### Phase 4: Optional Farcaster Connection (Priority: MEDIUM)
**Files to modify:**
- `client/src/pages/id-verification.tsx` or new component

**Changes:**
1. Add "Connect Farcaster" option (not required)
2. Query by wallet address to find existing FID
3. Or guide through Farcaster account creation flow

---

## Files Modified in This Session

| File | Change |
|------|--------|
| `client/src/contexts/AuthContext.tsx` | Conditional Privy support, require import fix |
| `client/src/providers/PrivyProvider.tsx` | Fixed embeddedWallets config |
| `server/middleware/privyAuth.ts` | Fixed verifyAccessToken API |
| `server/routes/auth.routes.ts` | Created auth endpoints |
| `server/routes.ts` | Registered auth routes, fixed types |
| `server/lib/privy.ts` | Added dotenv loading |
| `server/scripts/migrate-auth-v2.ts` | Added privy_id column |
| `server/services/balanceCache.ts` | Fixed null checks |
| `server/scripts/verify-member-addresses.ts` | Fixed nullable type |

---

## Verification Checklist

1. [ ] `npm run check` passes (0 TypeScript errors)
2. [ ] `npm run dev` starts without errors
3. [ ] App loads (no white page)
4. [ ] Privy login modal opens on home page
5. [ ] User can sign in with email
6. [ ] `/api/v2/auth/me` returns user data after login
7. [ ] AuthGuard allows access for Privy-authenticated users
8. [ ] New users can complete onboarding

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

### 1. Fix White Page Issue (CRITICAL)

**Root Cause:** `AuthContext.tsx` line 79 uses `require('@privy-io/react-auth')` which:
- Breaks React's rules of hooks (hooks can't be called from require)
- Doesn't work properly in Vite ESM environment

**Fix:** Refactor to use proper ESM imports with lazy loading or move the import to top-level with conditional rendering.

**Solution - Move import to top, conditionally use hook:**
```tsx
import { usePrivy } from '@privy-io/react-auth';

function AuthProviderWithPrivy({ children }) {
  // usePrivy() now works because import is at top level
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  // ...rest of component
}
```

The `AuthProvider` already checks `PRIVY_ENABLED` before rendering `AuthProviderWithPrivy`, so the import at top-level is safe - the component won't render if Privy is disabled.

### 2. Update home.tsx
Replace Farcaster SignInButton with Privy login

### 3. Update AuthGuard
Support Privy auth only (remove Farcaster auth checks)

### 4. Test End-to-End
Verify login flow works with Privy
