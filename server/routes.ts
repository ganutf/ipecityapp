import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getErrorStatus, getErrorMessage, getNeynarErrorData, isNotFoundError, isRateLimitError, getRetryAfter } from "./lib/errors";

// Import PulseService for business logic operations
import { PulseService } from "./services/PulseService";
import { getCurrentUTC, calculatePulseEndTimeUTC } from "@shared/pulseUtils";

// Create PulseService instance
const pulseService = new PulseService(storage);

import {
  insertPulseSchema,
  updatePulseSchema,
  insertPulseTypeSchema,
} from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import { getSignedKey } from "./lib/getSignedKey";
import {
  sendApprovalEmail,
  sendDenialEmail,
} from "./lib/email";
import { lookupEnsName } from "./lib/ensLookup";
import {
  authenticateUser,
  requireAdmin,
  requireOwnership,
  auditLogger,
  type AuthenticatedRequest
} from "./middleware/auth";
import { attestationRateLimit, bulkAttestationRateLimit, withTimeout } from "./lib/rateLimiter";
import {
  validateRequest,
  sanitizeRequestBody,
  securityHeaders,
} from "./middleware/validation";
import {
  HtmlSanitizer,
  IdentifierSanitizer,
  UrlSanitizer
} from "./lib/sanitizer";
import logger from "./logger";
import authRoutes from "./routes/auth.routes";

/* local unions for clarity */
type Reaction = "like" | "recast";
type CastParam = "hash" | "url";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security headers to all routes
  app.use(securityHeaders);
  
  // Apply request sanitization to all routes
  app.use(sanitizeRequestBody);

  // Register V2 routes (Privy-based authentication)
  app.use('/api/v2', authRoutes);

  /* ────────────────────────────────  HEALTH CHECK  ──────────────────────────────── */
  // Health check endpoint for deployment monitoring
  app.get("/health", async (req, res) => {
    try {
      // Test database connection
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
  // Public QR code endpoint - no authentication required for signer approval
  app.post("/api/qrcode", async (req: Request, res) => {
    try {
      logger.info('QR Code API called - no auth required');
      
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }
      
      // Basic URL validation
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      
      if (url.length > 2048) {
        return res.status(400).json({ error: "URL too long" });
      }
      
      // Sanitize URL
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

  /* ────────────────────────────────  SDK  ──────────────────────────────── */
  // Import neynar client from separate module for proper API key handling
  const { neynar } = await import("./lib/neynarClient");

  /* ──────────────────  LIKE / plain RECAST  ────────────────── */
  app.post("/api/neynar/reaction", 
    authenticateUser,
    validateRequest(z.object({
      signer_uuid: z.string().uuid("Invalid signer UUID"),
      reaction_type: z.enum(['like', 'recast'], { required_error: "Invalid reaction type" }),
      target: z.string().min(1, "Target hash required").max(100, "Target hash too long")
    })),
    async (req: AuthenticatedRequest, res) => {
      try {
        logger.debug("Processing reaction request", { 
          body: req.body, 
          user: { id: req.user?.id, fid: req.user?.fid } 
        });
        
        const { signer_uuid, reaction_type, target } = req.body;
        
        // Sanitize inputs
        const sanitizedTarget = HtmlSanitizer.sanitizeText(target, 100);
        
        const out = await neynar.publishReaction({
          signerUuid: signer_uuid,
          reactionType: reaction_type,
          target: sanitizedTarget,
        });

        res.json(out);
      } catch (e) {
        const msg = getNeynarErrorData(e) || getErrorMessage(e);
        res.status(getErrorStatus(e)).json({ error: msg });
      }
    }
  );

  /* ───────────────────  QUOTE-CAST / new cast  ─────────────────── */
  app.post("/api/neynar/cast", 
    authenticateUser,
    validateRequest(z.object({
      signer_uuid: z.string().uuid("Invalid signer UUID"),
      text: z.string().max(320, "Cast text too long").optional(),
      embeds: z.array(z.any()).max(10, "Too many embeds").optional()
    })),
    async (req: AuthenticatedRequest, res) => {
      try {
        logger.debug("Processing cast request", { 
          body: req.body, 
          user: { id: req.user?.id, fid: req.user?.fid } 
        });
        
        const {
          signer_uuid,
          text = "",
          embeds,
        } = req.body;
        
        // Sanitize text content
        const sanitizedText = text ? HtmlSanitizer.sanitizeText(text, 320) : "";

        const out = await neynar.publishCast({
          signerUuid: signer_uuid,
          text: sanitizedText,
          embeds,
        });

        res.json(out);
      } catch (e) {
        const msg = getNeynarErrorData(e) || getErrorMessage(e);
        res.status(getErrorStatus(e)).json({ error: msg });
      }
    }
  );

  /* ────────────────  USER SIGNER MANAGEMENT  ──────────────── */
  app.get("/api/neynar/signer/:fid", 
    validateRequest(z.object({
      params: z.object({
        fid: z.string().regex(/^\d+$/, "FID must be numeric").transform(Number)
      })
    })),
    async (req: Request, res: Response) => {
      // Prevent caching to ensure real-time signer status checks
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      try {
        const fid = req.params.fid as unknown as number;
        
        logger.info(`=== SIGNER LOOKUP DEBUG START ===`);
        logger.info(`Raw FID from params: ${fid}`);
        
        // Validate FID
        const sanitizedFid = IdentifierSanitizer.sanitizeFid(fid);
        if (!sanitizedFid) {
          logger.info(`FID validation failed for: ${fid}`);
          return res.status(400).json({ error: "Invalid FID" });
        }

        logger.info(`Sanitized FID: ${sanitizedFid}`);

        // Check if member exists
        const member = await storage.getMemberByFarcasterFid(sanitizedFid);
        logger.info(`Member lookup result:`, member ? {
          id: member.id,
          farcasterFid: member.farcasterFid,
          status: member.status,
          memberType: member.memberType
        } : 'NOT FOUND');

        if (!member) {
          logger.info(`No member found for FID ${sanitizedFid} - returning 404`);
          return res.status(404).json({ 
            error: "Member not found",
            message: "No member record exists for this FID. Please sign up first." 
          });
        }

        logger.info(`Looking for signer for FID: ${sanitizedFid}`);

        // Check if user already has a signer
        let userSigner;
        try {
          const member = await storage.getMemberByFarcasterFid(sanitizedFid);
          if (member) {
            userSigner = await storage.getUserSigner(member.id);
            logger.info("Existing signer lookup result:", userSigner ? {
              farcasterFid: userSigner.farcasterFid,
              signerUuid: userSigner.signerUuid,
              status: userSigner.status
            } : 'NO SIGNER FOUND');
          }
        } catch (dbError) {
          logger.error("Database error when fetching signer:", dbError);
          return res.status(500).json({ error: "Database connection error" });
        }

      if (userSigner) {
        // If signer is pending, check current status with Neynar
        if (userSigner.status === "pending_approval") {
          try {
            logger.info(
              "Checking signer status with Neynar for UUID:",
              userSigner.signerUuid,
            );
            const signerStatus = await neynar.lookupSigner({
              signerUuid: userSigner.signerUuid,
            });
            logger.info("Neynar signer status:", signerStatus);

            if (signerStatus.status === "approved") {
              // Update database with approved status - use memberId
              await storage.updateUserSignerStatus(member.id, "approved");
              logger.info("Signer approved! Updated database status.");

              // Also update member status if they're still pending_signer (legacy)
              try {
                const member = await storage.getMemberByFarcasterFid(sanitizedFid);
                if (member && (member.status === "pending_signer" || member.status === "pending_id_verification")) {
                  await storage.updateMemberStatus(member.id, "pending_id_verification");
                  logger.info("Updated member status to pending_id_verification");
                }
              } catch (memberError) {
                logger.error("Error updating member status:", memberError);
                // Don't fail the request if member update fails
              }

              res.json({
                signer_uuid: userSigner.signerUuid,
                status: "approved",
                signer_approval_url: userSigner.approvalUrl,
                message: "Signer approved successfully",
              });
              return;
            }
          } catch (statusError) {
            logger.error(
              "Error checking signer status with Neynar:",
              statusError,
            );
            
            // Handle 404 (signer not found) and 429 (rate limit) errors
            if (isNotFoundError(statusError)) {
              logger.info("Signer not found on Neynar - cleaning up stale record");

              try {
                // Delete the stale signer record
                const member = await storage.getMemberByFarcasterFid(sanitizedFid);
                if (member) {
                  await storage.deleteUserSigner(member.id);
                  logger.info("Deleted stale signer record");
                }

                // Return error asking user to try again instead of immediately creating new signer
                // This prevents rate limit issues from rapid signer creation
                return res.status(404).json({
                  error: "Stale signer found",
                  message: "Your previous signer was invalid and has been cleaned up. Please refresh the page to get a new signer.",
                  action: "refresh_required"
                });

              } catch (cleanupError) {
                logger.error("Error cleaning up stale signer:", cleanupError);
                return res.status(500).json({
                  error: "Failed to cleanup stale signer",
                  details: getErrorMessage(cleanupError),
                });
              }
            }

            // Handle rate limiting errors
            if (isRateLimitError(statusError)) {
              logger.info("Rate limit hit when checking signer status");
              const retryAfter = getRetryAfter(statusError);

              return res.status(429).json({
                error: "Rate limit exceeded",
                message: `Too many requests to Neynar API. Please wait ${retryAfter} seconds before trying again.`,
                retryAfter,
                action: "wait_and_retry"
              });
            }
            
            // Fall through to return cached status if other Neynar errors
          }
        }

        // Return existing signer (approved or pending)
        res.json({
          signer_uuid: userSigner.signerUuid,
          status: userSigner.status,
          signer_approval_url: userSigner.approvalUrl,
          message:
            userSigner.status === "approved"
              ? "Existing approved signer found"
              : "Existing signer requires approval",
        });
      } else {
        // Create new signer with proper registration and sponsorship
        logger.info("=== CREATING NEW SIGNER ===");
        logger.info("Creating new sponsored signer for FID:", sanitizedFid);
        logger.info("Member status:", member.status);
        
        try {
          const signerData = await getSignedKey(true); // sponsored = true
          logger.info("Created and registered signer:", {
            signer_uuid: signerData.signer_uuid,
            status: signerData.status,
            approval_url: signerData.deep_link_url,
            signedKey_approval_url: signerData.signedKey?.signer_approval_url
          });

          // Store the signer in database
          const newSigner = await storage.createUserSigner({
            memberId: member.id,
            farcasterFid: sanitizedFid,
            signerUuid: signerData.signer_uuid,
            publicKey: signerData.public_key || "",
            status:
              signerData.signedKey?.status ||
              signerData.status ||
              "pending_approval",
            approvalUrl:
              signerData.signedKey?.signer_approval_url ||
              signerData.deep_link_url ||
              `https://client.farcaster.xyz/deeplinks/signed-key-request?token=${signerData.public_key}`,
          });

          logger.info("Signer stored in database:", {
            id: newSigner.id,
            farcasterFid: newSigner.farcasterFid,
            signerUuid: newSigner.signerUuid,
            status: newSigner.status
          });

          res.json({
            signer_uuid: newSigner.signerUuid,
            status: newSigner.status,
            signer_approval_url: newSigner.approvalUrl,
            message:
              "Sponsored signer created and registered - approval required via QR code or mobile app",
          });
        } catch (signerError) {
          logger.error("Error creating signer:", signerError);
          
          // Handle rate limiting specifically
          if (isRateLimitError(signerError)) {
            const retryAfter = getRetryAfter(signerError);

            return res.status(429).json({
              error: "Rate limit exceeded",
              message: `Too many signer creation requests. Please wait ${retryAfter} seconds before trying again.`,
              retryAfter,
              action: "wait_and_retry"
            });
          }

          return res.status(500).json({
            error: "Failed to create signer",
            details: getErrorMessage(signerError),
            message: "Unable to create Farcaster signer. Please try again in a few minutes."
          });
        }
      }
    } catch (e) {
      logger.error("Signer endpoint error:", e);
      const msg = getNeynarErrorData(e) || getErrorMessage(e);
      res.status(getErrorStatus(e)).json({ error: msg });
    }
  });

  // Check signer status and update if approved
  app.post("/api/neynar/signer/check/:fid", 
    authenticateUser,
    validateRequest(z.object({
      params: z.object({
        fid: z.string().regex(/^\d+$/, "FID must be numeric").transform(Number)
      })
    })),
    async (req: AuthenticatedRequest, res) => {
      try {
        const fid = req.params.fid as unknown as number;
        
        // Validate FID
        const sanitizedFid = IdentifierSanitizer.sanitizeFid(fid);
        if (!sanitizedFid) {
          return res.status(400).json({ error: "Invalid FID" });
        }

        const userSigner = await storage.getUserSigner(sanitizedFid);
        if (!userSigner) {
          return res.status(404).json({ error: "Signer not found" });
        }

        // Check signer status with Neynar
        try {
          const signerInfo = await neynar.lookupSigner({
            signerUuid: userSigner.signerUuid,
          });
          logger.info("Signer info from Neynar:", signerInfo);

          // Update status if it has changed
          if (signerInfo.status !== userSigner.status) {
            // Get member for memberId
            const member = await storage.getMemberByFarcasterFid(sanitizedFid);
            if (member) {
              await storage.updateUserSignerStatus(member.id, signerInfo.status);
            }
            res.json({
              status: signerInfo.status,
              updated: true,
              signer_uuid: userSigner.signerUuid,
            });
          } else {
            res.json({
              status: userSigner.status,
              updated: false,
              signer_uuid: userSigner.signerUuid,
            });
          }
      } catch (neynarError) {
        logger.info("Neynar lookup error:", neynarError);
        // If we can't check with Neynar, return current status
        res.json({
          status: userSigner.status,
          updated: false,
          signer_uuid: userSigner.signerUuid,
          note: "Could not verify with Neynar",
        });
      }
    } catch (e) {
      const msg = getNeynarErrorData(e) || getErrorMessage(e);
      res.status(getErrorStatus(e)).json({ error: msg });
    }
  });

  /* ────────5��──────  DID viewer QUOTE-RECAST this cast?  ─────────────── */
  app.get("/api/neynar/cast/:hash/quotes/:viewerFid", async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;

      /* quotes endpoint not wrapped in SDK yet */
      const r = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/quotes` +
          `?identifier=${encodeURIComponent(hash)}&type=hash&limit=100`,
        {
          headers: {
            "x-api-key": process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS",
          },
        },
      );
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);

      const hasQuoted =
        data.casts?.some((c: any) => c.author?.fid === Number(viewerFid)) ??
        false;

      res.json({ hasQuoted });
    } catch (e) {
      res.status(500).json({ error: getErrorMessage(e) });
    }
  });

  /* ────────────────  FETCH cast + viewer context  ──────────────── */
  app.get("/api/neynar/cast/:identifier/:viewerFid", async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const type = (req.query.type as CastParam) ?? "url";

      // Add detailed logging for debugging
      logger.debug("Cast lookup request", { 
        identifier, 
        viewerFid, 
        type,
        decodedIdentifier: decodeURIComponent(identifier)
      });

      // Validate inputs
      if (!identifier || !viewerFid) {
        logger.warn("Invalid cast lookup parameters", { identifier, viewerFid });
        return res.status(400).json({ 
          error: "Missing required parameters: identifier and viewerFid" 
        });
      }

      // Validate viewerFid is numeric
      const numericViewerFid = Number(viewerFid);
      if (isNaN(numericViewerFid) || numericViewerFid <= 0) {
        logger.warn("Invalid viewerFid format", { viewerFid });
        return res.status(400).json({ 
          error: "viewerFid must be a positive number" 
        });
      }

      // Decode the identifier in case it's URL encoded
      const decodedIdentifier = decodeURIComponent(identifier);

      const out = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier: decodedIdentifier,
        type,
        viewerFid: numericViewerFid,
      });

      logger.debug("Cast lookup successful", { 
        identifier: decodedIdentifier, 
        viewerFid: numericViewerFid,
        castHash: out.cast?.hash 
      });

      res.json(out);
    } catch (e) {
      logger.error("Cast lookup error", { 
        identifier: req.params.identifier,
        viewerFid: req.params.viewerFid,
        type: req.query.type,
        error: getErrorMessage(e),
        stack: e instanceof Error ? e.stack : undefined,
        neynarError: getNeynarErrorData(e)
      });

      const msg = getNeynarErrorData(e) || getErrorMessage(e);
      res.status(getErrorStatus(e)).json({ error: msg });
    }
  });

  /* --------------------------------------------------------- */
  /* 6️⃣  PULSE MANAGEMENT                                      */
  /* --------------------------------------------------------- */

  // Get active pulses (currently running based on datetime + interval)
  app.get("/api/pulses/active", async (req, res) => {
    try {
      const pulses = await storage.getActivePulses();
      res.json({ pulses });
    } catch (err) {
      logger.error("Active pulses error:", err);
      res
        .status(500)
        .json({ error: getErrorMessage(err) || "Failed to get active pulses" });
    }
  });


  // Get all pulses
  app.get("/api/pulses", async (req, res) => {
    try {
      const pulses = await storage.getAllPulses();
      res.json({ pulses });
    } catch (err) {
      logger.error("Get pulses error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get pulses" });
    }
  });

  // Create new pulse (admin only)
  app.post("/api/pulses", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("CREATE_PULSE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const pulseData = {
        ...req.body,
        createdBy: req.user!.id, // Use member ID instead of FID
      };
      const validatedData = insertPulseSchema.parse(pulseData);
      const pulse = await storage.createPulse(validatedData);
      res.json({ success: true, pulse });
    } catch (err) {
      logger.error("Create pulse error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to create pulse" });
    }
  });

  // Update pulse (admin only)
  app.patch("/api/pulses/:id", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("UPDATE_PULSE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const pulseId = parseInt(req.params.id);
      if (isNaN(pulseId)) {
        return res.status(400).json({ error: "Invalid pulse ID" });
      }

      const validatedData = updatePulseSchema.parse(req.body);
      const pulse = await storage.updatePulse(pulseId, validatedData);
      res.json({ success: true, pulse });
    } catch (err) {
      logger.error("Update pulse error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to update pulse" });
    }
  });

  // Delete pulse (admin only)
  app.delete("/api/pulses/:id", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("DELETE_PULSE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const pulseId = parseInt(req.params.id);
      if (isNaN(pulseId)) {
        return res.status(400).json({ error: "Invalid pulse ID" });
      }

      // Check if pulse exists
      const pulse = await storage.getPulse(pulseId);
      if (!pulse) {
        return res.status(404).json({ error: "Pulse not found" });
      }

      await storage.deletePulse(pulseId);
      res.json({ success: true, message: "Pulse deleted successfully" });
    } catch (err) {
      logger.error("Delete pulse error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to delete pulse" });
    }
  });

  // Pulse Types API routes
  
  // Get all pulse types
  app.get("/api/pulse-types", async (req, res) => {
    try {
      const pulseTypes = await storage.getAllPulseTypes();
      res.json({ pulseTypes });
    } catch (err) {
      logger.error("Get pulse types error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get pulse types" });
    }
  });

  // Create new pulse type (admin only)
  app.post("/api/pulse-types", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("CREATE_PULSE_TYPE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertPulseTypeSchema.parse(req.body);
      const pulseType = await storage.createPulseType(validatedData);
      res.json({ success: true, pulseType });
    } catch (err) {
      logger.error("Create pulse type error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to create pulse type" });
    }
  });

  // Get attestation status for a pulse execution
  app.get("/api/attestations/:pulseExecutionId", 
    authenticateUser,
    async (req: AuthenticatedRequest, res) => {
    try {
      const pulseExecutionId = parseInt(req.params.pulseExecutionId);
      if (isNaN(pulseExecutionId)) {
        return res.status(400).json({ error: "Invalid pulse execution ID" });
      }

      // First, verify that the pulse execution belongs to the authenticated user
      const isOwner = await storage.verifyPulseExecutionOwnership(pulseExecutionId, req.user!.id);
      
      if (!isOwner) {
        return res.status(403).json({ 
          error: "Access denied. You can only view attestations for your own pulse executions." 
        });
      }

      const attestation = await storage.getAttestation(pulseExecutionId);
      
      if (!attestation) {
        return res.json({ 
          exists: false, 
          status: 'not_created',
          message: 'No attestation found for this pulse execution'
        });
      }

      res.json({
        exists: true,
        status: attestation.status,
        attestationUid: attestation.attestationUid,
        transactionHash: attestation.transactionHash,
        createdAt: attestation.createdAt
      });
    } catch (err) {
      logger.error("Get attestation error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get attestation status" });
    }
  });

  // Get all pending attestations (admin only)
  app.get("/api/attestations", 
    authenticateUser, 
    requireAdmin,
    async (req: AuthenticatedRequest, res) => {
    try {
      const pendingAttestations = await storage.getPendingAttestations();
      res.json({ 
        count: pendingAttestations.length,
        attestations: pendingAttestations
      });
    } catch (err) {
      logger.error("Get pending attestations error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get pending attestations" });
    }
  });

  // Get pulse executions with attestation status for a specific pulse (accessible to all authenticated users)
  app.get("/api/pulse/:pulseId/executions", 
    authenticateUser, 
    async (req: AuthenticatedRequest, res) => {
    try {
      const pulseId = parseInt(req.params.pulseId);
      
      if (isNaN(pulseId)) {
        return res.status(400).json({ error: "Invalid pulse ID" });
      }

      // Verify pulse exists
      const pulse = await storage.getPulse(pulseId);
      
      if (!pulse) {
        return res.status(404).json({ error: "Pulse not found" });
      }

      const executionsWithAttestations = await storage.getPulseExecutionsWithAttestations(pulseId);
      
      res.json({ 
        pulse,
        executions: executionsWithAttestations.map(({ execution, member, attestation }) => ({
          member: {
            id: member.id,
            farcasterFid: member.farcasterFid,
            ipePassport: member.ipePassport,
            ipeUsername: member.ipeUsername,
            memberType: member.memberType
          },
          execution: execution ? {
            id: execution.id,
            actions: execution.actions,
            executedAt: execution.executedAt,
            points: pulse.points
          } : null,
          attestation: attestation ? {
            id: attestation.id,
            status: attestation.status,
            attestationUid: attestation.attestationUid,
            transactionHash: attestation.transactionHash,
            createdAt: attestation.createdAt
          } : null
        }))
      });
    } catch (err) {
      logger.error("Get pulse executions error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get pulse executions" });
    }
  });


  // Create attestations for all pending executions in a specific pulse (admin only)
  app.post("/api/admin/pulse/:pulseId/attestations/create-all", 
    authenticateUser, 
    requireAdmin,
    bulkAttestationRateLimit.middleware(),
    auditLogger("CREATE_ALL_PULSE_ATTESTATIONS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      logger.info(`[BULK_ATTESTATION] Starting bulk attestation creation for pulse ${req.params.pulseId}`);
      
      const pulseId = parseInt(req.params.pulseId);
      if (isNaN(pulseId) || pulseId <= 0) {
        logger.info(`[BULK_ATTESTATION] Invalid pulse ID: ${req.params.pulseId}`);
        return res.status(400).json({ error: "Invalid pulse ID: must be a positive integer" });
      }

      // Verify pulse exists and is in valid state for attestations
      const pulse = await storage.getPulse(pulseId);
      if (!pulse) {
        logger.info(`[BULK_ATTESTATION] Pulse not found: ${pulseId}`);
        return res.status(404).json({ error: "Pulse not found" });
      }

      // Validate pulse state - only allow attestations for pulses that have ended (UTC timing)
      const nowUTC = getCurrentUTC();
      const pulseEndTimeUTC = calculatePulseEndTimeUTC(pulse.datetimeStart, pulse.interval);
      logger.info(`[BULK_ATTESTATION] UTC Pulse timing - Now: ${nowUTC.toISOString()}, End: ${pulseEndTimeUTC.toISOString()}, Ended: ${pulseEndTimeUTC <= nowUTC}`);
      
      if (pulseEndTimeUTC > nowUTC) {
        logger.info(`[BULK_ATTESTATION] Pulse still active, cannot create attestations`);
        return res.status(400).json({ 
          error: "Cannot create attestations for active pulse", 
          details: `Pulse ends at ${pulseEndTimeUTC.toISOString()} UTC` 
        });
      }

      // Get pending attestations for this pulse only
      logger.info(`[BULK_ATTESTATION] Getting pending attestations for pulse ${pulseId}`);
      const pendingAttestations = await storage.getPendingAttestationsByPulse(pulseId);
      logger.info(`[BULK_ATTESTATION] Found ${pendingAttestations.length} pending attestations`);
      
      if (pendingAttestations.length === 0) {
        logger.info(`[BULK_ATTESTATION] No pending attestations found, returning early`);
        return res.json({ 
          message: "No pending attestations found for this pulse",
          processed: 0,
          successful: 0,
          failed: 0
        });
      }

      // Import the EAS service
      logger.info(`[BULK_ATTESTATION] Importing EAS service`);
      const { easService } = await import('./lib/easService');
      
      // Prepare attestation data for batch processing
      const attestationDataList = [];
      
      logger.info(`[BULK_ATTESTATION] Processing ${pendingAttestations.length} pending attestations`);
      for (const { execution, member, pulse } of pendingAttestations) {
        logger.info(`[BULK_ATTESTATION] Processing execution ${execution.id} for member ${member.ipePassport}`);
        
        // Check if attestation already exists
        const existingAttestation = await storage.getAttestation(execution.id);
        if (!existingAttestation || existingAttestation.status !== 'completed') {
          attestationDataList.push({
            pulseExecutionId: execution.id,
            status: 'pending' as const,
            execution,
            member,
            pulse
          });
          logger.info(`[BULK_ATTESTATION] Added execution ${execution.id} to attestation list`);
        } else {
          logger.info(`[BULK_ATTESTATION] Skipping execution ${execution.id} - already has completed attestation`);
        }
      }
      
      logger.info(`[BULK_ATTESTATION] Prepared ${attestationDataList.length} attestations for processing`);

      // Create attestation records atomically
      logger.info(`[BULK_ATTESTATION] Creating ${attestationDataList.length} attestation records in database`);
      const attestationResults = await storage.createBulkAttestationsWithTransaction(
        attestationDataList.map(data => ({
          pulseExecutionId: data.pulseExecutionId,
          status: data.status
        }))
      );

      logger.info(`[BULK_ATTESTATION] Database results: ${attestationResults.successful.length} successful, ${attestationResults.failed.length} failed`);

      // Process EAS attestations for successfully created database records
      let successful = 0;
      let failed = attestationResults.failed.length;
      const errors: string[] = attestationResults.failed.map(f => f.error);
      
      logger.info(`[BULK_ATTESTATION] Starting EAS attestation creation for ${attestationResults.successful.length} records`);

      for (const attestation of attestationResults.successful) {
        const attestationData = attestationDataList.find(d => d.pulseExecutionId === attestation.pulseExecutionId);
        if (!attestationData) {
          logger.info(`[BULK_ATTESTATION] WARNING: Could not find attestation data for execution ${attestation.pulseExecutionId}`);
          continue;
        }

        logger.info(`[BULK_ATTESTATION] Processing EAS attestation for member ${attestationData.member.ipePassport} (execution ${attestation.pulseExecutionId})`);

        try {
          // Create the actual EAS attestation with timeout
          const attestationResult = await withTimeout(
            easService.createAttestation({
              memberOnchainID: attestationData.member.ipePassport!,
              memberWalletAddress: attestationData.member.walletAddress!,
              pulseNumber: attestationData.pulse.id,
              executedAt: attestationData.execution.executedAt ? Math.floor(new Date(attestationData.execution.executedAt).getTime() / 1000) : Math.floor(getCurrentUTC().getTime() / 1000),
              actionsExecuted: JSON.stringify(attestationData.execution.actions)
            }),
            45000, // 45 second timeout for EAS operations
            'EAS Attestation Creation'
          );

          logger.info(`[BULK_ATTESTATION] EAS attestation created: ${attestationResult.attestationUID}`);

          // Update the attestation record
          await storage.updateAttestationStatus(
            attestation.id,
            'completed',
            attestationResult.attestationUID,
            attestationResult.transactionHash
          );

          logger.info(`[BULK_ATTESTATION] Updated attestation ${attestation.id} status to completed`);
          successful++;
        } catch (error) {
          logger.error(`[BULK_ATTESTATION] Failed to create EAS attestation for member ${attestationData.member.ipePassport}:`, error);
          failed++;
          errors.push(`Member ${attestationData.member.ipePassport}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Mark as failed
          try {
            await storage.updateAttestationStatus(attestation.id, 'failed');
          } catch (updateError) {
            logger.error('Failed to update attestation status to failed:', updateError);
          }
        }
      }

      const totalProcessed = attestationDataList.length;
      logger.info(`[BULK_ATTESTATION] Completed processing: ${successful} successful, ${failed} failed out of ${totalProcessed} total`);
      
      const response = {
        message: `Processed ${totalProcessed} attestations for pulse ${pulseId}`,
        processed: totalProcessed,
        successful,
        failed,
        errors: errors.length > 0 ? errors : undefined
      };
      
      logger.info(`[BULK_ATTESTATION] Response:`, JSON.stringify(response));
      res.json(response);
    } catch (err) {
      logger.error("[BULK_ATTESTATION] Error in bulk attestation creation:", err);
      const errorResponse = { error: getErrorMessage(err) || "Failed to create pulse attestations", stack: err instanceof Error ? err.stack : undefined };
      logger.error("[BULK_ATTESTATION] Error response:", JSON.stringify(errorResponse));
      res.status(500).json({ error: getErrorMessage(err) || "Failed to create pulse attestations" });
    }
  });

  // Create attestation for a specific execution (admin only)
  app.post("/api/admin/attestations/create/:executionId", 
    authenticateUser, 
    requireAdmin,
    attestationRateLimit.middleware(),
    auditLogger("CREATE_SINGLE_ATTESTATION"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const executionId = parseInt(req.params.executionId);
      if (isNaN(executionId) || executionId <= 0) {
        return res.status(400).json({ error: "Invalid execution ID: must be a positive integer" });
      }

      // Get execution details with member and pulse info using db import
      const { db } = await import('./db');
      const { pulseExecutions, members, pulses } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [executionData] = await db
        .select({
          execution: pulseExecutions,
          member: members,
          pulse: pulses,
        })
        .from(pulseExecutions)
        .innerJoin(members, eq(pulseExecutions.memberId, members.id))
        .innerJoin(pulses, eq(pulseExecutions.pulseId, pulses.id))
        .where(eq(pulseExecutions.id, executionId));

      if (!executionData) {
        return res.status(404).json({ 
          error: "Pulse execution not found", 
          details: `No pulse execution found with ID ${executionId}. Please verify the execution ID is correct.`,
          executionId: executionId
        });
      }

      // Check if member is eligible for attestations
      if (executionData.member.status !== 'active_member' || !executionData.member.passportVerified || !executionData.member.ipePassport || !executionData.member.walletAddress) {
        return res.status(400).json({ error: "Member is not eligible for attestations" });
      }

      // Validate pulse state - only allow attestations for pulses that have ended (UTC timing)
      const nowUTC = getCurrentUTC();
      const pulseEndTimeUTC = calculatePulseEndTimeUTC(executionData.pulse.datetimeStart, executionData.pulse.interval);
      if (pulseEndTimeUTC > nowUTC) {
        const timeUntilEnd = Math.ceil((pulseEndTimeUTC.getTime() - nowUTC.getTime()) / (1000 * 60)); // minutes
        const hours = Math.floor(timeUntilEnd / 60);
        const minutes = timeUntilEnd % 60;
        const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        return res.status(400).json({ 
          error: "Cannot create attestations for active pulse", 
          details: `Pulse is still active and ends at ${pulseEndTimeUTC.toISOString()} UTC. Time remaining: ${timeString}`,
          pulseEndTime: pulseEndTimeUTC.toISOString(),
          timeRemaining: timeString
        });
      }

      // Validate execution data integrity
      if (!executionData.execution.actions || typeof executionData.execution.actions !== 'object') {
        return res.status(400).json({ error: "Invalid execution data: missing or malformed actions" });
      }

      // Use atomic transaction to create/get attestation record
      let pendingAttestation = await storage.getAttestation(executionId);
      
      if (!pendingAttestation) {
        try {
          pendingAttestation = await storage.createAttestationWithTransaction({
            pulseExecutionId: executionId,
            status: 'pending'
          });
        } catch (error) {
          // If creation failed due to race condition, try to get existing one
          pendingAttestation = await storage.getAttestation(executionId);
          if (!pendingAttestation) {
            throw error; // Re-throw if still no attestation found
          }
        }
      }

      if (pendingAttestation.status === 'completed') {
        return res.json({
          message: "Attestation already completed",
          attestation: {
            id: pendingAttestation.id,
            status: pendingAttestation.status,
            attestationUid: pendingAttestation.attestationUid,
            transactionHash: pendingAttestation.transactionHash
          }
        });
      }

      // Create the actual EAS attestation
      const { easService } = await import('./lib/easService');
      
      const attestationResult = await withTimeout(
        easService.createAttestation({
          memberOnchainID: executionData.member.ipePassport!,
          memberWalletAddress: executionData.member.walletAddress!,
          pulseNumber: executionData.pulse.id,
          executedAt: executionData.execution.executedAt ? Math.floor(new Date(executionData.execution.executedAt).getTime() / 1000) : Math.floor(getCurrentUTC().getTime() / 1000),
          actionsExecuted: JSON.stringify(executionData.execution.actions)
        }),
        45000, // 45 second timeout for EAS operations
        'EAS Attestation Creation'
      );

      // Update the attestation record
      const updatedAttestation = await storage.updateAttestationStatus(
        pendingAttestation.id,
        'completed',
        attestationResult.attestationUID,
        attestationResult.transactionHash
      );

      res.json({
        message: "Attestation created successfully",
        attestation: {
          id: updatedAttestation.id,
          status: updatedAttestation.status,
          attestationUid: updatedAttestation.attestationUid,
          transactionHash: updatedAttestation.transactionHash
        }
      });
    } catch (err) {
      logger.error("Create single attestation error:", err);
      
      // Try to mark as failed
      try {
        const existingAttestation = await storage.getAttestation(parseInt(req.params.executionId));
        if (existingAttestation) {
          await storage.updateAttestationStatus(existingAttestation.id, 'failed');
        }
      } catch (updateError) {
        logger.error('Failed to update attestation status to failed:', updateError);
      }
      
      res.status(500).json({ error: getErrorMessage(err) || "Failed to create attestation" });
    }
  });

  // Get member executions with pulse and attestation details
  app.get("/api/executions/:memberId/details", 
    authenticateUser, 
    requireOwnership('memberId'),
    auditLogger("GET_MEMBER_EXECUTION_DETAILS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const executionDetails = await storage.getMemberExecutionsWithDetails(memberId);
      
      const executionsWithDetails = executionDetails.map(({ execution, pulse, attestation }) => ({
        execution: {
          id: execution.id,
          actions: execution.actions,
          executedAt: execution.executedAt
        },
        pulse: {
          id: pulse.id,
          description: pulse.description,
          points: pulse.points,
          datetimeStart: pulse.datetimeStart,
          interval: pulse.interval,
          urlEmbed: pulse.urlEmbed
        },
        attestation: attestation ? {
          id: attestation.id,
          status: attestation.status,
          attestationUid: attestation.attestationUid,
          transactionHash: attestation.transactionHash,
          createdAt: attestation.createdAt
        } : null,
        pointsEarned: pulse.points // Add points earned for easy access
      }));

      res.json({ executionDetails: executionsWithDetails });
    } catch (err) {
      logger.error("Get execution details error:", err);
      res
        .status(500)
        .json({ error: getErrorMessage(err) || "Failed to get execution details" });
    }
  });
  
  // Legacy endpoint for backward compatibility
  app.get("/api/executions/by-member/:memberId", 
    authenticateUser, 
    requireOwnership('memberId'),
    auditLogger("GET_MEMBER_EXECUTIONS_BY_ID"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      if (isNaN(memberId)) {
        return res.status(400).json({ error: "Invalid member ID" });
      }
      const executions = await storage.getMemberExecutions(memberId);
      res.json({ executions });
    } catch (err) {
      logger.error("Get executions error:", err);
      res
        .status(500)
        .json({ error: getErrorMessage(err) || "Failed to get executions" });
    }
  });

  // Record pulse execution
  app.post("/api/executions", 
    authenticateUser,
    validateRequest(z.object({
      pulseId: z.number().int().positive(),
      actions: z.object({
        liked: z.boolean(),
        shared: z.boolean(),
        abstained: z.boolean(),
      })
    })),
    async (req: AuthenticatedRequest, res) => {
      try {
        logger.debug("Processing execution request", { 
          user: req.user, 
          body: req.body 
        });
        
        const { pulseId, actions } = req.body;
        
        // Check if execution already exists
        const existingExecution = await storage.getPulseExecution(pulseId, req.user!.id);
        
        if (existingExecution) {
          // Check if all actions are false (canceling abstain)
          if (!actions.liked && !actions.shared && !actions.abstained) {
            // Delete the execution entirely when canceling abstain
            await storage.deletePulseExecution(existingExecution.id);
            res.json({ success: true, execution: null, deleted: true });
          } else {
            // Update existing execution
            const execution = await storage.updatePulseExecution(existingExecution.id, actions);
            res.json({ success: true, execution, updated: true });
          }
        } else {
          // Create new execution - validate that at least one action is true for new executions
          if (!actions.liked && !actions.shared && !actions.abstained) {
            return res.status(400).json({ 
              error: "Validation failed", 
              message: "At least one action must be taken when creating a new execution" 
            });
          }
          
          const executionData = {
            pulseId,
            memberId: req.user!.id,
            actions
          };
          
          const execution = await storage.createPulseExecution(executionData);
          res.json({ success: true, execution, updated: false });
        }
      } catch (err) {
        logger.error("Create/update execution error:", err);
        res
          .status(500)
          .json({ error: getErrorMessage(err) || "Failed to record execution" });
      }
    }
  );

  // Get pending members (admin only)
  app.get("/api/admin/pending-members", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("GET_PENDING_MEMBERS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const pendingMembers = await storage.getPendingMembers();
      res.json({ members: pendingMembers });
    } catch (error) {
      logger.error("Get pending members error:", error);
      res.status(500).json({ error: "Failed to get pending members" });
    }
  });

  // Approve member (admin only)
  app.post("/api/admin/approve-member", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("APPROVE_MEMBER"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const { memberId, ipeUsername, userWalletAddress, memberType } = req.body;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      if (!userWalletAddress) {
        return res.status(400).json({ error: "User Wallet is required" });
      }

      if (!ipeUsername) {
        return res.status(400).json({ error: "IpeUsername is required" });
      }

      if (memberType && !['architect', 'explorer', 'admin', 'org_team', 'core_team'].includes(memberType)) {
        return res.status(400).json({ error: "Invalid member type. Must be 'architect', 'explorer', 'admin', 'org_team', or 'core_team'" });
      }

      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // For username claims, reserve subdomain with JustaName API
      if (ipeUsername && userWalletAddress) {
        logger.info(
          `Reserving subdomain ${ipeUsername}.ipecity.eth for user wallet ${userWalletAddress}`,
        );

        const reserveResponse = await fetch(
          "https://api.justaname.id/ens/v1/subname/reserve",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.JUSTANAME_API_KEY || "",
            },
            body: JSON.stringify({
              username: ipeUsername,
              ensDomain: "ipecity.eth",
              chainId: 1,
              ethAddress: userWalletAddress,
            }),
          },
        );

        const reserveResponseText = await reserveResponse.text();
        logger.info(
          "JustaName reserve response status:",
          reserveResponse.status,
        );
        logger.info("JustaName reserve response:", reserveResponseText);

        if (!reserveResponse.ok) {
          let errorData;
          try {
            errorData = JSON.parse(reserveResponseText);
          } catch (e) {
            errorData = { error: reserveResponseText };
          }
          
          logger.info("Debug - Status:", reserveResponse.status);
          logger.info("Debug - Error data:", JSON.stringify(errorData, null, 2));
          logger.info("Debug - Result error:", errorData.result?.error);
          logger.info("Debug - Direct error:", errorData.error);
          
          // If subdomain already exists, that's actually success - continue with approval
          if (reserveResponse.status === 409 && 
              (errorData.result?.error?.includes('SubdomainAlreadyExistsException') || 
               errorData.error?.includes('SubdomainAlreadyExistsException'))) {
            logger.info(`Subdomain ${ipeUsername}.ipecity.eth already exists - proceeding with approval`);
          } else {
            logger.info("Throwing error because condition not met");
            throw new Error(
              `Failed to reserve subdomain: ${errorData.result?.error || errorData.error || reserveResponse.statusText}`,
            );
          }
        }

        logger.info(
          `Successfully reserved ${ipeUsername}.ipecity.eth for ${userWalletAddress}`,
        );
      }

      // Update member status to approved - use memberId
      const updatedMember = memberType
        ? await storage.approveApplication(member.id, memberType)
        : await storage.approveMember(member.id);

      // Send approval email
      if (updatedMember.email) {
        const passportName = ipeUsername
          ? `${ipeUsername}.ipecity.eth`
          : updatedMember.ipePassport;
        if (passportName) {
          await sendApprovalEmail(updatedMember.email, passportName);
        }
      }

      res.json({ success: true, member: updatedMember });
    } catch (error) {
      logger.error("Approve member error:", error);
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  // Deny member (admin only)
  app.post("/api/admin/deny-member", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("DENY_MEMBER"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const { memberId } = req.body;
      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }
      const existingMember = await storage.getMember(memberId);
      if (!existingMember) {
        return res.status(404).json({ error: "Member not found" });
      }
      const deniedMember = await storage.denyMember(existingMember.id);

      // Send denial email
      if (deniedMember.email) {
        await sendDenialEmail(deniedMember.email);
      }

      res.json({ success: true, member: deniedMember });
    } catch (error) {
      logger.error("Deny member error:", error);
      res.status(500).json({ error: "Failed to deny member" });
    }
  });

  // Update member type (admin only)
  app.patch("/api/admin/update-member-type", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("UPDATE_MEMBER_TYPE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const { memberId, memberType } = req.body;

      if (!memberId) {
        return res.status(400).json({ error: "memberId is required" });
      }

      if (!memberType || typeof memberType !== 'string') {
        return res.status(400).json({ error: "memberType is required" });
      }

      // Validate member type against allowed values
      const validMemberTypes = ['pending', 'architect', 'explorer', 'admin', 'org_team', 'core_team'];
      if (!validMemberTypes.includes(memberType)) {
        return res.status(400).json({
          error: "Invalid member type. Must be one of: " + validMemberTypes.join(', ')
        });
      }

      const existingMember = await storage.getMember(memberId);
      if (!existingMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Update member type using memberId
      const updatedMember = await storage.updateMember(existingMember.id, {
        memberType: memberType as any
      });

      logger.info(`Updated member type for member ${existingMember.id} to ${memberType}`);
      res.json({ success: true, member: updatedMember });
    } catch (error) {
      logger.error("Update member type error:", error);
      res.status(500).json({ error: "Failed to update member type" });
    }
  });

  // Get all members (admin only)
  app.get("/api/members", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("GET_ALL_MEMBERS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const members = await storage.getAllMembers();
      res.json({ members });
    } catch (err) {
      logger.error("Get members error:", err);
      res.status(500).json({ error: getErrorMessage(err) || "Failed to get members" });
    }
  });

  // Get individual member by FID
  app.get("/api/members/:memberId", 
    authenticateUser, 
    requireOwnership('memberId'),
    auditLogger("GET_INDIVIDUAL_MEMBER"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      if (isNaN(memberId)) {
        return res.status(400).json({ error: "Invalid member ID" });
      }

      const member = await storage.getMember(memberId);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json(member);
    } catch (error) {
      logger.error("Failed to get member:", error);
      res.status(500).json({ error: "Failed to get member" });
    }
  });

  // Check if user is approved member
  app.get("/api/members/check/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      logger.info(`=== MEMBER CHECK DEBUG START (FID: ${farcasterFid}) ===`);
      logger.info(`Raw params:`, req.params);
      logger.info(`Parsed FID:`, farcasterFid);
      
      let member = await storage.getMemberByFarcasterFid(farcasterFid);
      logger.info(`Initial member lookup result:`, member ? { 
        id: member.id, 
        farcasterFid: member.farcasterFid, 
        status: member.status,
        emailVerified: member.emailVerified,
        ipePassport: member.ipePassport 
      } : null);

      // If no member exists, create one automatically after Farcaster authentication
      if (!member) {
        logger.info(`Member not found, creating new record for FID ${farcasterFid}`);
        try {
          // Get user profile from Neynar to populate username
          const userResponse = await neynar.fetchBulkUsers({
            fids: [farcasterFid],
          });
          const userProfile = userResponse.users[0];

          // Create basic member record with pending_id_verification status
          member = await storage.createMember({
            farcasterFid,
            status: "pending_id_verification",
            emailVerified: false,
            passportVerified: false,
          });

          logger.info(`Created new member record for FID ${farcasterFid}:`, {
            id: member.id,
            farcasterFid: member.farcasterFid,
            status: member.status
          });
        } catch (profileError) {
          logger.error("Error creating member record:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            status: "pending_id_verification",
            emailVerified: false,
            passportVerified: false,
          });
        }
      }

      // Legacy: promote any remaining pending_signer members to pending_id_verification
      if (member && member.status === "pending_signer") {
        try {
          member = await storage.updateMemberStatus(member.id, "pending_id_verification");
          logger.info(`Auto-promoted FID ${farcasterFid} from pending_signer to pending_id_verification`);
        } catch (signerError) {
          logger.error("Error promoting member status:", signerError);
        }
      }

      // Check if member should be automatically promoted to 'active_member' status
      if (
        member &&
        member.emailVerified &&
        member.ipePassport &&
        (member as any).status !== "active_member"
      ) {
        try {
          member = await storage.updateMemberStatus(member.id, "active_member");
          logger.info(
            `Auto-promoted FID ${farcasterFid} to active_member status (both verifications complete)`,
          );
        } catch (updateError) {
          logger.error("Error auto-promoting member:", updateError);
          // Continue without failing the request
        }
      }

      // Calculate totalPoints and pulseStreak if member exists
      let memberWithStats: (typeof member & { totalPoints?: number; pulseStreak?: number }) | null = member;
      if (member) {
        try {
          const totalPoints = await storage.calculateTotalPoints(member.id);
          const pulseStreak = await pulseService.calculateMemberStreak(member.id);
          memberWithStats = {
            ...member,
            totalPoints,
            pulseStreak,
          } as typeof member & { totalPoints: number; pulseStreak: number };
          logger.info(`Calculated stats for FID ${farcasterFid}: totalPoints=${totalPoints}, pulseStreak=${pulseStreak}`);
        } catch (statsError) {
          logger.error("Error calculating member stats:", statsError);
          // Continue without stats if calculation fails
        }
      }

      const response = {
        isMember: !!member,
        status: (member as any)?.status || "pending_id_verification",
        member: memberWithStats || null,
      };

      logger.info(`Final response for FID ${farcasterFid}:`, response);
      logger.info(`=== MEMBER CHECK DEBUG END ===`);

      res.json(response);
    } catch (err) {
      logger.error("Check member error:", err);
      res
        .status(500)
        .json({ error: getErrorMessage(err) || "Failed to check member status" });
    }
  });


  // Check username availability for passport claiming
  app.get("/api/passport/availability/:username", async (req, res) => {
    try {
      const { username } = req.params;

      if (!username || username.length < 3) {
        return res.status(400).json({
          error: "Username must be at least 3 characters long",
        });
      }

      // Sanitize username (lowercase, alphanumeric only)
      const sanitizedUsername = username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (sanitizedUsername !== username.toLowerCase()) {
        return res.status(400).json({
          error: "Username can only contain letters and numbers",
        });
      }

      // Check if username is already claimed by another member
      const existingMember =
        await storage.getMemberByIpePassport(sanitizedUsername);
      if (existingMember) {
        return res.json({
          available: false,
          reason: "This username is already taken",
        });
      }

      // Check with JustaName API for blockchain availability
      const response = await fetch(
        `https://api.justaname.id/ens/v1/subname/available?subname=${sanitizedUsername}.ipecity.eth&chainId=1`,
        {
          headers: {
            "X-API-KEY": process.env.JUSTANAME_API_KEY || "",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`JustaName API error: ${response.status}`);
      }

      const responseData = await response.json();

      res.json({
        available: responseData.result.data.isAvailable,
        reason: !responseData.result.data.isAvailable
          ? "This subdomain is already registered on-chain"
          : undefined,
      });
    } catch (error) {
      logger.error("Username availability check error:", error);
      res.status(500).json({ error: "Failed to check username availability" });
    }
  });

  // ENS Lookup endpoint
  app.get("/api/ens/lookup/:address", async (req, res) => {
    try {
      const { address } = req.params;

      if (!address) {
        return res.status(400).json({
          ensName: null,
          source: "justaname",
          error: "Address parameter is required",
        });
      }

      const result = await lookupEnsName(address);

      res.json(result);
    } catch (error) {
      logger.error("ENS lookup route error:", error);
      res.status(500).json({
        ensName: null,
        source: "justaname",
        error: "Internal server error",
      });
    }
  });

  return createServer(app);
}
