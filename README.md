# Ipê Platform

Ipê Platform is where the Ipê City community manages their passports, events, tokens, reputation, opportunities, and collaborations.

## What you can do

- **Passport** — Claim and manage your `*.ipecity.eth` subdomain as your on-chain community ID.
- **Events** — Discover and RSVP to community gatherings.
- **Tokens** — Track your $IPE balance and participate in token-gated experiences.
- **Reputation** — Build on-chain reputation through verified contributions and engagement.
- **Opportunities** — Find bounties, roles, and ways to contribute.
- **Collaborations** — Connect with other members on projects and initiatives.

## Platform features

- **Authentication (Privy)** — Email, passkey, and wallet-based login with automatic member creation.
- **Member onboarding** — Email verification, wallet connection, and passport activation.
- **Passport issuance** — Admin-approved `*.ipecity.eth` subdomains minted on-chain via the ENS NameWrapper (IpêCity pays gas; member signs nothing).
- **Community directory** — Member profiles with reputation stats, search, and filtering.
- **Engagement tracking (Pulses)** — Daily engagement tasks with Farcaster post interactions.
- **On-chain rewards (EAS)** — Attestations on Base L2 for verified contributions.
- **Admin dashboard** — Application review, approval workflow, passport revocation.

## Tech Stack

| Layer      | Technology                                         |
| ---------- | -------------------------------------------------- |
| Frontend   | React 18, TypeScript, Vite                         |
| Backend    | Express.js, TypeScript                             |
| Database   | PostgreSQL, Drizzle ORM                            |
| Styling    | Tailwind CSS, shadcn/ui                            |
| Auth       | Privy (email + passkey + wallet)                   |
| Blockchain | Ethereum mainnet (ENS NameWrapper), Base L2 (EAS)  |
| Farcaster  | Neynar SDK (casts, sponsored signers)              |
| ENS Index  | TheGraph ENS subgraph                              |
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

| Variable                             | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `DATABASE_URL`                       | PostgreSQL connection string               |
| `PRIVY_APP_ID` / `VITE_PRIVY_APP_ID` | Privy application ID                       |
| `PRIVY_APP_SECRET`                   | Privy app secret (server only)             |
| `NEYNAR_API_KEY`                     | Neynar API key for Farcaster               |
| `FARCASTER_DEVELOPER_MNEMONIC`       | Mnemonic for sponsoring Farcaster signers  |
| `EAS_ATTESTATION_MNEMONIC`           | Separate mnemonic for EAS attestations     |
| `ENS_ADMIN_MNEMONIC`                 | Wallet approved to manage `ipecity.eth`    |
| `SESSION_SECRET`                     | Session encryption secret                  |
| `VITE_WALLETCONNECT_PROJECT_ID`      | WalletConnect project ID                   |
| `RESEND_API_KEY`                     | Email service (Resend)                     |
| `THEGRAPH_API_KEY`                   | TheGraph API key for ENS subgraph lookups  |
| `FRONTEND_URL`                       | Public URL (e.g. `https://app.ipe.city`)   |
| `EMAIL_TEST_MODE`                    | Set `true` for dev (logs emails, no send)  |

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

## Architecture

```
client/src/               # React frontend
├── components/           # UI components (pulse/, profile/, ui/)
├── pages/                # Route pages
├── hooks/                # Custom React hooks
├── contexts/             # Auth & timezone contexts
└── lib/                  # API helpers, query keys, utilities

server/                   # Express backend
├── routes/               # V2 API route modules
├── services/             # Business logic
├── middleware/           # Auth (Privy), validation (Zod)
├── lib/                  # Errors, RPC, ENS lookup, email
├── jobs/                 # Background jobs (balance updater, passport expiry)
└── scripts/              # Admin & maintenance scripts

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
| `ExecutionService`         | Engagement execution (like/recast) tracking    |
| `FarcasterService`         | Cast data fetching, sponsored signer management |
| `MemberAdminService`       | Admin approval + on-chain passport issuance     |
| `PassportService`          | ENS passport verification and lookup            |
| `ProfileEnrichmentService` | Member profile + balance data enrichment        |
| `PulseService`             | Pulse business logic and status management      |

## Wallet Separation

The system uses separate wallets for security isolation:

1. **ENS Admin Wallet** (`ENS_ADMIN_MNEMONIC`) — Approved operator for `ipecity.eth`; issues/revokes subdomains.
2. **Farcaster Developer Wallet** (`FARCASTER_DEVELOPER_MNEMONIC`) — Sponsors Farcaster signers.
3. **EAS Attestation Wallet** (`EAS_ATTESTATION_MNEMONIC`) — Creates on-chain attestations on Base L2.

```bash
npm run wallet:attestation   # Get EAS attestation wallet address
```

## Database

PostgreSQL with Drizzle ORM. Key tables:

| Table              | Purpose                                                       |
| ------------------ | ------------------------------------------------------------- |
| `members`          | Core member data (Privy ID, wallet, status, passport)         |
| `member_wallets`   | All linked wallets per member (source of truth for ownership) |
| `pulses`           | Engagement tasks created by admins                            |
| `pulse_types`      | Engagement category definitions                               |
| `pulse_executions` | Engagement completion tracking                                |
| `attestations`     | EAS attestation records                                       |
| `user_signers`     | Farcaster signer state per member                             |

Schema is defined in `shared/schema.ts` with Zod validation schemas for all inputs.

## License

MIT
