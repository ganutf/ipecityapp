# IpêCity Platform

A community engagement platform for IpêCity members. Admins create daily "pulses" — engagement tasks linked to Farcaster posts — and members complete like/recast actions tracked on-chain via EAS attestations on Base L2.

## Features

- **Privy Authentication** — Email, passkey, and wallet-based login with automatic member creation
- **Member Onboarding** — Multi-step verification: email, wallet connection, ENS passport (ipecity.eth subdomain)
- **Pulse System** — Daily engagement tasks with Farcaster post interactions and real-time status tracking
- **Admin Dashboard** — Pulse creation/editing, member application review, approval workflow
- **ENS Integration** — Automated subdomain reservation and acceptance via JustaName SDK
- **EAS Attestations** — On-chain rewards on Base L2 for pulse completion using a dedicated wallet
- **Community Directory** — Member profiles with engagement stats, search, and filtering
- **Farcaster Integration** — Sponsored signers for transaction-less cast interactions via Neynar SDK

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite                         |
| Backend    | Express.js, TypeScript                             |
| Database   | PostgreSQL, Drizzle ORM                            |
| Styling    | Tailwind CSS, shadcn/ui                            |
| Auth       | Privy (email + passkey + wallet)                   |
| Blockchain | Ethereum mainnet (ENS), Base L2 (EAS attestations) |
| Farcaster  | Neynar SDK (casts, sponsored signers)              |
| ENS        | JustaName SDK (subdomain management)               |
| Routing    | Wouter (lightweight client-side routing)           |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

```bash
git clone https://github.com/ganutf/ipecityapp.git
cd ipecityapp
npm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable                                       | Description                               |
| ---------------------------------------------- | ----------------------------------------- |
| `DATABASE_URL`                                 | PostgreSQL connection string              |
| `PRIVY_APP_ID` / `VITE_PRIVY_APP_ID`           | Privy application ID                      |
| `PRIVY_APP_SECRET`                             | Privy app secret (server only)            |
| `NEYNAR_API_KEY`                               | Neynar API key for Farcaster              |
| `JUSTANAME_API_KEY` / `VITE_JUSTANAME_API_KEY` | JustaName API key for ENS subdomains      |
| `FARCASTER_DEVELOPER_MNEMONIC`                 | Mnemonic for sponsoring Farcaster signers |
| `EAS_ATTESTATION_MNEMONIC`                     | Separate mnemonic for EAS attestations    |
| `SESSION_SECRET`                               | Session encryption secret                 |
| `VITE_WALLETCONNECT_PROJECT_ID`                | WalletConnect project ID                  |
| `RESEND_API_KEY`                               | Email service (Resend)                    |
| `EMAIL_TEST_MODE`                              | Set `true` for development (logs emails)  |

See [.env.example](.env.example) for the full list including EAS chain config and RPC URLs.

### Database Setup

```bash
npm run db:push    # Push schema to database (interactive)
```

### Development

```bash
npm run dev        # Start dev server (client + server on port 5000)
```

### Production

```bash
npm run build      # Build production bundles
npm run start      # Start production server
```

### Coolify Deployment (Simplest Path)

For Coolify, this app works best as a **single Nixpacks service**:

- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run start`
- **Port:** `5000`

Notes:
- The app serves API + frontend from one process on port `5000`.
- Configure all secrets as Coolify environment variables (recommended).
- You can use `nixpacks.toml` defaults, but prefer `npm ci` for reproducible builds.

### Hosting Platform Note

If Coolify feels heavy operationally, prefer a **Node-friendly PaaS** (Railway/Render/Fly.io) before considering a Vercel migration. This codebase currently runs as a long-lived Express process with in-process background jobs, which is usually a better fit for always-on services than serverless-first platforms.

## Commands

### Core

| Command             | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start development server         |
| `npm run build`     | Build production bundle          |
| `npm run start`     | Start production server          |
| `npm run check`     | TypeScript type checking         |
| `npm run db:push`   | Push schema changes to database  |
| `npm run db:studio` | Open Drizzle Studio database GUI |

### Admin & Utilities

| Command                        | Description                                    |
| ------------------------------ | ---------------------------------------------- |
| `npm run admin:create`         | Create an admin user                           |
| `npm run admin:list`           | List all admins                                |
| `npm run member:delete`        | Delete a member                                |
| `npm run wallet:attestation`   | Get EAS attestation wallet address for funding |
| `npm run attestations:create`  | Batch create attestations                      |
| `npm run populate:pulse-types` | Seed pulse type definitions                    |

## Architecture

```
client/src/               # React frontend
├── components/           # UI components (pulse/, profile/, ui/)
├── pages/                # Route pages
├── hooks/                # Custom React hooks
├── contexts/             # Auth & timezone contexts
└── lib/                  # API helpers, query keys, utilities

server/                   # Express backend
├── routes/               # V2 API route modules (8 files)
├── services/             # Business logic services (7 services)
├── middleware/            # Auth (Privy), validation (Zod)
├── lib/                  # Error classes, route helpers, utilities
├── jobs/                 # Background jobs (balance updater)
└── scripts/              # Admin & migration scripts

shared/
├── schema.ts             # Database schema & validation (Drizzle + Zod)
├── constants.ts          # Member types, statuses, limits, blockchain config
└── types.ts              # Shared TypeScript interfaces
```

### API Routes

All API endpoints are under `/api/v2/`:

| Module      | Prefix         | Description                       |
| ----------- | -------------- | --------------------------------- |
| Auth        | `/auth`        | Login, profile, wallet linking    |
| Admin       | `/admin`       | Member approval, pulse management |
| Pulse       | `/pulse`       | Pulse CRUD operations             |
| Pulse Type  | `/pulse-type`  | Pulse type definitions            |
| Execution   | `/execution`   | Pulse execution tracking          |
| Attestation | `/attestation` | EAS on-chain attestations         |
| Farcaster   | `/farcaster`   | Cast interactions, signers        |
| Passport    | `/passport`    | ENS passport management           |

### Services

| Service                    | Responsibility                                  |
| -------------------------- | ----------------------------------------------- |
| `AttestationService`       | EAS on-chain attestation creation on Base L2    |
| `ExecutionService`         | Pulse execution (like/recast) tracking          |
| `FarcasterService`         | Cast data fetching, sponsored signer management |
| `MemberAdminService`       | Admin approval workflows, subdomain reservation |
| `PassportService`          | ENS passport verification and acceptance        |
| `ProfileEnrichmentService` | Member profile + balance data enrichment        |
| `PulseService`             | Pulse business logic and status management      |

## Member Status Flow

```
Privy Login
  │
  ▼
pending_id_verification ──→ [verify email + connect wallet]
  │
  ▼
pending_application_review ──→ [submit application or verify ENS passport]
  │
  ├──→ denied_application
  │
  ▼
approved_application ──→ [admin approves + subdomain reserved]
  │
  ▼
active_member ──→ [user accepts ENS passport]
```

Member types: `pending`, `architect`, `explorer`, `admin`, `org_team`, `core_team`

## Wallet Separation

The system uses two separate wallets for security isolation:

1. **Farcaster Developer Wallet** (`FARCASTER_DEVELOPER_MNEMONIC`) — Sponsors Farcaster signers
2. **EAS Attestation Wallet** (`EAS_ATTESTATION_MNEMONIC`) — Creates on-chain attestations on Base L2

To get the attestation wallet address for funding:

```bash
npm run wallet:attestation
```

## Database

PostgreSQL with Drizzle ORM. Key tables:

| Table              | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `members`          | Core member data (Privy ID, wallet, status, passport)         |
| `member_wallets`   | All linked wallets per member (source of truth for ownership) |
| `pulses`           | Daily engagement tasks created by admins                      |
| `pulse_types`      | Pulse category definitions                                    |
| `pulse_executions` | Like/recast completion tracking                               |
| `attestations`     | EAS attestation records                                       |
| `user_signers`     | Farcaster signer state per member                             |

Schema is defined in `shared/schema.ts` with Zod validation schemas for all inputs.

## License

MIT
