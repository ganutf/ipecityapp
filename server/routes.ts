import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getCurrentUTC } from "@shared/pulseUtils";
import QRCode from "qrcode";
import {
  sanitizeRequestBody,
  securityHeaders,
} from "./middleware/validation";
import { UrlSanitizer } from "./lib/sanitizer";
import logger from "./logger";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import pulseRoutes from "./routes/pulse.routes";
import pulseTypeRoutes from "./routes/pulseType.routes";
import executionRoutes from "./routes/execution.routes";
import attestationRoutes from "./routes/attestation.routes";
import farcasterRoutes from "./routes/farcaster.routes";
import passportRoutes from "./routes/passport.routes";
import projectRoutes from "./routes/project.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security headers to all routes
  app.use(securityHeaders);

  // Apply request sanitization to all routes
  app.use(sanitizeRequestBody);

  // Register V2 routes (Privy-based authentication)
  app.use('/api/v2', authRoutes);
  app.use('/api/v2/admin', adminRoutes);
  app.use('/api/v2/pulses', pulseRoutes);
  app.use('/api/v2/pulse-types', pulseTypeRoutes);
  app.use('/api/v2/executions', executionRoutes);
  app.use('/api/v2/attestations', attestationRoutes);
  app.use('/api/v2/farcaster', farcasterRoutes);
  app.use('/api/v2/passport', passportRoutes);
  app.use('/api/v2/projects', projectRoutes);

  /* ────────────────────────────────  HEALTH CHECK  ──────────────────────────────── */
  app.get("/health", async (_req, res) => {
    try {
      await storage.getAllMembers();
      res.status(200).json({
        status: "healthy",
        timestamp: getCurrentUTC().toISOString(),
        database: "connected",
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error)?.message || 'Unknown error' });
      res.status(503).json({
        status: "unhealthy",
        timestamp: getCurrentUTC().toISOString(),
        database: "disconnected",
        error: (error as Error)?.message || 'Unknown error',
      });
    }
  });

  /* ────────────────────────────────  QR CODE GENERATION  ──────────────────────────────── */
  app.post("/api/qrcode", async (req: Request, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      if (url.length > 2048) {
        return res.status(400).json({ error: "URL too long" });
      }

      const sanitizedUrl = UrlSanitizer.sanitizeUrl(url);
      if (!sanitizedUrl) {
        return res.status(400).json({ error: "Invalid URL provided" });
      }

      const qrCodeDataUrl = await QRCode.toDataURL(sanitizedUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.set("Content-Type", "text/plain");
      res.send(qrCodeDataUrl);
    } catch (error) {
      logger.error("QR code generation error:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  return createServer(app);
}
