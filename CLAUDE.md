# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

**Ipê Platform** — where the Ipê City community manages their passports, events, tokens, reputation, opportunities, and collaborations. The platform issues on-chain `*.ipecity.eth` passports and provides engagement tracking, on-chain rewards, and a community directory.

Legacy name: "Ipê City Pulse" (deprecated — use "Ipê Platform"). The repo directory `ipecity-pulse` and the internal logger service name `ipecity-pulse` are kept for continuity of logs/deployments and should **not** be renamed.

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
- **Authentication**: Privy (email + passkey + wallet) with Bearer token auth
- **Blockchain**: Ethereum mainnet (ENS NameWrapper) via viem + Wagmi, Base L2 for EAS attestations
- **ENS**: Direct on-chain issuance via `ipecity.eth` NameWrapper; enumeration via TheGraph ENS subgraph
- **Farcaster**: Neynar SDK for post interactions (optional integration)

### Project Structure
```
client/src/           # React frontend
├── components/       # Reusable UI components
├── pages/           # Route components
├── hooks/           # Custom React hooks
├── contexts/        # Auth context (Privy-based)
└── lib/             # Utility functions (api.ts, queryClient.ts, dateUtils.ts)

server/              # Express.js backend
├── routes/          # V2 API route modules (auth, admin, pulse, passport, etc.)
├── middleware/       # Auth middleware (privyAuth.ts), validation
├── services/        # Business logic (MemberAdminService, PassportService, PulseService, ...)
├── db.ts            # Database connection setup
├── storage.ts       # Database query layer
└── lib/             # Server utilities (ensLookup, ensSubgraph, ensSubdomainService, email, ...)

shared/
├── schema.ts        # Database schema (Drizzle ORM)
└── constants.ts     # Member statuses, types, validation limits, timing
```

### Key Features
- **Passport (core)**: On-chain `*.ipecity.eth` subdomain issued via ENS NameWrapper after admin approval. IpêCity pays gas; members sign nothing.
- **Member Management**: Multi-stage onboarding (email → wallet → passport or application) with admin review.
- **Community Directory**: Member profiles, reputation stats, search, and filtering.
- **Engagement Tracking (Pulses)**: One of many features — daily tasks tied to Farcaster post interactions.
- **EAS Attestations**: On-chain rewards on Base L2 for verified contributions.
- **Farcaster Integration**: Sponsored signers and cast interactions (optional).

### Database Schema
The system uses a state machine approach for member progression:
- `pending_id_verification` → `pending_application_review` → `approved_application` → `active_member`
- (or `denied_application` if rejected)

Key tables:
- `members`: Core member data with status, privyId, walletAddress, ipePassport
- `pulses`: Daily engagement tasks created by admins
- `pulse_executions`: Tracks like/recast completion
- `attestations`: EAS on-chain attestation records

### Authentication Flow
1. Privy authentication (email, passkey, or wallet)
2. Member auto-created with `pending_id_verification` status
3. Connect wallet (external preferred over Privy embedded)
4. Email verification (auto-verified if Privy email login)
5. ENS passport check or application submission
6. Admin approval mints the on-chain subdomain and activates the member directly → `active_member` (no separate accept step)

### Auth Architecture
- **Frontend**: `useAuth()` context calls `/api/v2/auth/me`, stores member state
- **Backend**: `privyAuthMiddleware` verifies Bearer token from Privy access token
- **API calls**: Use `authenticatedPost`/`authenticatedGet` from `client/src/lib/api.ts` (sends Bearer token)
- **Wallet preference**: Both client (`useActiveWallet` hook) and server prefer external wallets over Privy embedded

### API Architecture
- RESTful endpoints in `/api/*`
- Neynar SDK integration for Farcaster interactions
- JustaName API for ENS subdomain management
- Comprehensive error handling and logging

### Environment Variables
Required for development:
- `DATABASE_URL`: PostgreSQL connection string
- `PRIVY_APP_ID` / `VITE_PRIVY_APP_ID`: Privy application ID
- `PRIVY_APP_SECRET`: Privy app secret (server only)
- `NEYNAR_API_KEY`: Neynar API key for Farcaster
- `JUSTANAME_API_KEY`: JustaName API key for ENS subdomains
- `FARCASTER_DEVELOPER_MNEMONIC`: Developer mnemonic for sponsored signers
- `EAS_ATTESTATION_MNEMONIC`: Separate wallet mnemonic for EAS attestations
- `SESSION_SECRET`: Session encryption secret
- `VITE_WALLETCONNECT_PROJECT_ID`: WalletConnect project ID
- `EMAIL_TEST_MODE`: Set `true` for development (logs emails instead of sending)

### Admin System
- Admin privileges are determined by `memberType = 'admin'` in the database
- Multiple admins can be created using the `server/scripts/create-admin.ts` script
- Admin can create/edit pulses and approve member applications
- Admin approval mints the `*.ipecity.eth` subdomain on-chain and activates the member atomically

### Testing and Deployment
- Health check endpoint at `/health`
- Graceful shutdown handling
- Winston structured logging

## Common Development Patterns

### Database Operations
Use the storage layer in `server/storage.ts` for all database operations. Example:
```typescript
const member = await storage.getMemberByPrivyId(privyId);
const updatedMember = await storage.updateMember(memberId, updateData);
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

### Authenticated API Requests (Frontend)
Use helpers from `client/src/lib/api.ts` for V2 endpoints (Bearer token auth):
```typescript
import { authenticatedPost, authenticatedGet } from "@/lib/api";
const data = await authenticatedPost("/api/v2/auth/passport/accept", { memberId });
```

For V1 endpoints or React Query mutations, `apiRequest` from `queryClient.ts` uses cookies only (no Bearer token).

### Frontend State Management
- React Query for server state management
- `useAuth()` context for authentication state (member, login, logout, refreshMember)
- `useActiveWallet()` hook for wallet management (prefers external over embedded)

## Design System

### Design Principles
Our design system follows modern UI patterns with consistent visual hierarchy, professional styling, and intuitive user experience. All components use a cohesive design language established through the pulse interface redesign.

### Typography Scale
```typescript
// Page and Section Headers
"text-3xl font-bold text-gray-900"    // Main page titles
"text-2xl font-bold text-gray-900"    // Pulse detail headers  
"text-xl font-bold text-gray-900"     // Card titles (PULSE #X)
"text-lg font-semibold text-gray-900" // Section headers

// Body Text
"text-base text-gray-700 leading-relaxed"  // Primary descriptions
"text-sm text-gray-600 font-medium"        // Secondary information
"text-sm text-gray-600"                    // Meta information
"text-xs text-gray-500"                    // Timestamps, labels, small text

// Interactive Text
"font-semibold"  // Emphasis and important values
"font-medium"    // Moderate emphasis
```

### Color System
IpêCity Brand Colors - Minimalist Professional Palette:

```typescript
// Brand Colors (Primary)
"bg-slate-900 text-white"    // Navy #002642 - Primary dark, headers
"bg-lime-400 text-slate-900" // Green #A2D729 - Primary accent, CTAs  
"bg-sky-400 text-white"      // Sky Blue #3AA5FF - Secondary actions
"bg-amber-400 text-slate-900" // Yellow #FFB600 - Highlights (minimal use)

// Brand Accent Colors
"text-slate-900"       // Navy text for headings, primary content
"text-lime-500"        // Green accents, success states, metrics  
"text-sky-500"         // Sky blue for secondary actions, links
"text-amber-500"       // Yellow for special highlights (minimal)

// Border Accents (Status-based)
"border-l-lime-500"    // Active/success accent
"border-l-slate-700"   // Inactive/ended accent  
"border-l-sky-500"     // Scheduled/secondary accent
"border-l-amber-500"   // Warning/attention accent

// Interactive States
"focus:border-lime-500 focus:ring-lime-500"     // Green focus states
"hover:bg-lime-50"                              // Subtle green hover
"hover:bg-sky-50"                               // Subtle blue hover

// Background Colors
"bg-gradient-to-br from-slate-50 to-gray-100"  // Page backgrounds  
"bg-white"                                      // Card backgrounds
"bg-slate-50"                                   // Section dividers
"bg-lime-50"                                    // Success backgrounds
"bg-sky-50"                                     // Info backgrounds

// Neutral System Colors  
"text-gray-600"        // Body text, secondary content
"text-gray-400"        // Muted text, disabled states
"text-red-600"         // Errors, warnings, critical states
"bg-gray-100"          // Neutral backgrounds
```

**Usage Guidelines:**
- Use Navy (slate-900) for primary headers and important content
- Apply Green (lime-500) sparingly for key accents and success states  
- Use Sky Blue (sky-500) for secondary interactive elements
- Keep Yellow (amber-500) minimal - only for special highlights
- Maintain clean off-white backgrounds for professional appearance

### Card Components
Standard card pattern with status-based left border accents:
```typescript
<Card className={cn(
  "border-l-4 bg-white shadow-sm",
  getAccentColor() // border-l-orange-500, border-l-gray-400, etc.
)}>
  <CardContent className="p-6">
    {/* Content with consistent spacing */}
  </CardContent>
</Card>

// Enhanced cards with hover states
<Card className={cn(
  "border-l-4 bg-white shadow-sm hover:shadow-md transition-all duration-200",
  "cursor-pointer", // if interactive
  getAccentColor()
)}>
```

### Status Badges
Consistent badge styling across all components:
```typescript
const baseClasses = "px-3 py-1.5 text-sm font-semibold rounded-full";

// Status-based badges
<Badge className={cn(baseClasses, "bg-orange-500 text-white")}>Active</Badge>
<Badge className={cn(baseClasses, "bg-gray-500 text-white")}>Ended</Badge>
<Badge className={cn(baseClasses, "bg-blue-500 text-white")}>Scheduled</Badge>
<Badge className={cn(baseClasses, "bg-green-500 text-white")}>Completed</Badge>
```

### Icon System
```typescript
// Icon Sizes
"h-3 w-3"  // Small icons in buttons, badges
"h-4 w-4"  // Standard inline icons
"h-5 w-5"  // Prominent icons, headers
"h-6 w-6"  // Large icons, empty states

// Icon Colors and Spacing
"text-gray-400 mr-3"     // Secondary icons with spacing
"text-purple-600 mr-2"   // Primary action icons
"h-4 w-4 mr-2"          // Standard icon-text combo

// Common Icon Patterns
<Calendar className="h-4 w-4 mr-3 text-gray-400" />
<Target className="h-4 w-4 mr-2 text-purple-600" />
<Clock className="h-4 w-4 mr-3 text-gray-400" />
```

### Layout Patterns
```typescript
// Page Containers
"min-h-screen bg-gradient-to-br from-gray-50 to-gray-100"
"container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8"
"container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8" // Community page

// Spacing System (8px grid)
"space-y-8"   // Major sections
"space-y-6"   // Within cards, subsections  
"space-y-4"   // Related items
"space-y-3"   // Tight groupings
"mb-4", "mb-6" // Individual margins

// Flexbox Patterns
"flex items-center justify-between"  // Header layouts
"flex items-center space-x-3"       // Icon-text combinations
"flex flex-col sm:flex-row gap-4"    // Responsive layouts
```

### Interactive Elements
```typescript
// Button Sizing
"h-8 w-8 p-0"     // Icon buttons
"h-9 px-4"        // Standard buttons
"h-11"            // Input fields

// Hover and Transition States
"hover:shadow-md transition-all duration-200"        // Cards
"hover:shadow-lg"                                    // Interactive cards
"hover:bg-red-50 hover:text-red-600"               // Destructive actions
"cursor-pointer"                                     // Clickable elements

// Focus States
"focus:border-purple-500 focus:ring-purple-500"     // Form inputs
"focus:outline-none focus:ring-2 focus:ring-purple-500" // Custom elements
```

### Responsive Design
```typescript
// Breakpoint Usage
"grid-cols-1 md:grid-cols-2 xl:grid-cols-3"     // Card grids
"flex-col sm:flex-row"                           // Layout stacking
"hidden sm:flex"                                 // Conditional visibility
"px-4 sm:px-6 lg:px-8"                          // Responsive spacing

// Grid Patterns
"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" // Community members
"grid grid-cols-1 md:grid-cols-3 gap-6"                // Info sections
```

### Component-Specific Patterns
```typescript
// Execution Status Display
"flex items-center justify-center py-2 px-4 bg-green-50 border border-green-200 rounded-lg"

// Information Rows
"flex items-center text-sm text-gray-600"
"flex items-center justify-between text-sm"

// Profile/Author Info
"flex items-center space-x-3"  // Avatar + info layout
"w-12 h-12 rounded-full"       // Standard avatar size
```

### Usage Guidelines
- **Always use the 8px spacing grid** (`space-y-4`, `space-y-6`, `space-y-8`)
- **Apply status colors consistently** across badges, borders, and accents  
- **Use left border accents** on cards to indicate status or importance
- **Maintain typography hierarchy** with established font sizes and weights
- **Include hover states** on interactive elements for better UX
- **Follow responsive patterns** for mobile-first design approach

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