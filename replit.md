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
  - **COMPLETED**: Implemented sponsored signer system with QR code approval
  - Users get individual sponsored signers - app pays instead of users
  - Added comprehensive approval UI with both QR code and direct link options
  - Status checking functionality to verify approval completion
  - Proper signed key registration with developer mnemonic signatures
  - Cost-free approval process for users (app sponsors the warps)

## User Preferences

Preferred communication style: Simple, everyday language.