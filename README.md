# Ipe City Pulse

A community engagement tracking platform for Ipe City members. Admins create daily "pulses" (engagement tasks) with Farcaster posts, and members complete like/recast actions tracked on-chain via EAS attestations.

## Features

- **Privy Authentication**: Email, passkey, and wallet-based login
- **Member Onboarding**: Email verification, wallet connection, ENS passport (ipecity.eth subdomain)
- **Pulse System**: Daily engagement tasks with Farcaster post interactions
- **Admin Dashboard**: Pulse creation, member application review, approval workflow
- **ENS Integration**: Automated subdomain reservation and acceptance via JustaName SDK
- **EAS Attestations**: On-chain rewards on Base L2 for pulse completion
- **Community Page**: Member directory with profiles and engagement stats

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Privy (email + passkey + wallet)
- **Blockchain**: Ethereum mainnet (ENS), Base L2 (EAS attestations)
- **Farcaster**: Neynar SDK for post interactions and sponsored signers

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Environment Variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://...
NEYNAR_API_KEY=your_neynar_api_key
JUSTANAME_API_KEY=your_justaname_api_key
FARCASTER_DEVELOPER_MNEMONIC=your_mnemonic
EAS_ATTESTATION_MNEMONIC=your_eas_mnemonic
SESSION_SECRET=your_session_secret
VITE_PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
EMAIL_TEST_MODE=true  # Set false for production
```

### Installation

```bash
npm install
npm run db:push    # Push schema to database
npm run dev        # Start development server
```

### Commands

```bash
npm run dev              # Start dev server (client + server)
npm run build            # Build production bundle
npm run start            # Start production server
npm run check            # TypeScript type checking
npm run db:push          # Push schema changes to database
npm run wallet:attestation  # Get EAS attestation wallet address
```

## Architecture

```
client/src/           # React frontend
├── components/       # UI components
├── pages/            # Route pages
├── hooks/            # Custom React hooks
├── contexts/         # Auth context
└── lib/              # Utilities

server/               # Express backend
├── routes/           # API route modules
├── middleware/        # Auth, validation middleware
├── services/         # Business logic services
├── lib/              # Server utilities
└── scripts/          # Admin scripts

shared/
├── schema.ts         # Database schema (Drizzle)
└── constants.ts      # Shared constants
```

## Member Status Flow

```
Login (Privy) → pending_id_verification → [verify email + connect wallet]
  → Submit application → pending_application_review
  → Admin approves → approved_application (subdomain reserved)
  → Accept passport → active_member
```

## License

MIT
