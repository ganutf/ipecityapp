# Farcaster Post Embed Tool

## Overview

Ipê City Pulse is a community engagement tracking platform that manages daily Farcaster post interactions for approved community members. Admins create "pulses" (engagement tasks) with specific dates and descriptions, while members authenticate via Farcaster to view and complete current tasks. The system tracks like/recast completion status and provides historical views of community participation. Built as a modern full-stack web application with React frontend, Express backend, and PostgreSQL database.

## System Architecture

The application follows a monorepo structure with clear separation between client, server, and shared components:

- **Frontend**: React with TypeScript, built with Vite
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Farcaster Auth Kit integration
- **API Integration**: Neynar React SDK for Farcaster interactions

## Key Components

### Frontend Architecture
- **React SPA**: Single-page application using Wouter for routing
- **Component Library**: shadcn/ui components for consistent UI design
- **State Management**: TanStack Query for server state management
- **Authentication**: Farcaster Auth Kit for wallet-based authentication
- **Styling**: Tailwind CSS with custom Farcaster purple theme variables

### Backend Architecture
- **Express Server**: RESTful API server with middleware for logging and error handling
- **Storage Layer**: Abstracted storage interface with in-memory implementation (ready for database integration)
- **Session Management**: PostgreSQL session store (connect-pg-simple)
- **Development**: Hot reload with Vite integration in development mode

### Database Schema
- **Users Table**: Basic user management with username and password fields
- **Migration Support**: Drizzle migrations for schema versioning
- **Type Safety**: Full TypeScript integration with database types

## Data Flow

1. **Authentication Flow**: Users authenticate via Farcaster Auth Kit, creating a session
2. **Post Embedding**: Users input Farcaster post URLs which are validated and embedded
3. **API Interactions**: Frontend communicates with Neynar API for post data and interactions
4. **State Management**: TanStack Query manages API responses and caching
5. **User Actions**: Like, recast, and comment actions are handled through Neynar SDK

## External Dependencies

### Core Dependencies
- **@farcaster/auth-kit**: Farcaster authentication and wallet integration
- **@neynar/react**: Neynar SDK for Farcaster API interactions
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management

### UI Dependencies
- **@radix-ui/***: Headless UI primitives for accessible components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

## Deployment Strategy

### Replit Configuration
- **Runtime**: Node.js 20 with PostgreSQL 16 module
- **Build Process**: Vite builds frontend, esbuild bundles backend
- **Port Configuration**: Serves on port 5000, external port 80
- **Auto-scaling**: Configured for Replit's autoscale deployment

### Environment Variables
- **VITE_NEYNAR_CLIENT_ID**: Frontend Neynar client configuration
- **DATABASE_URL**: PostgreSQL connection string for production
- **Development**: Uses in-memory storage for rapid development

### Production Setup
1. Frontend built to `dist/public` directory
2. Backend bundled to `dist/index.js`
3. Static assets served by Express in production
4. Database migrations applied via `npm run db:push`

## Changelog

- June 20, 2025. Initial setup
- June 20, 2025. Implemented full Farcaster post embedding functionality:
  - Farcaster authentication via Auth Kit
  - Direct Neynar API integration for cast fetching
  - Like and recast functionality with real-time updates
  - Post preview with author info, content, and engagement stats
  - Loading states and error handling for all interactions
- June 20, 2025. Refactored to use official NeynarAPIClient SDK v2:
  - Proper SDK instantiation with Configuration object
  - Updated to use v2 API methods (publishReactionToCast, publishCast, etc.)
  - Enhanced error handling with proper status codes
  - Better code maintainability and type safety
  - Following official Neynar v1 to v2 migration guide
- June 20, 2025. **STABLE VERSION** - Fixed quote recast detection:
  - Corrected API limit from 150 to 100 (Neynar maximum)
  - Verified quote recast functionality working properly
  - All features tested and confirmed working with paid Neynar plan
  - Cast fetching, like/recast interactions, and quote detection operational
- June 20, 2025. SIWN Migration (Multiple Attempts):
  - Applied troubleshooting suggestions including package verification, cache clearing, and render props
  - Persistent React rendering errors with @neynar/react v1.2.4 package
  - "Objects are not valid as a React child" errors in NeynarAuthButton component despite following guide
  - Issue appears to be compatibility problem with current @neynar/react package and React 18
  - Reverted to stable Auth Kit implementation for reliability
  - SIWN architecture benefits documented for future implementation when package is stable:
    * Per-user signer_uuid delivery instead of global env var
    * Auto-registered & gas-sponsored signers  
    * Better UX with simplified authentication flow
- June 21, 2025. Bug Fixes and TypeScript Resolution:
  - Fixed like functionality by correcting reaction API target field format
  - Resolved TypeScript error by removing non-existent PostCastReqBodyEmbeds import
  - All core features verified working: authentication, cast fetching, interactions, quote detection
- June 21, 2025. Community Engagement System Implementation:
  - Expanded app into full community pulse tracking platform
  - Added PostgreSQL database with members, pulses, and pulse_executions tables
  - Implemented admin dashboard for pulse creation and member management
  - Added member access control and CSV import functionality
  - Created pulse history page showing user completion status
  - Auto-loading current pulse based on date with engagement tracking
  - Navigation between main app, admin panel, and pulse history
- June 21, 2025. Session State & Navigation Improvements:
  - Fixed user session persistence across all pages
  - Moved AuthKitProvider to App.tsx for global state management
  - Created unified Layout component with consistent navigation menu
  - Improved navigation with active state indicators and better UX
  - Fixed nested anchor tag HTML validation warnings
- June 21, 2025. Unified Home and History Pages:
  - Combined main page and history into single comprehensive pulse view
  - Active pulse highlighted at top with full embedded post functionality
  - All pulses displayed chronologically with completion status tracking
  - Improved date comparison logic for accurate active pulse detection
  - Removed separate history page in favor of unified experience
- June 21, 2025. Interface Cleanup:
  - Removed status indicators below refresh button for cleaner interface
  - Enhanced pulse list status indicators with visual checkmarks
  - Removed unnecessary refresh button since posts auto-load
  - Streamlined user interaction flow
- June 21, 2025. Date Logic Fixes:
  - Fixed date comparison logic to properly identify active pulses using ISO date strings
  - Corrected date display formatting to show accurate dates from database
  - Fixed timezone issues causing date display to be off by one day
  - App now correctly shows no active pulse when none exists for current date
- June 22, 2025. Admin Pulse Editing Implementation:
  - Added edit functionality for future pulses in admin dashboard
  - Only future pulses can be edited (past/current pulses are protected)
  - Editable fields: date, description, and Farcaster URL
  - In-place editing with save/cancel functionality
  - Real-time database updates with proper validation
- June 22, 2025. Production Deployment Fixes:
  - Added comprehensive environment variables validation
  - Implemented health check endpoint at /health for deployment monitoring
  - Enhanced error handling and logging with proper stack traces
  - Added graceful shutdown handling for production stability
  - Fixed CSV import validation to prevent server crashes
  - Added database connection testing on startup
  - Implemented process signal handlers for clean shutdown
- June 22, 2025. Admin Authentication Update:
  - Changed admin check from username to FID-based authentication
  - Admin access now verified by FID 2790 instead of username comparison
  - More reliable authentication that doesn't depend on username changes
- June 22, 2025. Complete Session Persistence Implementation:
  - Successfully implemented robust localStorage-based authentication persistence
  - Fixed AuthKit profile assignment logic where empty kitProfile was overriding restored data
  - Sessions now fully persist across page refreshes with correct user information display
  - Authentication state, user data (FID, username, displayName), and navigation all maintained
  - Clean logout functionality and 7-day session expiry implemented
  - All member verification, API calls, and post interactions work seamlessly after refresh
  - Production-ready session management system completed
- June 22, 2025. Admin Page React Hooks Fix:
  - Fixed React hooks error by restructuring admin component to call all hooks at top level
  - Completely rebuilt corrupted admin.tsx file with proper hook ordering
  - All useState, useQuery, and useMutation calls now placed before conditional returns
  - Admin dashboard functional with pulse management and member import capabilities
- June 22, 2025. Post Loading and UI Cleanup:
  - Fixed Farcaster post content loading in active pulse section
  - Removed conflicting useProfile import and fixed useEffect dependencies
  - Added loading indicator during post fetch operations
  - Removed FID display from navigation menu for cleaner user interface
  - All post interactions (like, recast, quote detection) working properly
  - Changed pulse ordering to chronological (ascending by date) instead of newest first
- June 22, 2025. Interface Improvements:
  - Removed today's active pulse from the pulse history list (only shows in top section)
  - Enhanced date highlighting in pulse list with color coding
  - Removed "Editable" labels from admin page and implemented color-coded status system
  - Applied consistent color scheme: green for today, blue for future, gray for past pulses
  - Changed pulse ordering back to newest first (descending by date) for better user experience
  - Unified active pulse interface into single green frame combining header and post content
  - Separated pulse list into "Upcoming" and "Previous" sections with optimized ordering:
    * Upcoming: ordered by date ascending (next pulse first)
    * Previous: ordered by date descending (most recent completed pulse first)
  - Improved spacing and centered active pulse section for better visual hierarchy
- June 22, 2025. Admin Panel Layout Enhancement:
  - Changed admin forms to vertical stacked layout as requested
  - "Create New Pulse" section appears first, followed by "Import Members" section
- June 24, 2025. Sponsored Signer Implementation:
  - Migrated from shared admin signer to individual Neynar Sponsored Signers per user
  - Each user now gets their own signer automatically created when they first access the app
  - Added signer approval flow with dedicated UI screen for pending approvals
  - Updated database schema to track individual signer status and approval URLs
  - Improved user experience with clear approval instructions and refresh functionality
  - Enhanced error handling and logging for signer management operations
  - **COMPLETED**: Individual signer system with QR code approval
  - Each user gets their own signer (no shared admin signer)
  - Users approve via QR code and pay their own warps (1 warp typically)
  - Added comprehensive approval UI with QR code and direct link options
  - Status checking functionality to verify approval completion
  - System updated to work with new Farcaster developer mnemonic
- June 26, 2025. **MAJOR UPDATE**: Complete Registration & Approval System Implementation:
  - **Database Schema Extension**: Added comprehensive member fields including email, social links, bio, profile tags, Ipê passport, and registration status
  - **Email Verification System**: Integrated SendGrid for email verification with 6-digit codes and 10-minute expiry
  - **Ipê Passport Integration**: Users can claim unique <user-id>.ipecity.eth subdomains with real-time availability checking
  - **Registration Flow**: New multi-step registration page with email verification, passport selection, and profile completion
  - **Admin Approval System**: Replaced CSV import with pending member approval interface showing full registration details
  - **Access Control**: Implemented route guards with automatic redirection based on registration status (pending/approved/denied)
  - **Email Notifications**: Automated approval/denial emails with passport confirmation
  - **Profile Management**: Complete profile system with editable fields and status tracking
  - **Status Pages**: Dedicated pending approval page with real-time status checking
  - **Authentication Flow**: Enhanced auth flow that checks member status and redirects appropriately
  - **Removed CSV Import**: Streamlined admin workflow focusing on individual registration approval
  - **Enhanced Member Management**: Admin dashboard shows registration status, timestamps, and member details
  - **Production Ready**: All features tested with comprehensive error handling and user feedback
- June 27, 2025. Email Verification System Fixes:
  - **Database Constraint Fix**: Removed foreign key constraint from email verifications to allow verification for unregistered users
  - **Registration UX Enhancement**: Auto-filled FID field and made Ipê passport optional in registration form
  - **Profile Menu Implementation**: Added profile picture dropdown with logout functionality
  - **Email API Routes**: Added missing email verification endpoints (/api/auth/verify-email, /api/auth/confirm-email)
  - **Development Mode Support**: Email system works in development with fallback handling for invalid SendGrid keys
  - **Complete Verification Flow**: End-to-end email verification tested and confirmed working (send code → verify code → mark verified)
- June 27, 2025. **MAJOR EMAIL UPGRADE**: Complete Migration to Resend API:
  - **Migrated from SendGrid to Resend**: More reliable email delivery with better free tier and developer experience
  - **Production Email Delivery**: Successfully configured Resend API with real email delivery confirmed (ID: 93a0e9e9-b19b-4025-ad18-dfda5ddbb697)
  - **Domain Configuration**: System supports both verified domains and Resend's sandbox domain for testing
  - **Enhanced Reliability**: Improved error handling and graceful fallback for development environments
  - **Complete Email System**: All email functions (verification, approval, denial) working with Resend infrastructure
  - **Testing Limitations**: Resend testing accounts can only send to verified email addresses until domain verification is complete
- June 27, 2025. **MAJOR UX IMPROVEMENT**: Inline Approval System Implementation:
  - **Eliminated Separate Pending Page**: Removed /pending route for streamlined user experience
  - **Inline Status Tracking**: All approval states now handled within registration page with real-time updates
  - **Auto-Status Polling**: System automatically checks approval status every 10 seconds when pending
  - **Dynamic State Management**: Registration page handles all states: email verification → registration → pending → approved/denied
  - **Enhanced Visual Feedback**: Color-coded status indicators with animated loading states and clear messaging
  - **Admin Button Integration**: Added functional approve/deny buttons in admin dashboard with real-time member list updates
  - **Seamless Flow**: Users stay on single page throughout entire registration and approval process
  - **Improved AuthGuard**: Updated routing logic to redirect pending/denied users to registration page for inline status
- June 27, 2025. **AUTHENTICATION FLOW RESTRUCTURE**: Signer Approval Before Registration:
  - **Restructured Authentication Flow**: Signer approval now happens immediately after Farcaster login, before registration
  - **New Signer Approval Page**: Created dedicated /signer-approval page with QR code and approval link
  - **Updated AuthGuard Logic**: Enhanced routing to check signer status first, then registration status
  - **Improved User Experience**: Technical signer approval handled upfront, then seamless registration process
  - **Dual-Environment Email System**: Development emails route to delivered@resend.dev, production uses updates.ipe.city
  - **Enhanced Testing**: Verification codes displayed prominently in console for easy copying during development
  - **Complete Flow**: Login → Signer Approval → Registration → Admin Approval with inline status tracking
- June 27, 2025. **EMAIL QUOTA OPTIMIZATION**: Development Mode Email Logging:
  - **Zero Quota Usage in Development**: Development mode now only logs emails without sending them
  - **Quota Conservation**: Prevents accidental API quota consumption during testing and development
  - **Clear Console Logging**: Detailed email content logged with clear formatting for verification
  - **Production Safety**: Production mode unchanged, still sends real emails to actual recipients
  - **Testing Efficiency**: Verification codes and email content visible in console without API costs
- June 27, 2025. **AUTOMATIC SIGNER APPROVAL DETECTION**: Real-time Status Monitoring:
  - **Fixed Manual Approval Detection**: Signer approval page now automatically detects when users approve on mobile
  - **Real-time Neynar API Integration**: Server checks live signer status instead of cached database values
  - **Automatic Redirect**: Users are instantly redirected to registration after mobile approval
  - **Cache Prevention**: Added no-cache headers to prevent stale status responses
  - **Clean UX**: Removed manual status check buttons for seamless automatic flow
  - **Production Ready**: Complete authentication flow from login → signer approval → registration → admin approval
- June 27, 2025. **CSV IMPORT REMOVAL**: Streamlined Admin Interface:
  - **Removed CSV Import Functionality**: Eliminated CSV member import feature from admin dashboard
  - **Simplified Admin Interface**: Admin page now focuses on pulse management and member approval list
  - **Cleaner UI**: Removed import forms and related mutation handlers for improved usability
  - **Updated Documentation**: Removed CSV import references from README and API documentation
  - **Registration-First Approach**: System now relies entirely on individual user registration and approval workflow
- June 27, 2025. **PASSPORT VERIFICATION SYSTEM COMPLETED**: Automatic ENS Detection with Streamlined Verification:
  - **Renamed Register to Profile Page**: Changed /register route to /profile with updated navigation and AuthGuard redirects
  - **Profile Menu Integration**: Added profile link to user dropdown menu in navigation header
  - **Automatic ENS Detection**: System automatically detects Ipê City domains (ipecity.eth and *.ipecity.eth) from connected wallets
  - **Simplified Interface**: Removed manual subdomain input field - app shows "Ipê Passport Verification" title with clear status
  - **Smart Status Display**: Shows "Not verified" or "✓ Verified" status with connected wallet and ENS domain information
  - **Intelligent Button Logic**: Button text changes based on wallet state and ENS ownership detection
  - **Auto-Fill Form Fields**: Passport field automatically populated from detected ENS domain
  - **RainbowKit Integration**: Implemented ConnectButton.Custom for reliable wallet connection with proper error handling
  - **Production Security**: Mandatory cryptographic signature verification for ENS domain ownership proof
  - **Reset Functionality**: Users can reset verification status to try with different wallets
  - **Enhanced UX**: Clear feedback when wallet doesn't own Ipê City domain with option to connect different wallet
  - **Local Storage Integration**: Verification status persists across sessions for seamless user experience
- June 27, 2025. **JUSTANAME API INTEGRATION**: Generic ENS Lookup System with Off-chain Subdomain Support:
  - **Generic ENS API**: Created `/api/ens/lookup/{address}` endpoint supporting multiple ENS resolution methods
  - **JustAName Integration**: Implemented off-chain subdomain lookup via JustAName API for Ipê City domains
  - **Custom Hook**: Created `useEnsLookup` hook replacing wagmi's `useEnsName` with standardized interface
  - **Loading States**: Added proper loading indicators and error handling for ENS domain resolution
  - **Future-Ready Architecture**: Generic endpoint design allows easy addition of on-chain ENS fallback
  - **Enhanced UX**: Real-time ENS domain detection with "Looking up ENS domain..." feedback
  - **Production Ready**: Complete integration tested with actual JustAName API responses
- June 28, 2025. **MAJOR REGISTRATION FLOW OVERHAUL**: New Status-Based Registration with Passport Claiming:
  - **Database Schema Expansion**: Added status tracking, passport claiming fields, and profile completion flags
  - **New Registration States**: pending_signer → signer_approved → email_verified → pending_claim → member
  - **Email Verification First**: Mandatory email verification after signer approval with 6-digit codes
  - **Dual Passport Flow**: Users can verify existing domains or claim new subdomains
  - **Admin Claim Management**: Admins approve/deny passport claims with automatic subdomain creation
  - **Enhanced Admin Dashboard**: Status column, claim tracking, and streamlined member management
  - **Automatic Membership**: Passport verification grants immediate member status
  - **Profile Completion**: Optional post-membership profile filling with completion tracking
  - **Status-Based Routing**: AuthGuard redirects users based on registration progress
  - **Email Notifications**: Automated emails for claim approvals/denials and verification codes
  - **Complete API Integration**: New endpoints for claims, status updates, and email verification
- June 29, 2025. **UNIFIED ID VERIFICATION SYSTEM**: Combined Email and Passport Verification Interface:
  - **Single-Page Experience**: Created unified ID verification page combining email and passport verification sections
  - **Fixed Root Domain Support**: Updated passport verification to accept both ipecity.eth and *.ipecity.eth domains
  - **API Response Handling**: Fixed email verification mutations to work with apiRequest function (removed duplicate .json() calls)
  - **Streamlined Navigation**: Users complete both verifications on one page with "Done - Go to Home" completion button
  - **Proper Status Flow**: Member record created during email verification, enabling subsequent passport verification
  - **Enhanced UX**: Clear section headers, status indicators, and completion messaging throughout process
  - **Updated Routing**: AuthGuard redirects non-members to unified /id-verification page instead of separate endpoints
  - **Code Cleanup**: Removed redundant registration files (email-verification.tsx, passport-validation.tsx)
  - **Simplified Profile Page**: Converted complex registration logic to clean profile editing for verified members
  - **State Management**: Fixed verification state persistence and proper UI updates after completion
  - **Production Ready**: Complete end-to-end registration flow with no duplicate logic or conflicting routes
- June 29, 2025. **REUSABLE VERIFICATION COMPONENTS**: Eliminated Code Duplication with Shared UI Components:
  - **EmailVerificationSection Component**: Created reusable email verification component with send code, verify code, and change email functionality
  - **PassportVerificationSection Component**: Created reusable passport verification component with wallet connection, ENS lookup, and ownership verification
  - **Unified Interface**: Both ID verification page and Profile page now use identical verification sections without code duplication
  - **Enhanced Profile Page**: Added verification sections to Profile page with ability to disconnect wallet and change email addresses
  - **TypeScript Integration**: Added proper type interfaces for member data to eliminate type errors
  - **Consistent UX**: Same verification flow and UI components appear in both registration and profile editing contexts
  - **Change Capabilities**: Users can disconnect wallets, connect different wallets, change email addresses, and re-verify from Profile page
  - **Component Reusability**: Verification logic centralized in reusable components with configurable props for different contexts
  - **API Fixes**: Corrected email verification endpoint mismatches and fixed SIWE nonce generation for passport verification
  - **Endpoint Corrections**: Fixed passport verification to use correct `/api/passport/verify` endpoint instead of non-existent `/api/auth/verify-passport`
  - **Loading State Fixes**: Eliminated red icon glitch by fixing race condition between signer and member status API calls in AuthGuard
  - **Enhanced Error Handling**: Added proper loading states and prevented error state flashes during component initialization
  - **Production Ready**: Complete unified verification system working across registration and profile editing flows with smooth loading transitions

## User Preferences

Preferred communication style: Simple, everyday language.