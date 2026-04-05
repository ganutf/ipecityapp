# Codebase Review — 2026-04-05

This review focuses on risk, dead code, duplication, modularity, and alignment with world-class engineering practices.

## Scope and method

- Reviewed client, server, and shared TypeScript code.
- Ran type-check and stricter unused-symbol analysis.
- Performed targeted scans for API usage and architectural hotspots.

## Priority findings

### P0 — Build is currently failing (release blocker)

`npm run check` fails with TypeScript errors in both client and server.

Representative examples:
- `id-verification.tsx` passes a `memberId` prop to `EmailVerificationSection`, but the component props define `farcasterFid` instead.
- `profile.tsx` passes `number | undefined` where a `number` is required.
- `balanceCache.ts` has null-safety and uninitialized-variable errors (`balance` possibly null, `decimals` used before assignment).

### P1 — Significant dead code and unused symbols

Using `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` reports many unused values/imports across client and server.

Representative examples:
- `EmailVerificationSection` has an unused prop (`farcasterFid`) and unused icon imports.
- `profile.tsx`, `admin.tsx`, and multiple components/pages declare values not read.
- Several server modules and scripts also contain unused imports/types.

### P1 — Broken npm script (dead command path)

`package.json` declares:
- `rollback:pulse-structure`: `tsx server/scripts/rollback-pulse-migration.ts`

But `server/scripts/rollback-pulse-migration.ts` does not exist in the repo. This is a maintenance and operability risk.

### P1 — API client duplication and drift risk

The codebase currently has multiple overlapping HTTP layers:
- `client/src/lib/api.ts` (`authenticatedGet/Post/Patch/Put/Delete`)
- `client/src/lib/queryClient.ts` (`apiRequest`, generic query fetcher)
- direct `fetch(...)` usage in pages/components

This increases risk of inconsistent auth headers, inconsistent error handling, and difficult global changes (timeouts, retries, tracing).

### P1 — Monolithic modules limit modularity and testability

Large files indicate boundary and cohesion problems:
- `server/storage.ts` (~1266 lines)
- `server/routes/auth.routes.ts` (~1000 lines)
- `client/src/pages/profile.tsx` (~639 lines)
- `client/src/pages/community.tsx` (~601 lines)

These should be split by domain concerns and use-cases to reduce regression blast radius.

### P2 — Inconsistent type rigor in core interfaces

High-centrality modules still use broad `any`, e.g.:
- `withTransaction<T>(callback: (tx: any) => Promise<T>)`
- HTTP helper function parameters like `data: any`

This weakens TypeScript guarantees at critical integration boundaries.

### P2 — Overlap between shared and client pulse utility surfaces

`shared/pulseUtils.ts` and `client/src/lib/pulseUtils.ts` are both active and the client module re-exports shared logic while adding UI logic. The split is directionally good, but still creates discoverability and ownership ambiguity for where pulse logic should live.

## Recommended improvement roadmap

### 1) Stabilize build + CI gates (immediate)

- Fix current TypeScript errors until `npm run check` is green.
- Add CI gates for:
  - `npm run check`
  - `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
  - tests (`npm test`)

### 2) Remove dead code systematically

- Address unused symbols in batches by folder (e.g., `client/components`, `client/pages`, `server/lib`, `server/scripts`).
- Remove/repair dead npm scripts and periodically verify script targets exist.

### 3) Consolidate HTTP/API layer

- Introduce a single typed transport (request, auth, error parsing, retries, timeout, telemetry).
- Make React Query consume this layer only.
- Migrate direct `fetch(...)` calls behind a typed API client.

### 4) Refactor monolith files by bounded context

- Split `server/storage.ts` into repositories per aggregate (`members`, `pulses`, `attestations`, `auth`).
- Split `auth.routes.ts` by functional area and enforce a thin-controller pattern.
- Split large pages into container + presentational components + hooks.

### 5) Raise type strictness at boundaries

- Replace `any` in high-impact interfaces first (`tx`, API payloads, external response contracts).
- Add typed result envelopes and shared error models.

### 6) Keep shared business logic truly shared

- Define a clear rule: domain logic in `shared/`, UI mapping logic in `client/`.
- Add ownership notes in README/docs so new contributors place logic correctly.

## Success criteria

- `npm run check` passes.
- Unused-symbol pass reduced to near-zero (except intentional placeholders).
- One canonical API client path for all frontend network calls.
- Largest files reduced below agreed thresholds (e.g., <400 LOC for pages/routes, <500 LOC for repositories).
- No `any` in critical boundaries unless explicitly documented with rationale.
