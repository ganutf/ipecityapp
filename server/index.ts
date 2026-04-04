import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { initializeDatabase, db } from "./db";
import { mkdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { resolve } from "path";
import logger from "./logger";
import { validateEnvironment } from "./lib/validateEnv";
import { AppError, getErrorStatus, getErrorMessage } from "./lib/errors";

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

// Validate required environment variables
validateEnvironment();


// Test database connection
async function testDatabaseConnection() {
  try {
    await db.execute('SELECT 1 as test');
    logger.info('Database connection successful');
  } catch (error) {
    logger.error(`Database connection failed: ${(error as Error)?.message || 'Unknown error'}`);
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
    if (!origin) {
      if (isProduction) {
        logger.warn('CORS blocked request with no origin');
        return callback(new Error('Origin header required'));
      }
      return callback(null, true);
    }

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

// Note: Security headers including CSP are set in server/middleware/validation.ts
// via the securityHeaders() middleware function

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

    // Initialize database connection with secure configuration
    await initializeDatabase();
    logger.info(`Database initialization completed in ${Date.now() - startTime}ms`);

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
    app.use((err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
      const status = getErrorStatus(err);
      const message = getErrorMessage(err);

      // Log error details for debugging
      logger.error(`Error ${status}: ${message} on ${req.method} ${req.path}`);
      if (status >= 500) {
        logger.error(`Stack trace: ${err.stack}`);
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
    const appEnv = app.get("env");
    logger.info('Checking environment for Vite setup', {
      appEnv,
      processEnv: process.env.NODE_ENV,
      willSetupVite: appEnv === "development"
    });

    if (appEnv === "development") {
      logger.info('Setting up Vite in development mode');
      await setupVite(app, server);
      logger.info('Vite setup completed');
    } else {
      logger.info('Serving static assets (production mode)');
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
    }, async () => {
      const totalStartupTime = Date.now() - startTime;
      logger.info(`Server successfully started on port ${port}`, {
        startupTime: `${totalStartupTime}ms`,
        environment: process.env.NODE_ENV
      });
      logger.info(`Health check available at http://0.0.0.0:${port}/health`);

      // Start balance updater background job
      try {
        const { startBalanceUpdater } = await import('./jobs/balanceUpdater');
        await startBalanceUpdater();
        logger.info('Balance updater background job started successfully');
      } catch (error) {
        logger.error('Failed to start balance updater:', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);

      // Stop background jobs
      try {
        const { stopBalanceUpdater } = await import('./jobs/balanceUpdater');
        stopBalanceUpdater();
        logger.info('Background jobs stopped');
      } catch (error) {
        logger.error(`Error stopping background jobs: ${error}`);
      }

      serverInstance.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught Exception: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
      process.exit(1);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${(error as Error)?.message || 'Unknown error'}`);
    process.exit(1);
  }
})();
