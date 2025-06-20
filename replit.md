# Farcaster Post Embed Tool

## Overview

This application is a Farcaster post embedding tool that allows users to authenticate with Farcaster, input post URLs, and interact with posts (like, recast, comment) using the Neynar API. It's built as a modern full-stack web application with React frontend and Express backend, designed for deployment on Replit.

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
- June 20, 2025. SIWN Migration (Attempted):
  - Encountered React rendering errors with @neynar/react package
  - NeynarAuthButton component causing "Objects are not valid as a React child" errors
  - Reverted to stable Auth Kit implementation for reliability
  - SIWN architecture benefits noted for future implementation:
    * Per-user signer_uuid delivery instead of global env var
    * Auto-registered & gas-sponsored signers
    * Better UX with simplified authentication flow

## User Preferences

Preferred communication style: Simple, everyday language.