#!/bin/bash

# Test script to simulate Replit environment locally
echo "🧪 Testing Replit deployment mode locally"
echo "=========================================="

# Set Replit environment variables
export REPL_ID="test-repl-id"
export NODE_ENV="production"
export DATABASE_URL="postgresql://user:pass@localhost:5432/ipecity_pulse"

# Add other required environment variables
export NEYNAR_API_KEY="test-key"
export JUSTANAME_API_KEY="test-key"
export SESSION_SECRET="test-session-secret-32-characters-long"

echo "Environment variables set:"
echo "  REPL_ID: $REPL_ID"
echo "  NODE_ENV: $NODE_ENV"
echo "  DATABASE_URL: Set"

echo ""
echo "Starting server in Replit simulation mode..."

# Build and start the server
npm run build && timeout 10s npm run start

echo ""
echo "Test completed!"