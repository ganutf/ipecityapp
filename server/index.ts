import express, { type Request, Response, NextFunction } from "express";
import { registerSimplifiedRoutes } from "./simplified-routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";

// Enhanced logging function with error handling
function enhancedLog(message: string, level: 'info' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

// Validate required environment variables
function validateEnvironment() {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    enhancedLog(`Missing required environment variables: ${missing.join(', ')}`, 'error');
    process.exit(1);
  }
  
  enhancedLog('Environment validation passed');
}

// Test database connection
async function testDatabaseConnection() {
  try {
    await db.execute('SELECT 1 as test');
    enhancedLog('Database connection successful');
  } catch (error) {
    enhancedLog(`Database connection failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Validate environment and test database connection
    validateEnvironment();
    await testDatabaseConnection();

    // Register API routes
    registerSimplifiedRoutes(app);

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

    // Create HTTP server
    const { createServer } = await import("http");
    const httpServer = createServer(app);

    // Setup Vite in development or serve static files in production
    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on port 5000
    const port = 5000;
    
    const serverInstance = httpServer.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      enhancedLog(`Server successfully started on port ${port}`);
      enhancedLog(`Health check available at http://0.0.0.0:${port}/health`);
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
    enhancedLog(`Failed to start server: ${error.message}`, 'error');
    process.exit(1);
  }
})();
