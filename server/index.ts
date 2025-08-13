import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { initializeDatabase, db } from "./db";
import { initializeKeyManager } from "./lib/keyManagement";
import { readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { resolve } from "path";
import logger from "./logger";

// Load environment variables from .env file
const envPath = resolve(process.cwd(), '.env');
logger.info('Loading environment variables', { envPath });
config({ path: envPath });

// Ensure logs directory exists in production
if (process.env.NODE_ENV === 'production') {
  try {
    mkdirSync('logs', { recursive: true });
  } catch (error) {
    // Directory already exists or other error
  }
}

// Log environment status (without sensitive values)
logger.info('Environment check', {
  EMAIL_TEST_MODE: process.env.EMAIL_TEST_MODE,
  RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Set' : 'Not set',
  NODE_ENV: process.env.NODE_ENV
});


// Legacy logging function - replaced with proper logger
function enhancedLog(message: string, level: 'info' | 'error' = 'info') {
  if (level === 'error') {
    logger.error(message);
  } else {
    logger.info(message);
  }
}

// Validate required environment variables
function validateEnvironment() {
  // Note: DATABASE_URL is now handled by secure key management
  // Other critical environment variables can be added here if needed
  const required: string[] = [];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    enhancedLog(`Missing required environment variables: ${missing.join(', ')}`, 'error');
    process.exit(1);
  }

  enhancedLog('Environment validation passed');
}

// Check if running in a production-like environment that should use direct environment variables
function shouldUseDirectEnvironmentVariables(): boolean {
  return !!(
    // Replit environment
    process.env.REPL_ID ||
    process.env.REPL_SLUG ||
    process.env.REPLIT_DB_URL ||
    process.env.REPL_OWNER ||
    // Production environment
    process.env.NODE_ENV === 'production' ||
    // Common production platforms
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.AZURE_FUNCTIONS_ENVIRONMENT ||
    // Manual override for any platform
    process.env.USE_DIRECT_ENV_VARS === 'true'
  );
}

// Initialize secure key management
async function initializeSecureKeys() {
  try {
    const useDirectEnvVars = shouldUseDirectEnvironmentVariables();
    const isProduction = process.env.NODE_ENV === 'production';

    // Skip secure key management in production-like environments - use standard environment variables
    if (useDirectEnvVars) {
      logger.info('Detected production-like environment, using standard environment variables');
      logger.info('Secure key management skipped - using direct environment variable access');
      return; // Skip key manager initialization in production-like environments
    }

    // Try to load master password from file for non-Replit environments
    const masterKeyPath = join(process.cwd(), '.master-key');
    let masterPassword: string;

    try {
      masterPassword = readFileSync(masterKeyPath, 'utf8').trim();
      logger.info('Master password loaded from file');
    } catch (error) {
      logger.warn('Master password file not found, using fallback');

      // Check for environment variable fallback
      if (process.env.MASTER_PASSWORD) {
        masterPassword = process.env.MASTER_PASSWORD;
        logger.info('Master password loaded from environment variable');
      } else if (isProduction) {
        logger.error('Production environment requires secure master password');
        logger.error('Either create .master-key file or set MASTER_PASSWORD environment variable');
        process.exit(1);
      } else {
        // For development, generate a temporary password
        masterPassword = 'development-master-password-not-secure-for-production-use';
        logger.info('Using temporary development master password');
      }
    }

    initializeKeyManager(masterPassword);
    logger.info('Secure key management initialized');
  } catch (error) {
    logger.error('Key management initialization failed', { error: (error as Error)?.message || 'Unknown error' });
    process.exit(1);
  }
}

// Test database connection
async function testDatabaseConnection() {
  try {
    await db.execute('SELECT 1 as test');
    enhancedLog('Database connection successful');
  } catch (error) {
    enhancedLog(`Database connection failed: ${(error as Error)?.message || 'Unknown error'}`, 'error');
    process.exit(1);
  }
}

const app = express();

// In production, serve static assets FIRST before any middleware
// This prevents static assets from being processed by heavy middleware
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const distPath = resolve(process.cwd(), 'dist', 'public');

  // Serve static assets with optimized headers
  app.use('/assets', express.static(join(distPath, 'assets'), {
    maxAge: '1y', // Cache assets for 1 year
    etag: false,
    lastModified: false
  }));

  logger.info('Static assets serving configured for production', { distPath });
}

// Security headers and CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'https://pulse.ipecity.org';

const allowedOrigins = isProduction
  ? [
    frontendUrl,
    'https://ipecity.replit.app' // Add Replit domain
  ]
  : ['http://localhost:5000', 'http://127.0.0.1:5000']; // Development domains

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logger.warn('CORS blocked origin', { origin, allowedOrigins });
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Security headers (simplified - no need for asset exclusions since assets are served first)
app.use((req, res, next) => {
  // HSTS - Force HTTPS in production
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent XSS attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP - Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.neynar.com https://*.farcaster.xyz https://*.justaname.id",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.neynar.com https://*.farcaster.xyz https://*.justaname.id https://*.ethereum.org wss:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
});

app.use(express.json({ limit: '10mb' })); // Limit request size
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Request logging middleware (simplified - static assets served first)
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info('API Request', {
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }
  });

  next();
});

(async () => {
  try {
    const startTime = Date.now();
    logger.info('Server startup initiated');

    // Initialize secure keys first (skip in Replit)
    await initializeSecureKeys();
    logger.info(`Secure key initialization completed in ${Date.now() - startTime}ms`);

    // Initialize database connection with secure configuration
    await initializeDatabase();
    logger.info(`Database initialization completed in ${Date.now() - startTime}ms`);

    // Validate environment (lightweight check)
    validateEnvironment();

    // Register routes
    const server = await registerRoutes(app);
    logger.info(`Route registration completed in ${Date.now() - startTime}ms`);

    // Test database connection after server is running (non-blocking for port opening)
    setImmediate(async () => {
      try {
        await testDatabaseConnection();
        logger.info(`Database connection test completed in ${Date.now() - startTime}ms`);
      } catch (error) {
        logger.error('Database connection test failed', { error: (error as Error)?.message || 'Unknown error' });
      }
    });

    // Enhanced error handling middleware
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log error details for debugging
      enhancedLog(`Error ${status}: ${message} on ${req.method} ${req.path}`, 'error');
      if (status >= 500) {
        enhancedLog(`Stack trace: ${err.stack}`, 'error');
      }

      res.status(status).json({
        error: message,
        status,
        timestamp: new Date().toISOString()
      });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;

    const serverInstance = server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      const totalStartupTime = Date.now() - startTime;
      logger.info(`Server successfully started on port ${port}`, {
        startupTime: `${totalStartupTime}ms`,
        environment: process.env.NODE_ENV,
        useDirectEnvVars: shouldUseDirectEnvironmentVariables()
      });
      logger.info(`Health check available at http://0.0.0.0:${port}/health`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal: string) => {
      enhancedLog(`Received ${signal}, initiating graceful shutdown...`);

      serverInstance.close(() => {
        enhancedLog('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        enhancedLog('Forcing shutdown after timeout', 'error');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      enhancedLog(`Uncaught Exception: ${error.message}`, 'error');
      enhancedLog(`Stack: ${error.stack}`, 'error');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      enhancedLog(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
      process.exit(1);
    });

  } catch (error) {
    enhancedLog(`Failed to start server: ${(error as Error)?.message || 'Unknown error'}`, 'error');
    process.exit(1);
  }
})();
