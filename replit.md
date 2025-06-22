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
- June 22, 2025. Session Persistence Fix:
  - Fixed duplicate AuthKitProvider configuration causing logout on refresh
  - Consolidated auth configuration to single provider in App.tsx
  - Updated domain and siweUri to use dynamic window.location values
  - Sessions now persist properly across page refreshes
- June 22, 2025. Signer Management Implementation:
  - Added per-user signer check to prevent shared signer issues
  - Currently only admin (FID 2790) can perform like/recast actions
  - Other users get clear error message about signer setup needed
  - Foundation laid for individual signer implementation
  - Fixed authentication session persistence with localStorage storage
- June 22, 2025. Automatic Signer Generation:
  - Added user_signers table to store individual Farcaster signers
  - Implemented automatic signer creation for new users via Neynar API
  - Users can now like and recast posts after initial signer setup
  - Signer generation happens automatically on first sign-in (improved UX)
  - Individual signers stored and reused for subsequent actions
  - Proactive signer setup prevents delays during post interactions
- June 22, 2025. Session Persistence Implementation:
  - Implemented proper session persistence using SIWF message + signature caching
  - Added session restoration with signature verification on app load
  - Sessions now properly maintain authentication state across page refreshes
  - Follows Farcaster app best practices for persistent authentication
  - Eliminated database errors caused by undefined FID values
  - Removed duplicate sign-in buttons for cleaner UI (header button only)
  - Fixed runtime error by updating PostTool component to use session persistence hook

## User Preferences

Preferred communication style: Simple, everyday language.