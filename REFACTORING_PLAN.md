# Codebase Improvement Plan

A comprehensive plan to improve code quality, modularity, and maintainability across the ipecity-pulse codebase.

---

## Executive Summary

| Category | Issues Found | Priority |
|----------|--------------|----------|
| Backend Architecture | 2,850-line routes.ts, no service layer | HIGH |
| Duplicated Code | 15+ patterns repeated across files | HIGH |
| Validation Fragmentation | Same schemas in 3+ locations | HIGH |
| Debug Logging | 197+ console.logs in production code | MEDIUM |
| Unused Code | 8+ dead/deprecated functions | MEDIUM |
| Missing Constants | Hardcoded values throughout | MEDIUM |

---

## Phase 1: Backend Architecture Refactoring

### 1.1 Split routes.ts into Domain Modules

**Problem**: `server/routes.ts` is 2,850 lines with 55+ handlers.

**Create new structure:**
```
server/
├── routes/
│   ├── index.ts          # Route registration
│   ├── auth.routes.ts    # Authentication & signers
│   ├── members.routes.ts # Member CRUD & profiles
│   ├── pulses.routes.ts  # Pulse management
│   ├── community.routes.ts # Community & stats
│   ├── admin.routes.ts   # Admin operations
│   └── attestations.routes.ts # EAS attestations
```

**Files to modify:**
- [server/routes.ts](server/routes.ts) - Extract and delete content
- Create 6 new route files

### 1.2 Create Service Layer

**Problem**: Business logic mixed with route handlers, 180+ direct `storage.*()` calls.

**Create services:**
```
server/services/
├── MemberService.ts      # Member operations
├── PulseService.ts       # Already exists, expand
├── AttestationService.ts # EAS attestation logic
├── SignerService.ts      # Farcaster signer management
└── NotificationService.ts # Email notifications
```

### 1.3 Create Utility Helpers

**Problem**: Repeated patterns like member lookup (16+ times).

**Create helpers in `server/lib/routeHelpers.ts`:**
```typescript
// Replace 16+ repeated getMemberByFarcasterFid() calls
async function getMemberOrThrow(fid: number): Promise<Member>

// Replace 6 identical status update patterns in storage.ts
async function updateMemberStatus(memberId: number, status: string): Promise<Member>
```

**Files affected:**
- [server/storage.ts](server/storage.ts) lines 358-460 (6 duplicate methods)
- [server/routes.ts](server/routes.ts) (16+ member lookups)

---

## Phase 2: Consolidate Validation & Types

### 2.1 Create Shared Validation Module

**Problem**: Validation schemas duplicated in 3 locations.

**Current duplicates:**
| Schema | shared/schema.ts | server/validation.ts | client/ApplicationForm.tsx |
|--------|------------------|---------------------|---------------------------|
| Username | line 228 | line 18 | line 26 |
| Email | line 235 | line 25 | via Zod |
| Bio | line 241 | line 49 | line 27 |
| Social | line 253 | line 43 | lines 28-42 |

**Solution - Create `shared/validation/`:**
```
shared/
├── validation/
│   ├── schemas.ts    # Single source of truth for all Zod schemas
│   ├── constants.ts  # MAX_USERNAME_LENGTH, etc.
│   └── index.ts      # Re-exports
```

**Files to modify:**
- [shared/schema.ts](shared/schema.ts) - Move validation to shared/validation/
- [server/middleware/validation.ts](server/middleware/validation.ts) - Import from shared, delete duplicates
- [client/src/components/ApplicationForm.tsx](client/src/components/ApplicationForm.tsx) - Import from shared

### 2.2 Create Shared Constants

**Problem**: Hardcoded values scattered throughout.

**Create `shared/constants.ts`:**
```typescript
// Validation limits
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BIO_MAX_LENGTH = 500;
export const MAX_PROFILE_TAGS = 5;

// Timing
export const POLLING_INTERVAL_MS = 2000;
export const CIRCUIT_BREAKER_TIMEOUT_MS = 30000;

// Member statuses (single source of truth)
export const MEMBER_STATUSES = ['pending_signer', 'pending_id_verification', ...] as const;

// Member types
export const MEMBER_TYPES = ['pending', 'architect', 'explorer', 'admin', 'org_team', 'core_team'] as const;
```

**Files with hardcoded values:**
- [client/src/components/ApplicationForm.tsx](client/src/components/ApplicationForm.tsx) lines 22-27
- [client/src/pages/pulse-dashboard.tsx](client/src/pages/pulse-dashboard.tsx) lines 129, 135, 153, 178, 570-571
- [client/src/lib/dateUtils.ts](client/src/lib/dateUtils.ts) lines 47-62

### 2.3 Move Profile Tags to Shared

**Problem**: `PROFILE_TAGS` only exists on client, server can't validate.

**Move from:**
- [client/src/constants/profileTags.ts](client/src/constants/profileTags.ts)

**To:**
- `shared/constants/profileTags.ts`

---

## Phase 3: Frontend Component Consolidation

### 3.1 Extract Duplicated UI Components

**Create reusable components:**

| New Component | Replaces Duplicates In |
|--------------|------------------------|
| `SocialMediaInput` | Profile.tsx (404-454), SocialLinksSection.tsx (107-156), ApplicationForm.tsx (290-354) |
| `EditActionButtons` | Profile.tsx (339-357, 456-475), AboutSection.tsx (56-73), SocialLinksSection.tsx (159-177) |
| `ExecutionStatusDisplay` | PulseCard.tsx (90-115), pulse-dashboard.tsx (1020-1049) |
| `LoadingSpinner` | Profile.tsx (248-259), member-details.tsx (78-91), pulse-detail.tsx (107-118) |
| `EditableCardHeader` | Profile.tsx (315-327, 371-384), AboutSection.tsx (32-44) |

**Create in `client/src/components/ui/`**

### 3.2 Consolidate Timing Utilities

**Problem**: `formatTimeDifference` defined in 3 places.

**Duplicates:**
- [client/src/pages/pulse-dashboard.tsx](client/src/pages/pulse-dashboard.tsx) lines 16-32
- [client/src/hooks/usePulseTimings.ts](client/src/hooks/usePulseTimings.ts) lines 82-98
- [client/src/lib/dateUtils.ts](client/src/lib/dateUtils.ts) lines 158-174

**Solution**: Delete duplicates, import from `dateUtils.ts`

### 3.3 Create Custom Hooks

**Extract repeated patterns:**

```typescript
// client/src/hooks/useEditableSection.ts
// Replaces scattered edit state in Profile.tsx (lines 101-110)
function useEditableSection<T>(initialValue: T)

// client/src/hooks/useMutationForm.ts
// Standardizes form submission patterns
function useMutationForm<T>(mutationFn, options)
```

---

## Phase 4: Remove Dead Code & Debug Logging

### 4.1 Remove Debug Console Logs

**Problem**: 197+ console.log statements in production code.

**Priority files:**
- [server/routes.ts](server/routes.ts) - 15+ debug logs with "===" markers
- [client/src/pages/member-details.tsx](client/src/pages/member-details.tsx) lines 46-68
- [client/src/pages/pulse-dashboard.tsx](client/src/pages/pulse-dashboard.tsx) lines 727-783

**Solution**: Replace with `logger.debug()` wrapped in development check, or remove entirely.

### 4.2 Remove Deprecated/Unused Code

| Item | Location | Action |
|------|----------|--------|
| `calculatePulseStreak()` | storage.ts:327 | Remove (marked DEPRECATED) |
| `maxLengths` object | validation.ts:277-285 | Use or remove |
| `requestLimits` object | validation.ts:268-271 | Use or remove |
| Unused validation schemas | validation.ts:231-263 | Remove duplicates |
| Legacy neynar proxy | neynarClient.ts:56-61 | Remove |

### 4.3 Remove Unused Imports

Scan all files for unused imports (use TypeScript compiler or ESLint).

---

## Phase 5: Storage Layer Cleanup

### 5.1 Consolidate Duplicate Query Methods

**Problem**: 6 status update methods with identical patterns.

**In [server/storage.ts](server/storage.ts):**
- `submitApplicationByMemberId()` (358-369)
- `approveApplication()` (387-398)
- `approveMember()` (401-411)
- `acceptSubdomain()` (414-432)
- `denyApplication()` (435-445)
- `denyMember()` (448-458)

**Replace with:**
```typescript
async updateMemberStatus(memberId: number, updates: Partial<Member>): Promise<Member>
```

### 5.2 Consolidate Member Lookup Methods

**Similar pattern for:**
- `getMember()`
- `getMemberByEmail()`
- `getMemberByIpePassport()`
- `getMemberByFarcasterFid()`

**Replace with generic:**
```typescript
async findMemberBy<K extends keyof Member>(field: K, value: Member[K]): Promise<Member | undefined>
```

---

## Implementation Order

1. **Phase 2.2** - Create shared constants (enables other changes)
2. **Phase 2.1** - Consolidate validation schemas
3. **Phase 4** - Remove dead code & debug logs (quick wins)
4. **Phase 3.2** - Consolidate timing utilities
5. **Phase 5** - Storage layer cleanup
6. **Phase 1.3** - Create route helpers
7. **Phase 1.2** - Create service layer
8. **Phase 1.1** - Split routes.ts
9. **Phase 3.1** - Extract UI components
10. **Phase 3.3** - Create custom hooks

---

## Verification

After each phase:
1. Run `npm run check` - TypeScript compilation
2. Run `npm run dev` - Verify app loads
3. Test affected features manually:
   - Member registration flow
   - Pulse creation/execution
   - Profile editing
   - Community page

---

## Files Summary

**High Priority (modify first):**
- `server/routes.ts` (2,850 lines → split)
- `server/storage.ts` (consolidate methods)
- `shared/schema.ts` (extract validation)
- `server/middleware/validation.ts` (remove duplicates)

**Medium Priority:**
- `client/src/pages/pulse-dashboard.tsx` (extract utilities, remove logs)
- `client/src/pages/profile.tsx` (extract components)
- `client/src/lib/dateUtils.ts` (single source for timing)

**New Files to Create:**
- `shared/constants.ts`
- `shared/validation/schemas.ts`
- `shared/validation/constants.ts`
- `server/lib/routeHelpers.ts`
- `server/services/MemberService.ts`
- `server/routes/*.routes.ts` (6 files)
- `client/src/components/ui/SocialMediaInput.tsx`
- `client/src/components/ui/EditActionButtons.tsx`
- `client/src/components/ui/ExecutionStatusDisplay.tsx`
