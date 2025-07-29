# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
```bash
npm run dev     # Start development server (client + server)
npm run build   # Build production bundle
npm run start   # Start production server
```

### Database Operations
```bash
npm run db:push  # Push schema changes to database
```

### Code Quality
```bash
npm run check    # Run TypeScript type checking
```

### Wallet Management
```bash
npm run wallet:attestation  # Get EAS attestation wallet address for funding
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui components
- **Authentication**: Farcaster Auth Kit with custom signer management
- **Blockchain**: Ethereum mainnet integration via Wagmi + RainbowKit
- **ENS**: JustaName SDK for subdomain management

### Project Structure
```
client/src/           # React frontend
├── components/       # Reusable UI components
├── pages/           # Route components
├── hooks/           # Custom React hooks
└── lib/             # Utility functions

server/              # Express.js backend
├── routes.ts        # API endpoint definitions
├── db.ts            # Database connection setup
├── storage.ts       # Database query layer
└── lib/             # Server utilities

shared/
└── schema.ts        # Shared database schema and types
```

### Key Features
- **Member Management**: Multi-stage verification process (signer → email → passport → application)
- **Pulse System**: Daily engagement tracking with Farcaster post interactions
- **ENS Integration**: Automated subdomain reservation and management via JustaName API
- **Farcaster Integration**: Sponsored signer creation, cast interactions, and user profile management

### Database Schema
The system uses a state machine approach for member progression:
- `pending_signer` → `pending_id_verification` → `email_verified` → `pending_application` → `pending_application_review` → `approved_application` → `active_member`

Key tables:
- `members`: Core member data with status tracking
- `pulses`: Daily engagement tasks created by admins
- `pulse_executions`: Tracks like/recast completion
- `user_signers`: Farcaster signer management
- `email_verifications`: Email verification tokens
- `passport_verifications`: ENS passport verification

### Authentication Flow
1. Farcaster Auth Kit authentication
2. Sponsored signer creation and approval
3. Email verification with 6-digit codes
4. ENS passport verification via wallet signature
5. Application submission with profile details
6. Admin approval with subdomain reservation

### API Architecture
- RESTful endpoints in `/api/*`
- Neynar SDK integration for Farcaster interactions
- JustaName API for ENS subdomain management
- Comprehensive error handling and logging

### Environment Variables
Required for development:
- `DATABASE_URL`: PostgreSQL connection string
- `NEYNAR_API_KEY`: Neynar API key
- `JUSTANAME_API_KEY`: JustaName API key
- `FARCASTER_DEVELOPER_MNEMONIC`: Developer mnemonic for sponsored signers
- `EAS_ATTESTATION_MNEMONIC`: Separate wallet mnemonic for EAS attestations
- `SESSION_SECRET`: Session encryption secret

### Admin System
- Admin privileges are determined by `memberType = 'admin'` in the database
- Multiple admins can be created using the `server/scripts/create-admin.ts` script
- Admin can create/edit pulses and approve member applications
- Admin approval triggers automatic subdomain reservation

### Testing and Deployment
- Configured for Replit deployment
- Health check endpoint at `/health`
- Graceful shutdown handling
- Enhanced logging for debugging

## Common Development Patterns

### Database Operations
Use the storage layer in `server/storage.ts` for all database operations. Example:
```typescript
const member = await storage.getMember(farcasterFid);
const updatedMember = await storage.updateMember(farcasterFid, updateData);
```

### API Error Handling
All API endpoints use consistent error response format:
```typescript
res.status(500).json({ 
  error: "Error message",
  status: 500,
  timestamp: new Date().toISOString()
});
```

### Farcaster Integration
Use the neynar client for Farcaster API calls:
```typescript
const userResponse = await neynar.fetchBulkUsers({ fids: [farcasterFid] });
```

### Frontend State Management
- React Query for server state management
- Custom hooks for authentication state
- Context providers for global state (auth, theming)

## Important Notes

- The system uses sponsored signers for Farcaster interactions
- EAS attestations use a separate wallet from Farcaster operations for security isolation
- ENS subdomain management is primarily client-side via JustaName SDK
- Member status progression is strictly enforced through database constraints
- All sensitive operations require proper authentication and authorization checks
- The application supports both EOA and smart contract wallets for ENS verification

## Wallet Separation

The system uses two separate wallets for different purposes:

1. **Farcaster Developer Wallet** (`FARCASTER_DEVELOPER_MNEMONIC`): Used for sponsoring Farcaster signers
2. **EAS Attestation Wallet** (`EAS_ATTESTATION_MNEMONIC`): Used exclusively for creating EAS attestations

To get the address for funding the attestation wallet:
```bash
npm run wallet:attestation
```