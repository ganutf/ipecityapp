# Ipê City Pulse

A community engagement tracking platform that manages daily Farcaster post interactions for approved community members.

## Overview

Ipê City Pulse allows admins to create "pulses" (engagement tasks) with specific dates and descriptions, while members authenticate via Farcaster to view and complete current tasks. The system tracks like/recast completion status and provides historical views of community participation.

## Features

- **Admin Dashboard**: Create and manage daily pulses with Farcaster post URLs
- **Member Management**: CSV import functionality for approved community members
- **Farcaster Integration**: Authenticate via Farcaster Auth Kit
- **Real-time Tracking**: Monitor like/recast completion status
- **Historical View**: Complete pulse history with engagement analytics
- **Edit Functionality**: Modify future pulse details (date, description, URL)

## Tech Stack

- **Frontend**: React with TypeScript, Vite
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Farcaster Auth Kit
- **API Integration**: Neynar SDK for Farcaster interactions

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Neynar API account with paid plan
- Farcaster Auth Kit credentials

## Environment Variables

Create a `.env` file with the following variables:

```env
DATABASE_URL=your_postgresql_connection_string
NEYNAR_API_KEY=your_neynar_api_key
VITE_NEYNAR_CLIENT_ID=your_neynar_client_id
VITE_NEYNAR_SIGNER_UUID=your_neynar_signer_uuid
SESSION_SECRET=your_session_secret
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ipe-city-pulse.git
cd ipe-city-pulse
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:push
```

4. Start the development server:
```bash
npm run dev
```

## Usage

### Admin Access
- Admin privileges are determined by `memberType = 'admin'` in the database
- Multiple admins can be created using the `server/scripts/create-admin.ts` script
- Access admin dashboard to create pulses and manage member approvals
- Edit future pulses (past/current pulses are protected)

### Member Access
- Members authenticate via Farcaster with signer approval
- Complete registration with email verification
- View current active pulse with embedded post
- Complete like/recast actions tracked automatically
- View historical pulse completion status

## API Endpoints

- `GET /api/pulses` - Get all pulses
- `POST /api/pulses` - Create new pulse (admin)
- `PUT /api/pulses/:id` - Update pulse (admin, future only)
- `GET /api/members` - Get all members

- `GET /api/executions/:fid` - Get user's pulse executions

## Database Schema

- **users**: User authentication data
- **members**: Community member profiles with Farcaster info
- **pulses**: Daily engagement tasks with dates and URLs
- **pulse_executions**: Tracking like/recast completion status

## Deployment

The project is configured for Replit deployment with automatic scaling and PostgreSQL integration.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details