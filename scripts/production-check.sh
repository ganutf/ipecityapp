#!/bin/bash

# IPE City Pulse - Production Readiness Check Script
# This script performs various checks to ensure the application is ready for production deployment

set -e

echo "🚀 IPE City Pulse - Production Readiness Check"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
}

check_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    exit 1
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

check_info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

echo ""
echo "🔍 Checking Environment Configuration..."

# Check NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
    check_pass "NODE_ENV is set to production"
else
    check_warn "NODE_ENV is not set to production (current: ${NODE_ENV:-not set})"
fi

# Check for .env file
if [ -f ".env" ]; then
    check_pass ".env file exists"
    
    # Check for sensitive data in .env
    if grep -q "your_" .env; then
        check_fail "Placeholder values found in .env file - replace with actual values"
    else
        check_pass "No placeholder values in .env file"
    fi
else
    check_fail ".env file not found"
fi

# Check for secure key management
if [ -f ".master-key" ]; then
    check_pass "Master key file exists"
    
    # Check master key length
    MASTER_KEY_LENGTH=$(wc -c < .master-key)
    if [ $MASTER_KEY_LENGTH -ge 32 ]; then
        check_pass "Master key is sufficiently long"
    else
        check_fail "Master key is too short (minimum 32 characters)"
    fi
else
    check_warn "Master key file not found - secure key management not configured"
fi

# Check for .keys directory
if [ -d ".keys" ]; then
    check_pass "Secure keys directory exists"
else
    check_warn "Secure keys directory not found - run 'npm run keys:migrate'"
fi

echo ""
echo "📦 Checking Dependencies..."

# Check if node_modules exists
if [ -d "node_modules" ]; then
    check_pass "Dependencies are installed"
else
    check_fail "Dependencies not installed - run 'npm install'"
fi

# Run security audit
echo ""
echo "🔒 Running Security Audit..."
if npm audit --audit-level high > /dev/null 2>&1; then
    check_pass "No high-severity vulnerabilities found"
else
    check_warn "High-severity vulnerabilities detected - run 'npm audit' for details"
fi

echo ""
echo "🏗️  Checking Build Process..."

# Check TypeScript compilation
echo "Checking TypeScript compilation..."
if npm run check > /dev/null 2>&1; then
    check_pass "TypeScript compilation successful"
else
    check_fail "TypeScript compilation failed - run 'npm run check' for details"
fi

# Test build process
echo "Testing build process..."
if npm run build > /dev/null 2>&1; then
    check_pass "Build process successful"
    
    # Check if dist directory was created
    if [ -d "dist" ]; then
        check_pass "Build output directory created"
    else
        check_fail "Build output directory not found"
    fi
else
    check_fail "Build process failed - run 'npm run build' for details"
fi

echo ""
echo "🔐 Checking Security Configuration..."

# Check for hardcoded secrets (basic patterns)
echo "Scanning for potential hardcoded secrets..."
HARDCODED_PATTERNS=("password.*=.*['\"][a-zA-Z0-9]" "secret.*=.*['\"][a-zA-Z0-9]" "key.*=.*['\"][a-zA-Z0-9]")

SECRET_FOUND=false
for pattern in "${HARDCODED_PATTERNS[@]}"; do
    if grep -r -i "$pattern" --include="*.ts" --include="*.js" server/ client/ 2>/dev/null | grep -v "\.example" | grep -v "placeholder"; then
        SECRET_FOUND=true
    fi
done

if [ "$SECRET_FOUND" = false ]; then
    check_pass "No obvious hardcoded secrets found"
else
    check_warn "Potential hardcoded secrets detected - please review"
fi

# Check for console.log statements in production code
echo "Checking for console.log statements..."
CONSOLE_COUNT=$(grep -r "console\." --include="*.ts" --include="*.js" server/ client/ 2>/dev/null | wc -l)
if [ $CONSOLE_COUNT -eq 0 ]; then
    check_pass "No console.log statements found"
elif [ $CONSOLE_COUNT -lt 10 ]; then
    check_warn "$CONSOLE_COUNT console.log statements found - consider replacing with proper logging"
else
    check_warn "$CONSOLE_COUNT console.log statements found - should be replaced with proper logging"
fi

echo ""
echo "🌐 Checking Server Configuration..."

# Check for production-specific files
if [ -f "DEPLOYMENT_SAFETY.md" ]; then
    check_pass "Deployment safety documentation exists"
else
    check_warn "Deployment safety documentation not found"
fi

# Check logs directory
if [ -d "logs" ]; then
    check_pass "Logs directory exists"
else
    check_info "Logs directory will be created automatically in production"
fi

echo ""
echo "📊 Summary"
echo "=========="
echo ""

# Final recommendations
echo -e "${BLUE}📋 Pre-Deployment Checklist:${NC}"
echo "  1. Review and update all API keys for production"
echo "  2. Ensure HTTPS is properly configured"
echo "  3. Configure domain-specific CORS settings"
echo "  4. Set up monitoring and alerting"
echo "  5. Prepare backup and recovery procedures"
echo "  6. Test all functionality in staging environment"

echo ""
echo -e "${BLUE}🚀 Ready for Deployment Commands:${NC}"
echo "  npm run build"
echo "  NODE_ENV=production npm start"

echo ""
echo -e "${GREEN}✨ Production readiness check completed!${NC}"
echo ""

echo "For detailed security information, see DEPLOYMENT_SAFETY.md"