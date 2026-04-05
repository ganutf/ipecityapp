# Build & Deploy Review (Coolify)

_Date: 2026-04-05_

## Executive Summary

The current setup is **reasonable for a full-stack TypeScript app**, and now significantly simpler for Coolify after Level 1 + 2 changes:

- Build/deploy now outputs both client and server artifacts (`dist/public` + `dist/server/index.js`) and runs compiled Node in production.
- Environment requirements are broad because the app integrates Privy, Neynar, ENS (JustaName), and EAS.
- Production checks exist, but one script is tuned for legacy key files that are not required in a standard Coolify env-var workflow.

Overall: **not broken, but can be simplified materially**.

## What exists today

### Runtime model

- `npm run build` now builds client + server artifacts.
- `npm run start` now runs `node dist/server/index.js` in production (no runtime TypeScript transpilation).
- Server and API are served from the same process/port (`5000`) and static files are served by Express in production.

### Deployment plumbing

- `nixpacks.toml` maps to a simple pipeline: `npm ci` → build → start.
- `NODE_ENV=production` is embedded in the `start` script.
- Environment validation fails fast when required variables are missing.

### Observations for Coolify

1. **Good:** single service, single port, no reverse-proxy trickery inside the app.
2. **Good:** explicit env validation at startup avoids half-broken deploys.
3. **Improved:** production runtime now uses compiled server JS (`node dist/server/index.js`).
4. **Could improve:** production-check script tests for `.master-key`/`.keys` which can be irrelevant on Coolify if secrets are managed in service variables.
5. **Could improve:** docs do not clearly present a minimal “Coolify default path”.

## Is it too complex?

**Slightly, yes**—mainly operationally, not architecturally.

The app itself is feature-rich and that naturally requires many env vars. The *avoidable* complexity is in deployment ergonomics:

- duplicated/legacy deployment assumptions,
- missing CI enforcement for deploy checks,
- a few docs/scripts still mixing local and production concerns.

## Is it following best practices?

### What aligns with best practices

- Startup env validation.
- Health endpoint + single web process.
- Static asset caching in production.
- Graceful shutdown handling.
- Buildpack-friendly config (`nixpacks.toml`).

### What is not ideal

- Remaining improvement: add CI automation to enforce production checks before deploy.
- Local `docker-compose.yml` includes plaintext DB credentials (fine for local dev, but should be clearly marked as dev-only).

## Simplest target for Coolify (implemented)

### Level 1 (implemented)

1. Keep Nixpacks.
2. Keep single app service.
3. Use reproducible installs (`npm ci`) in build pipeline.
4. In Coolify service settings:
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm run start`
   - **Port:** `5000`
5. Use only Coolify-managed environment variables (no `.master-key` / `.keys` requirement).

### Level 2 (implemented)

Compile server code before runtime:

- Added `build:server` via `esbuild` to output `dist/server/index.js`.
- Kept Vite build for client output.
- Start command now uses `node dist/server/index.js`.

This improves startup predictability and removes runtime TypeScript transpilation in production.

### Level 3 (next hardening)

- Switch install step to `npm ci` everywhere in deployment.
- Add a lightweight `/healthz` route with DB-independent readiness + optional DB check endpoint.
- Convert production checks into CI (GitHub Action) so failures occur before deploy.

## Practical recommendation

If your priority is “as simple as possible on Coolify” with low risk, do this now:

1. **Document one canonical Coolify path** (done in README in this PR).
2. Keep Nixpacks + single service + one port.
3. Stop relying on legacy key-file checks for production readiness.
4. Keep a follow-up PR focused on CI hardening and deploy preflight automation.

This gives immediate simplification without destabilizing current operations.


## Should you migrate from Coolify to Vercel now?

Short answer: **probably not as your first move**.

Why:

- This app is a long-running Express server, not a static-only frontend.
- Startup launches background jobs in-process (balance updater), which does not map cleanly to typical serverless request lifecycles.
- Session + API behavior is designed around one always-on Node process serving frontend and API on one port.

Vercel can host parts of this architecture, but you would likely need non-trivial restructuring (API/function split, cron/background redesign, potentially moving session patterns).

## Better alternatives for seamless setup (before Vercel)

If your goal is simpler deploys with minimal refactor, evaluate these first:

1. **Railway** (best "it just works" replacement for Coolify)
   - Great DX for long-running Node apps.
   - Built-in Postgres and straightforward env var UX.
   - Easy single-service deployment model.

2. **Render** (good managed PaaS)
   - Stable web service model with managed Postgres.
   - Simple health checks, logs, deploy hooks.
   - Slightly slower cold starts on lower tiers, but operationally simple.

3. **Fly.io** (more infra control)
   - Excellent for long-running processes and regional placement.
   - More ops knobs than Railway/Render, so slightly steeper learning curve.

4. **Northflank** (Kubernetes-like power with PaaS UX)
   - Good if you expect to scale into multiple services/workers soon.

## Recommendation path

If you want the most seamless path right now:

1. Try **Railway** first with current architecture unchanged.
2. If you need stronger enterprise controls, compare **Render** and **Northflank**.
3. Revisit **Vercel** only if you plan to deliberately move toward a serverless/edge-first architecture.

This sequence minimizes migration risk and keeps your current app model intact.
