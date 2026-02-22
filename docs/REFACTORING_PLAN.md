# Codebase Improvement Plan

A plan to improve code quality, modularity, and maintainability across the ipecity-pulse codebase.

**Last Updated:** 2026-02-22

---

## Progress Summary

| Category | Original Issue | Current Status |
|----------|---------------|----------------|
| Backend Architecture | 2,850-line routes.ts | Reduced to ~1,737 lines. `auth.routes.ts` extracted (966 lines). More splitting needed. |
| Shared Constants | Hardcoded values throughout | Done - `shared/constants.ts` with types, statuses, validation limits, timing, etc. |
| Duplicated Code | formatTimeDifference in 3 places | Still duplicated |
| Debug Logging | 197+ console.logs | Grew to ~388. Needs cleanup. |
| Storage Layer | 6 duplicate status methods | Generic `updateMemberStatus()` exists but old methods still present |
| Service Layer | No services | 3 services created: PulseService, balanceCache, justanamePassport |

---

## Remaining Work

### 1. Continue Route Splitting (MEDIUM priority)

`server/routes.ts` is still ~1,737 lines. Extract into:

```
server/routes/
├── index.ts           # Route registration (exists)
├── auth.routes.ts     # Authentication (exists, 966 lines)
├── members.routes.ts  # Member CRUD & profiles
├── pulses.routes.ts   # Pulse management
├── community.routes.ts # Community & stats
├── admin.routes.ts    # Admin operations
└── attestations.routes.ts # EAS attestations
```

### 2. Consolidate formatTimeDifference (LOW priority)

Still duplicated in 3 places:
- `client/src/pages/pulse-dashboard.tsx`
- `client/src/hooks/usePulseTimings.ts`
- `client/src/lib/dateUtils.ts`

Delete duplicates, import from `dateUtils.ts`.

### 3. Clean Up Console Logs (MEDIUM priority)

~388 console.log statements in server code. Replace with structured `logger` calls or remove entirely. Priority files:
- `server/routes.ts`
- `server/routes/auth.routes.ts`

### 4. Storage Layer Consolidation (LOW priority)

These methods in `server/storage.ts` have identical patterns and could use the generic `updateMemberStatus()`:
- `approveApplication()`
- `approveMember()`
- `denyApplication()`
- `denyMember()`

### 5. Service Layer Expansion (LOW priority)

Could create but not urgent:
- `MemberService.ts` - Member business logic
- `AttestationService.ts` - EAS attestation logic (related to EAS feature work)

### 6. Validation Schema Consolidation (LOW priority)

Some validation schemas still duplicated between:
- `shared/schema.ts`
- `server/middleware/validation.ts`
- `client/src/components/ApplicationForm.tsx`

`shared/constants.ts` has the validation limits, but the Zod schemas themselves are still scattered.

---

## Completed Items

- Created `shared/constants.ts` with member types, statuses, validation limits, timing, reserved usernames, profile tags
- Extracted `server/routes/auth.routes.ts` from main routes
- Created service layer directory with PulseService, balanceCache, justanamePassport
- Added generic `updateMemberStatus()` to storage
- Added `upgradeMemberToActive()` to storage
