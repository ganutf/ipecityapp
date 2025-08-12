import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import { storage } from "./storage";

/**
 * Get current UTC timestamp for consistent server operations
 * All server-side timing should use UTC
 */
function getCurrentUTC(): Date {
  return new Date();
}

/**
 * Calculate pulse end time in UTC
 */
function calculatePulseEndTimeUTC(pulseStartUTC: Date, intervalHours: number): Date {
  return new Date(pulseStartUTC.getTime() + (intervalHours * 60 * 60 * 1000));
}
import {
  insertPulseSchema,
  updatePulseSchema,
  insertPulseTypeSchema,
  insertMemberSchema,
  insertPulseExecutionSchema,
  applicationSchema,
  applicationByMemberIdSchema,
  insertEmailVerificationSchema,
  insertPassportVerificationSchema,
  emailVerificationRequestSchema,
  emailVerificationRequestByMemberIdSchema,
  verificationCodeByMemberIdSchema,
  usernameClaimByMemberIdSchema,
  secureUsernameSchema,
  secureFidSchema,
} from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import { getSignedKey } from "./lib/getSignedKey";
import {
  sendVerificationEmail,
  sendApprovalEmail,
  sendDenialEmail,
  generateVerificationCode,
  canSendEmails,
  getEmailConfig,
} from "./lib/email";
import { mnemonicToAccount } from "viem/accounts";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { hexToBytes, bytesToHex } from "viem";
import { randomBytes } from "crypto";
import { SiweMessage } from "siwe";
import { lookupEnsName } from "./lib/ensLookup";
import { 
  verifyWalletSignature, 
  logSignatureVerification,
  generateChallengeMessage 
} from "./lib/cryptography";
import { getSecureEnvironmentVariable } from "./lib/keyManagement";
import { 
  authenticateUser, 
  requireAdmin, 
  requireOwnership,
  requireOwnershipByFid,
  auditLogger,
  type AuthenticatedRequest 
} from "./middleware/auth";
import { attestationRateLimit, bulkAttestationRateLimit, withTimeout } from "./lib/rateLimiter";
import {
  validateRequest,
  sanitizeRequestBody,
  securityHeaders,
  memberRegistrationSchema,
  usernameClaimSchema,
  verificationCodeSchema
} from "./middleware/validation";
import { 
  justaNameClient, 
  secureNeynarClient, 
  secureHttpClient 
} from "./lib/external-api";
import { 
  sanitizeMemberData, 
  HtmlSanitizer,
  IdentifierSanitizer,
  UrlSanitizer 
} from "./lib/sanitizer";
import logger, { logUtils } from "./logger";
// JustaName server-side imports removed

/* local unions for clarity */
type Reaction = "like" | "recast";
type CastParam = "hash" | "url";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security headers to all routes
  app.use(securityHeaders);
  
  // Apply request sanitization to all routes
  app.use(sanitizeRequestBody);
  
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

  /* ────────────────────────────────  SUBDOMAIN AVAILABILITY  ──────────────────────────────── */
  // Check subdomain availability
  app.get("/api/subname/available/:username", 
    validateRequest(z.object({
      params: z.object({
        username: secureUsernameSchema
      })
    })),
    async (req, res) => {
      try {
        const { username } = req.params;
        
        // Use secure JustaName client
        const result = await justaNameClient.checkSubdomainAvailability(username);
        
        res.json(result);
      } catch (error) {
        logger.error('Error checking subdomain availability', { error: (error as Error)?.message || 'Unknown error' });
        res.status(500).json({
          error: "Failed to check subdomain availability",
        });
      }
    }
  );




  // Claim username (update ipe_username field)
  app.post("/api/username/claim", 
    authenticateUser,
    validateRequest(usernameClaimSchema),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { farcasterFid, username, walletAddress } = req.body;

        // Sanitize inputs
        const sanitizedData = {
          farcasterFid: IdentifierSanitizer.sanitizeFid(farcasterFid),
          username: IdentifierSanitizer.sanitizeUsername(username),
          walletAddress: IdentifierSanitizer.sanitizeWalletAddress(walletAddress)
        };

        if (!sanitizedData.farcasterFid || !sanitizedData.username || !sanitizedData.walletAddress) {
          return res.status(400).json({ error: "Invalid input data" });
        }

        // Update member with claimed username, wallet address, and change status to pending_application_review
        const member = await storage.updateMemberByFarcasterFid(sanitizedData.farcasterFid, {
          ipeUsername: sanitizedData.username,
          walletAddress: sanitizedData.walletAddress,
          status: "pending_application_review",
        });

        res.json({ success: true, member, username: sanitizedData.username });
      } catch (error) {
        console.error("Error claiming username:", error);
        res.status(500).json({ error: "Failed to claim username" });
      }
    }
  );

  // Accept reserved subdomain (user action after admin approval)
  app.post("/api/subname/accept", 
    authenticateUser,
    validateRequest(z.object({
      body: z.object({
        farcasterFid: secureFidSchema
      })
    })),
    async (req: AuthenticatedRequest, res) => {
    try {
      const { farcasterFid } = req.body;

      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member || !member.ipeUsername) {
        return res.status(404).json({ error: "Member or username not found" });
      }

      if (member.status !== "approved_application") {
        return res
          .status(400)
          .json({ error: "Subdomain must be approved first" });
      }

      // Call JustaName accept API
      const acceptResponse = await fetch(
        "https://api.justaname.id/ens/v1/subname/accept",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.VITE_JUSTANAME_API_KEY || "",
          },
          body: JSON.stringify({
            username: member.ipeUsername,
            ensDomain: "ipecity.eth",
            chainId: 1,
          }),
        },
      );

      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        throw new Error(
          `Failed to accept subdomain: ${errorData.error || acceptResponse.statusText}`,
        );
      }

      const acceptData = await acceptResponse.json();

      // Update member status to active_member
      const updatedMember = await storage.updateMemberByFarcasterFid(farcasterFid, {
        status: "active_member",
        passportVerified: true,
      });

      res.json({ success: true, member: updatedMember, acceptData });
    } catch (error) {
      console.error("Error accepting subdomain:", error);
      res.status(500).json({ error: "Failed to accept subdomain" });
    }
  });

  /* ────────────────────────────────  QR CODE GENERATION  ──────────────────────────────── */
  // Public QR code endpoint - no authentication required for signer approval
  app.post("/api/qrcode", async (req: Request, res) => {
    try {
      console.log('QR Code API called - no auth required');
      
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
      console.error("QR code generation error:", error);
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
        const msg = isApiErrorResponse(e)
          ? e.response.data
          : (e as Error).message;
        // @ts-ignore: e is API error object with statusCode
        res.status(e.statusCode ?? 500).json({ error: msg });
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
        const msg = isApiErrorResponse(e)
          ? e.response.data
          : (e as Error).message;
        // @ts-ignore: e is API error object with statusCode
        res.status(e.statusCode ?? 500).json({ error: msg });
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
        
        console.log(`=== SIGNER LOOKUP DEBUG START ===`);
        console.log(`Raw FID from params: ${fid}`);
        
        // Validate FID
        const sanitizedFid = IdentifierSanitizer.sanitizeFid(fid);
        if (!sanitizedFid) {
          console.log(`FID validation failed for: ${fid}`);
          return res.status(400).json({ error: "Invalid FID" });
        }

        console.log(`Sanitized FID: ${sanitizedFid}`);

        // Check if member exists
        const member = await storage.getMemberByFarcasterFid(sanitizedFid);
        console.log(`Member lookup result:`, member ? {
          id: member.id,
          farcasterFid: member.farcasterFid,
          status: member.status,
          memberType: member.memberType
        } : 'NOT FOUND');

        if (!member) {
          console.log(`No member found for FID ${sanitizedFid} - returning 404`);
          return res.status(404).json({ 
            error: "Member not found",
            message: "No member record exists for this FID. Please sign up first." 
          });
        }

        console.log(`Looking for signer for FID: ${sanitizedFid}`);

        // Check if user already has a signer
        let userSigner;
        try {
          userSigner = await storage.getUserSignerByFarcasterFid(sanitizedFid);
          console.log("Existing signer lookup result:", userSigner ? {
            farcasterFid: userSigner.farcasterFid,
            signerUuid: userSigner.signerUuid,
            status: userSigner.status
          } : 'NO SIGNER FOUND');
        } catch (dbError) {
          console.error("Database error when fetching signer:", dbError);
          return res.status(500).json({ error: "Database connection error" });
        }

      if (userSigner) {
        // If signer is pending, check current status with Neynar
        if (userSigner.status === "pending_approval") {
          try {
            console.log(
              "Checking signer status with Neynar for UUID:",
              userSigner.signerUuid,
            );
            const signerStatus = await neynar.lookupSigner({
              signerUuid: userSigner.signerUuid,
            });
            console.log("Neynar signer status:", signerStatus);

            if (signerStatus.status === "approved") {
              // Update database with approved status
              await storage.updateUserSignerStatus(sanitizedFid, "approved");
              console.log("Signer approved! Updated database status.");

              // Also update member status to 'signer_approved' if they're still pending_signer
              try {
                const member = await storage.getMemberByFarcasterFid(sanitizedFid);
                if (member && member.status === "pending_signer") {
                  await storage.updateMemberStatus(sanitizedFid, "pending_id_verification");
                  console.log("Updated member status to pending_id_verification");
                }
              } catch (memberError) {
                console.error("Error updating member status:", memberError);
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
            console.error(
              "Error checking signer status with Neynar:",
              statusError,
            );
            
            // Handle 404 (signer not found) and 429 (rate limit) errors
            // @ts-ignore: statusError is API error object with status codes
            if (statusError.status === 404 || statusError.response?.status === 404) {
              console.log("Signer not found on Neynar - cleaning up stale record");
              
              try {
                // Delete the stale signer record
                await storage.deleteUserSignerByFarcasterFid(sanitizedFid);
                console.log("Deleted stale signer record");
                
                // Return error asking user to try again instead of immediately creating new signer
                // This prevents rate limit issues from rapid signer creation
                return res.status(404).json({
                  error: "Stale signer found",
                  message: "Your previous signer was invalid and has been cleaned up. Please refresh the page to get a new signer.",
                  action: "refresh_required"
                });
                
              } catch (cleanupError) {
                console.error("Error cleaning up stale signer:", cleanupError);
                return res.status(500).json({ 
                  error: "Failed to cleanup stale signer",
                  // @ts-ignore: cleanupError is API error object  
                  details: cleanupError.message 
                });
              }
            }
            
            // Handle rate limiting errors
            // @ts-ignore: statusError is API error object with status codes
            if (statusError.status === 429 || statusError.response?.status === 429) {
              console.log("Rate limit hit when checking signer status");
              // @ts-ignore: statusError is API error object with response headers
              const retryAfter = statusError.response?.headers?.['retry-after'] || 60;
              
              return res.status(429).json({
                error: "Rate limit exceeded",
                message: `Too many requests to Neynar API. Please wait ${retryAfter} seconds before trying again.`,
                retryAfter: parseInt(retryAfter),
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
        console.log("=== CREATING NEW SIGNER ===");
        console.log("Creating new sponsored signer for FID:", sanitizedFid);
        console.log("Member status:", member.status);
        
        try {
          const signerData = await getSignedKey(true); // sponsored = true
          console.log("Created and registered signer:", {
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

          console.log("Signer stored in database:", {
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
          console.error("Error creating signer:", signerError);
          
          // Handle rate limiting specifically
          // @ts-ignore: signerError is API error object with status codes
          if (signerError.status === 429 || signerError.response?.status === 429) {
            // @ts-ignore: signerError is API error object with response headers
            const retryAfter = signerError.response?.headers?.['retry-after'] || 60;
            
            return res.status(429).json({
              error: "Rate limit exceeded",
              message: `Too many signer creation requests. Please wait ${retryAfter} seconds before trying again.`,
              retryAfter: parseInt(retryAfter),
              action: "wait_and_retry"
            });
          }
          
          return res.status(500).json({ 
            error: "Failed to create signer", 
            // @ts-ignore: signerError is API error object
            details: signerError.message,
            message: "Unable to create Farcaster signer. Please try again in a few minutes."
          });
        }
      }
    } catch (e) {
      console.error("Signer endpoint error:", e);
      const msg = isApiErrorResponse(e)
        ? e.response.data
        : (e as Error).message;
      // @ts-ignore: e is API error object with statusCode
      res.status(e.statusCode ?? 500).json({ error: msg });
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
          console.log("Signer info from Neynar:", signerInfo);

          // Update status if it has changed
          if (signerInfo.status !== userSigner.status) {
            await storage.updateUserSignerStatus(sanitizedFid, signerInfo.status);
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
        console.log("Neynar lookup error:", neynarError);
        // If we can't check with Neynar, return current status
        res.json({
          status: userSigner.status,
          updated: false,
          signer_uuid: userSigner.signerUuid,
          note: "Could not verify with Neynar",
        });
      }
    } catch (e) {
      const msg = isApiErrorResponse(e)
        ? e.response.data
        : (e as Error).message;
      // @ts-ignore - Complex API error handling with status codes
      res.status(e.statusCode ?? 500).json({ error: msg });
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
      res.status(500).json({ error: (e as Error).message });
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
        error: (e as Error).message,
        stack: (e as Error).stack,
        neynarError: isApiErrorResponse(e) ? e.response.data : null
      });

      const msg = isApiErrorResponse(e)
        ? e.response.data
        : (e as Error).message;
      // @ts-ignore - Complex API error handling with status codes
      res.status(e.statusCode ?? 500).json({ error: msg });
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
    } catch (err: any) {
      console.error("Active pulses error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to get active pulses" });
    }
  });


  // Get all pulses
  app.get("/api/pulses", async (req, res) => {
    try {
      const pulses = await storage.getAllPulses();
      res.json({ pulses });
    } catch (err: any) {
      console.error("Get pulses error:", err);
      res.status(500).json({ error: err.message || "Failed to get pulses" });
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
    } catch (err: any) {
      console.error("Create pulse error:", err);
      res.status(500).json({ error: err.message || "Failed to create pulse" });
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
    } catch (err: any) {
      console.error("Update pulse error:", err);
      res.status(500).json({ error: err.message || "Failed to update pulse" });
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
    } catch (err: any) {
      console.error("Delete pulse error:", err);
      res.status(500).json({ error: err.message || "Failed to delete pulse" });
    }
  });

  // Pulse Types API routes
  
  // Get all pulse types
  app.get("/api/pulse-types", async (req, res) => {
    try {
      const pulseTypes = await storage.getAllPulseTypes();
      res.json({ pulseTypes });
    } catch (err: any) {
      console.error("Get pulse types error:", err);
      res.status(500).json({ error: err.message || "Failed to get pulse types" });
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
    } catch (err: any) {
      console.error("Create pulse type error:", err);
      res.status(500).json({ error: err.message || "Failed to create pulse type" });
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
    } catch (err: any) {
      console.error("Get attestation error:", err);
      res.status(500).json({ error: err.message || "Failed to get attestation status" });
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
    } catch (err: any) {
      console.error("Get pending attestations error:", err);
      res.status(500).json({ error: err.message || "Failed to get pending attestations" });
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
    } catch (err: any) {
      console.error("Get pulse executions error:", err);
      res.status(500).json({ error: err.message || "Failed to get pulse executions" });
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
      console.log(`[BULK_ATTESTATION] Starting bulk attestation creation for pulse ${req.params.pulseId}`);
      
      const pulseId = parseInt(req.params.pulseId);
      if (isNaN(pulseId) || pulseId <= 0) {
        console.log(`[BULK_ATTESTATION] Invalid pulse ID: ${req.params.pulseId}`);
        return res.status(400).json({ error: "Invalid pulse ID: must be a positive integer" });
      }

      // Verify pulse exists and is in valid state for attestations
      const pulse = await storage.getPulse(pulseId);
      if (!pulse) {
        console.log(`[BULK_ATTESTATION] Pulse not found: ${pulseId}`);
        return res.status(404).json({ error: "Pulse not found" });
      }

      // Validate pulse state - only allow attestations for pulses that have ended (UTC timing)
      const nowUTC = getCurrentUTC();
      const pulseEndTimeUTC = calculatePulseEndTimeUTC(pulse.datetimeStart, pulse.interval);
      console.log(`[BULK_ATTESTATION] UTC Pulse timing - Now: ${nowUTC.toISOString()}, End: ${pulseEndTimeUTC.toISOString()}, Ended: ${pulseEndTimeUTC <= nowUTC}`);
      
      if (pulseEndTimeUTC > nowUTC) {
        console.log(`[BULK_ATTESTATION] Pulse still active, cannot create attestations`);
        return res.status(400).json({ 
          error: "Cannot create attestations for active pulse", 
          details: `Pulse ends at ${pulseEndTimeUTC.toISOString()} UTC` 
        });
      }

      // Get pending attestations for this pulse only
      console.log(`[BULK_ATTESTATION] Getting pending attestations for pulse ${pulseId}`);
      const pendingAttestations = await storage.getPendingAttestationsByPulse(pulseId);
      console.log(`[BULK_ATTESTATION] Found ${pendingAttestations.length} pending attestations`);
      
      if (pendingAttestations.length === 0) {
        console.log(`[BULK_ATTESTATION] No pending attestations found, returning early`);
        return res.json({ 
          message: "No pending attestations found for this pulse",
          processed: 0,
          successful: 0,
          failed: 0
        });
      }

      // Import the EAS service
      console.log(`[BULK_ATTESTATION] Importing EAS service`);
      const { easService } = await import('./lib/easService');
      
      // Prepare attestation data for batch processing
      const attestationDataList = [];
      
      console.log(`[BULK_ATTESTATION] Processing ${pendingAttestations.length} pending attestations`);
      for (const { execution, member, pulse } of pendingAttestations) {
        console.log(`[BULK_ATTESTATION] Processing execution ${execution.id} for member ${member.ipePassport}`);
        
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
          console.log(`[BULK_ATTESTATION] Added execution ${execution.id} to attestation list`);
        } else {
          console.log(`[BULK_ATTESTATION] Skipping execution ${execution.id} - already has completed attestation`);
        }
      }
      
      console.log(`[BULK_ATTESTATION] Prepared ${attestationDataList.length} attestations for processing`);

      // Create attestation records atomically
      console.log(`[BULK_ATTESTATION] Creating ${attestationDataList.length} attestation records in database`);
      const attestationResults = await storage.createBulkAttestationsWithTransaction(
        attestationDataList.map(data => ({
          pulseExecutionId: data.pulseExecutionId,
          status: data.status
        }))
      );

      console.log(`[BULK_ATTESTATION] Database results: ${attestationResults.successful.length} successful, ${attestationResults.failed.length} failed`);

      // Process EAS attestations for successfully created database records
      let successful = 0;
      let failed = attestationResults.failed.length;
      const errors: string[] = attestationResults.failed.map(f => f.error);
      
      console.log(`[BULK_ATTESTATION] Starting EAS attestation creation for ${attestationResults.successful.length} records`);

      for (const attestation of attestationResults.successful) {
        const attestationData = attestationDataList.find(d => d.pulseExecutionId === attestation.pulseExecutionId);
        if (!attestationData) {
          console.log(`[BULK_ATTESTATION] WARNING: Could not find attestation data for execution ${attestation.pulseExecutionId}`);
          continue;
        }

        console.log(`[BULK_ATTESTATION] Processing EAS attestation for member ${attestationData.member.ipePassport} (execution ${attestation.pulseExecutionId})`);

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

          console.log(`[BULK_ATTESTATION] EAS attestation created: ${attestationResult.attestationUID}`);

          // Update the attestation record
          await storage.updateAttestationStatus(
            attestation.id,
            'completed',
            attestationResult.attestationUID,
            attestationResult.transactionHash
          );

          console.log(`[BULK_ATTESTATION] Updated attestation ${attestation.id} status to completed`);
          successful++;
        } catch (error) {
          console.error(`[BULK_ATTESTATION] Failed to create EAS attestation for member ${attestationData.member.ipePassport}:`, error);
          failed++;
          errors.push(`Member ${attestationData.member.ipePassport}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          
          // Mark as failed
          try {
            await storage.updateAttestationStatus(attestation.id, 'failed');
          } catch (updateError) {
            console.error('Failed to update attestation status to failed:', updateError);
          }
        }
      }

      const totalProcessed = attestationDataList.length;
      console.log(`[BULK_ATTESTATION] Completed processing: ${successful} successful, ${failed} failed out of ${totalProcessed} total`);
      
      const response = {
        message: `Processed ${totalProcessed} attestations for pulse ${pulseId}`,
        processed: totalProcessed,
        successful,
        failed,
        errors: errors.length > 0 ? errors : undefined
      };
      
      console.log(`[BULK_ATTESTATION] Response:`, JSON.stringify(response));
      res.json(response);
    } catch (err: any) {
      console.error("[BULK_ATTESTATION] Error in bulk attestation creation:", err);
      const errorResponse = { error: err.message || "Failed to create pulse attestations", stack: err.stack };
      console.error("[BULK_ATTESTATION] Error response:", JSON.stringify(errorResponse));
      res.status(500).json({ error: err.message || "Failed to create pulse attestations" });
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
    } catch (err: any) {
      console.error("Create single attestation error:", err);
      
      // Try to mark as failed
      try {
        const existingAttestation = await storage.getAttestation(parseInt(req.params.executionId));
        if (existingAttestation) {
          await storage.updateAttestationStatus(existingAttestation.id, 'failed');
        }
      } catch (updateError) {
        console.error('Failed to update attestation status to failed:', updateError);
      }
      
      res.status(500).json({ error: err.message || "Failed to create attestation" });
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
    } catch (err: any) {
      console.error("Get execution details error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to get execution details" });
    }
  });
  
  // Legacy endpoint for backward compatibility
  app.get("/api/executions/by-fid/:farcasterFid", 
    authenticateUser, 
    requireOwnershipByFid('farcasterFid'),
    auditLogger("GET_MEMBER_EXECUTIONS_BY_FID"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      const executions = await storage.getMemberExecutionsByFarcasterFid(farcasterFid);
      res.json({ executions });
    } catch (err: any) {
      console.error("Get executions error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to get executions" });
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
      } catch (err: any) {
        console.error("Create/update execution error:", err);
        res
          .status(500)
          .json({ error: err.message || "Failed to record execution" });
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
      console.error("Get pending members error:", error);
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
      const { farcasterFid, ipeUsername, userWalletAddress, memberType } = req.body;

      if (!farcasterFid) {
        return res.status(400).json({ error: "FID is required" });
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

      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // For username claims, reserve subdomain with JustaName API
      if (ipeUsername && userWalletAddress) {
        console.log(
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
        console.log(
          "JustaName reserve response status:",
          reserveResponse.status,
        );
        console.log("JustaName reserve response:", reserveResponseText);

        if (!reserveResponse.ok) {
          let errorData;
          try {
            errorData = JSON.parse(reserveResponseText);
          } catch (e) {
            errorData = { error: reserveResponseText };
          }
          
          console.log("Debug - Status:", reserveResponse.status);
          console.log("Debug - Error data:", JSON.stringify(errorData, null, 2));
          console.log("Debug - Result error:", errorData.result?.error);
          console.log("Debug - Direct error:", errorData.error);
          
          // If subdomain already exists, that's actually success - continue with approval
          if (reserveResponse.status === 409 && 
              (errorData.result?.error?.includes('SubdomainAlreadyExistsException') || 
               errorData.error?.includes('SubdomainAlreadyExistsException'))) {
            console.log(`Subdomain ${ipeUsername}.ipecity.eth already exists - proceeding with approval`);
          } else {
            console.log("Throwing error because condition not met");
            throw new Error(
              `Failed to reserve subdomain: ${errorData.result?.error || errorData.error || reserveResponse.statusText}`,
            );
          }
        }

        console.log(
          `Successfully reserved ${ipeUsername}.ipecity.eth for ${userWalletAddress}`,
        );
      }

      // Update member status to approved
      const updatedMember = memberType 
        ? await storage.approveApplicationByFarcasterFid(farcasterFid, memberType)
        : await storage.approveMemberByFarcasterFid(farcasterFid);

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
      console.error("Approve member error:", error);
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  // Update member status after client-side subdomain acceptance
  app.post("/api/passport/accept", async (req, res) => {
    try {
      const { farcasterFid } = req.body;

      if (!farcasterFid) {
        return res.status(400).json({ error: "FarcasterFid required" });
      }

      console.log(`Processing subdomain acceptance status update for FID: ${farcasterFid}`);

      // Get member details
      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Check if member is in approved_application state
      if (member.status !== "approved_application") {
        return res.status(400).json({ error: "Member is not in approved_application state" });
      }

      // Update status to member after client-side JustaName acceptance
      const updatedMember = await storage.acceptSubdomain(member.id);

      console.log(`Member status updated to 'member' for FID: ${farcasterFid}`);
      res.json({ success: true, member: updatedMember });
    } catch (error) {
      console.error("Accept subdomain error:", error);
      res.status(500).json({ error: "Failed to accept subdomain" });
    }
  });

  // Deny member (admin only)
  app.post("/api/admin/deny-member", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("DENY_MEMBER"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const { farcasterFid } = req.body;
      const member = await storage.denyMember(farcasterFid);

      // Send denial email
      if (member.email) {
        await sendDenialEmail(member.email);
      }

      res.json({ success: true, member });
    } catch (error) {
      console.error("Deny member error:", error);
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
      const { farcasterFid, memberType } = req.body;

      // Validate required fields
      if (!farcasterFid || typeof farcasterFid !== 'number') {
        return res.status(400).json({ error: "Valid farcasterFid is required" });
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

      // Check if member exists and get memberId
      const existingMember = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!existingMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Update member type using memberId
      const updatedMember = await storage.updateMember(existingMember.id, { 
        memberType: memberType as any 
      });

      console.log(`Updated member type for FID ${farcasterFid} to ${memberType}`);
      res.json({ success: true, member: updatedMember });
    } catch (error) {
      console.error("Update member type error:", error);
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
    } catch (err: any) {
      console.error("Get members error:", err);
      res.status(500).json({ error: err.message || "Failed to get members" });
    }
  });

  // Get individual member by FID
  app.get("/api/members/:fid", 
    authenticateUser, 
    requireOwnership('fid'),
    auditLogger("GET_INDIVIDUAL_MEMBER"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const fid = parseInt(req.params.fid);
      if (isNaN(fid)) {
        return res.status(400).json({ error: "Invalid FID" });
      }

      const member = await storage.getMemberByFarcasterFid(fid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json(member);
    } catch (error: any) {
      console.error("Failed to get member:", error);
      res.status(500).json({ error: "Failed to get member" });
    }
  });

  // Update member status
  app.post("/api/members/status", async (req, res) => {
    try {
      const { farcasterFid, status } = req.body;
      const member = await storage.updateMemberStatusByFarcasterFid(farcasterFid, status);
      res.json({ success: true, member });
    } catch (error) {
      console.error("Update member status error:", error);
      res.status(500).json({ error: "Failed to update member status" });
    }
  });

  // Community endpoints
  app.get("/api/community/members", 
    authenticateUser,
    auditLogger("GET_COMMUNITY_MEMBERS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      console.log("=== GET_COMMUNITY_MEMBERS DEBUG START ===");
      console.log("Authenticated user FID:", req.user?.fid);
      
      const members = await storage.getActiveMembersWithStats();
      console.log("Retrieved members count:", members.length);
      console.log("Sample member data:", members[0] ? JSON.stringify(members[0], null, 2) : "No members found");
      
      // Fetch Farcaster profile data for all members
      let membersWithProfiles = members;
      if (members.length > 0) {
        try {
          console.log("Fetching Farcaster profiles for", members.length, "members");
          const fids = members.map(m => m.farcasterFid);
          const userResponse = await neynar.fetchBulkUsers({ fids });
          
          if (userResponse.users && userResponse.users.length > 0) {
            // Create a map of FID to profile data
            const profileMap = new Map();
            // @ts-ignore - Neynar API user object typing
            userResponse.users.forEach(user => {
              profileMap.set(user.fid, {
                displayName: user.display_name,
                username: user.username,
                pfpUrl: user.pfp_url,
                bio: user.profile?.bio?.text,
              });
            });
            
            // Merge profile data with member data
            membersWithProfiles = members.map(member => {
              const profile = profileMap.get(member.farcasterFid);
              return {
                ...member,
                displayName: profile?.displayName,
                username: profile?.username,
                pfpUrl: profile?.pfpUrl,
                farcasterBio: profile?.bio,
              };
            });
            
            console.log("Enhanced members with profile data, sample:", JSON.stringify(membersWithProfiles[0], null, 2));
          }
        } catch (profileError) {
          console.warn("Failed to fetch Farcaster profiles:", profileError);
          // Continue with members without profile data
        }
      }
      
      const response = { members: membersWithProfiles };
      console.log("Sending response with", response.members.length, "members");
      console.log("=== GET_COMMUNITY_MEMBERS DEBUG END ===");
      
      res.json(response);
    } catch (err: any) {
      console.error("Get community members error:", err);
      console.error("Error stack:", err.stack);
      res.status(500).json({ 
        error: err.message || "Failed to get community members",
        status: 500,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/community/members/:fid", 
    authenticateUser,
    auditLogger("GET_COMMUNITY_MEMBER_DETAILS"),
    async (req: AuthenticatedRequest, res) => {
    try {
      console.log("=== GET_COMMUNITY_MEMBER_DETAILS DEBUG START ===");
      const fid = parseInt(req.params.fid);
      console.log("Requested FID:", fid, "from params:", req.params.fid);
      
      if (isNaN(fid)) {
        console.log("Invalid FID provided");
        return res.status(400).json({ error: "Invalid FID" });
      }

      const member = await storage.getMemberWithStats(fid);
      console.log("Retrieved member from storage:", member ? JSON.stringify(member, null, 2) : "Member not found");
      
      if (!member) {
        console.log("Member not found for FID:", fid);
        return res.status(404).json({ error: "Member not found" });
      }

      // Fetch Farcaster profile data
      let profileData = null;
      try {
        console.log("Fetching Farcaster profile for FID:", fid);
        const userResponse = await neynar.fetchBulkUsers({ fids: [fid] });
        if (userResponse.users && userResponse.users.length > 0) {
          const user = userResponse.users[0];
          profileData = {
            displayName: user.display_name,
            username: user.username,
            pfpUrl: user.pfp_url,
            bio: user.profile?.bio?.text,
          };
          console.log("Fetched profile data:", profileData);
        }
      } catch (profileError) {
        console.warn("Failed to fetch Farcaster profile:", profileError);
        // Continue without profile data
      }

      const memberWithProfile = {
        ...member,
        displayName: profileData?.displayName,
        username: profileData?.username,
        pfpUrl: profileData?.pfpUrl,
        farcasterBio: profileData?.bio, // Keep separate from member bio
      };

      console.log("Final member response:", JSON.stringify(memberWithProfile, null, 2));
      console.log("=== GET_COMMUNITY_MEMBER_DETAILS DEBUG END ===");
      res.json(memberWithProfile);
    } catch (error: any) {
      console.error("Failed to get community member details:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ 
        error: "Failed to get member details",
        status: 500,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Submit application
  app.post("/api/application/submit", async (req, res) => {
    try {
      const validatedApplication = applicationSchema.parse(req.body);
      const member = await storage.submitApplication(validatedApplication);
      res.json({ success: true, member });
    } catch (error) {
      console.error("Submit application error:", error);
      res.status(500).json({ error: "Failed to submit application" });
    }
  });

  // Get pending applications (admin only)
  app.get("/api/applications/pending", async (req, res) => {
    try {
      const applications = await storage.getPendingApplications();
      res.json({ applications });
    } catch (error) {
      console.error("Get pending applications error:", error);
      res.status(500).json({ error: "Failed to get pending applications" });
    }
  });

  // JustaName challenge endpoint removed - subdomain creation now client-side only

  // Admin approve application
  app.post("/api/admin/approve-application", 
    authenticateUser, 
    requireAdmin, 
    auditLogger("APPROVE_APPLICATION"),
    async (req: AuthenticatedRequest, res) => {
    try {
      console.log("=== APPLICATION APPROVAL REQUEST ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));

      const { farcasterFid, memberType } = req.body;

      if (!farcasterFid || !memberType) {
        console.error("Missing farcasterFid or memberType in request");
        return res.status(400).json({ error: "FarcasterFid and memberType required" });
      }

      if (!['architect', 'explorer', 'admin', 'org_team', 'core_team'].includes(memberType)) {
        return res.status(400).json({ error: "Invalid member type. Must be 'architect', 'explorer', 'admin', 'org_team', or 'core_team'" });
      }

      console.log(`Processing approval for FID: ${farcasterFid} as ${memberType}`);

      // Get member details
      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member || !member.ipeUsername) {
        console.error("Invalid application - missing member or username");
        return res.status(400).json({ error: "Invalid application data" });
      }

      console.log(`Found member with username: ${member.ipeUsername}`);

      // Reserve subdomain via JustaName API
      const subdomain = member.ipeUsername;
      const ensName = `${subdomain}.ipecity.eth`;
      const userWalletAddress = member.walletAddress;

      if (!userWalletAddress) {
        return res.status(400).json({ error: "Member wallet address required for subdomain reservation" });
      }

      console.log(`Reserving subdomain ${subdomain} for wallet ${userWalletAddress}`);

      const justanameResponse = await fetch("https://api.justaname.id/api/v1/subname/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.JUSTANAME_API_KEY}`,
        },
        body: JSON.stringify({
          username: subdomain,
          ensDomain: "ipecity.eth",
          chainId: 1,
          userAddress: userWalletAddress,
        }),
      });

      if (!justanameResponse.ok) {
        const errorData = await justanameResponse.json();
        console.error("JustaName reserve error:", errorData);
        return res.status(500).json({ error: `Failed to reserve subdomain: ${errorData.error || 'Unknown error'}` });
      }

      const justanameData = await justanameResponse.json();
      console.log("JustaName reserve response:", JSON.stringify(justanameData, null, 2));

      // Update member status and type
      console.log("Updating member status to approved_application...");
      const updatedMember = await storage.approveApplication(farcasterFid, memberType);
      console.log(`Member updated successfully. New status: ${updatedMember.status}, type: ${updatedMember.memberType}`);

      // Send approval email (with error handling to prevent server crash)
      if (updatedMember.email) {
        console.log(`Sending approval email to: ${updatedMember.email}`);
        try {
          await sendApprovalEmail(updatedMember.email, ensName);
          console.log("Approval email sent successfully");
        } catch (emailError) {
          console.error(
            "Failed to send approval email (non-fatal):",
            emailError,
          );
          // Continue with response even if email fails
        }
      } else {
        console.log("No email address found - skipping approval email");
      }

      const response = { success: true, member: updatedMember, ensName };
      console.log("=== PASSPORT APPROVAL SUCCESS ===");
      console.log("Response:", JSON.stringify(response, null, 2));

      res.json(response);
    } catch (error) {
      console.error("=== PASSPORT APPROVAL ERROR ===");
      console.error("Error details:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace",
      );
      res.status(500).json({ error: "Failed to approve passport claim" });
    }
  });

  // Deny passport claim (admin only)
  app.post("/api/passport/deny", async (req, res) => {
    try {
      const { farcasterFid } = req.body;
      const member = await storage.denyMemberByFarcasterFid(farcasterFid);

      // Send denial email
      if (member.email) {
        await sendDenialEmail(member.email);
      }

      res.json({ success: true, member });
    } catch (error) {
      console.error("Deny passport claim error:", error);
      res.status(500).json({ error: "Failed to deny passport claim" });
    }
  });

  // Email configuration test endpoint
  app.get("/api/email/config", async (req, res) => {
    try {
      const config = getEmailConfig();
      res.json({
        success: true,
        config,
        environment: process.env.NODE_ENV,
        hasResendKey: !!process.env.RESEND_API_KEY,
        testMode: process.env.EMAIL_TEST_MODE
      });
    } catch (error) {
      console.error("Email config error:", error);
      res.status(500).json({ error: "Failed to get email config" });
    }
  });

  // Request email verification
  app.post("/api/auth/request-email-verification", async (req, res) => {
    try {
      const validatedRequest = emailVerificationRequestSchema.parse(req.body);
      const { farcasterFid, email } = validatedRequest;

      // Check if email system can send emails
      if (!canSendEmails()) {
        const config = getEmailConfig();
        console.error('📧 Email system not configured:', config);
        return res.status(500).json({ 
          error: "Email system not configured",
          details: config.testMode 
            ? "Test mode is enabled but not working properly" 
            : "RESEND_API_KEY is missing or invalid"
        });
      }

      // Generate verification code
      const code = generateVerificationCode();

      // Create email verification record
      const memberId = await storage.getMemberIdFromFarcasterFid(farcasterFid);
      if (!memberId) {
        return res.status(404).json({ 
          error: 'Member not found',
          status: 404,
          timestamp: new Date().toISOString()
        });
      }

      await storage.createEmailVerification({
        memberId,
        farcasterFid,
        email,
        verificationCode: code,
        expiresAt: new Date(getCurrentUTC().getTime() + 10 * 60 * 1000), // 10 minutes from UTC now
      });

      // Send verification email
      const emailSent = await sendVerificationEmail(email, code);

      if (!emailSent) {
        const config = getEmailConfig();
        console.error('📧 Failed to send verification email:', config);
        return res.status(500).json({ 
          error: "Failed to send verification email",
          details: config.testMode 
            ? "Test mode enabled - check server logs for email content" 
            : "Email service error - check API key and configuration"
        });
      }

      const config = getEmailConfig();
      res.json({ 
        success: true, 
        message: config.testMode 
          ? "Verification code generated (test mode - check server logs)" 
          : "Verification code sent to your email"
      });
    } catch (error) {
      console.error("Request email verification error:", error);
      res.status(500).json({ error: "Failed to request email verification" });
    }
  });

  // Verify email code
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { farcasterFid, code } = req.body;

      // Get and validate verification
      const verification = await storage.getEmailVerification(
        farcasterFid,
        code,
      );
      if (!verification) {
        return res.status(400).json({ error: "Invalid verification code" });
      }

      if (verification.expiresAt < getCurrentUTC()) {
        return res.status(400).json({ error: "Verification code expired" });
      }

      // Mark email as verified
      await storage.markEmailVerifiedByFarcasterFid(farcasterFid);

      // Check if member exists, create if not
      let member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        // Get user profile from Neynar to populate username
        try {
          const userResponse = await neynar.fetchBulkUsers({
            fids: [farcasterFid],
          });
          const userProfile = userResponse.users[0];

          // Create basic member record with email_verified status
          member = await storage.createMember({
            farcasterFid,
            email: verification.email,
            status: "email_verified",
            emailVerified: true,
            passportVerified: false,
          });
        } catch (profileError) {
          console.error("Error fetching user profile:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            email: verification.email,
            status: "email_verified",
            emailVerified: true,
            passportVerified: false,
          });
        }
      } else {
        // Update existing member status
        member = await storage.updateMemberStatus(
          farcasterFid,
          "email_verified",
        );
      }

      res.json({
        success: true,
        message: "Email verified successfully",
        member,
      });
    } catch (error) {
      console.error("Verify email error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });


  // Check if user is approved member
  app.get("/api/members/check/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      let member = await storage.getMemberByFarcasterFid(farcasterFid);

      // If no member exists, create one automatically after Farcaster authentication
      if (!member) {
        try {
          // Get user profile from Neynar to populate username
          const userResponse = await neynar.fetchBulkUsers({
            fids: [farcasterFid],
          });
          const userProfile = userResponse.users[0];

          // Create basic member record with pending_signer status
          member = await storage.createMember({
            farcasterFid,
            status: "pending_signer",
            emailVerified: false,
            passportVerified: false,
          });

          console.log(`Created new member record for FID ${farcasterFid}`);
        } catch (profileError) {
          console.error("Error creating member record:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            status: "pending_signer",
            emailVerified: false,
            passportVerified: false,
          });
        }
      }

      // Check if member should be promoted from pending_signer to pending_id_verification
      if (member && member.status === "pending_signer") {
        try {
          // Check if their signer is approved
          const userSigner = await storage.getUserSigner(farcasterFid);
          if (userSigner && userSigner.status === "approved") {
            member = await storage.updateMemberStatus(farcasterFid, "pending_id_verification");
            console.log(`Auto-promoted FID ${farcasterFid} from pending_signer to pending_id_verification (signer approved)`);
          }
        } catch (signerError) {
          console.error("Error checking signer status for promotion:", signerError);
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
          member = await storage.updateMemberStatus(farcasterFid, "active_member");
          console.log(
            `Auto-promoted FID ${farcasterFid} to active_member status (both verifications complete)`,
          );
        } catch (updateError) {
          console.error("Error auto-promoting member:", updateError);
          // Continue without failing the request
        }
      }

      res.json({
        isMember: !!member,
        status: (member as any)?.status || "pending_signer",
        member: member || null,
      });
    } catch (err: any) {
      console.error("Check member error:", err);
      res
        .status(500)
        .json({ error: err.message || "Failed to check member status" });
    }
  });

  // Send email verification code
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      console.log("Email verification request body:", req.body);
      const { farcasterFid, email } = req.body;
      console.log("Extracted FID:", farcasterFid, "Email:", email);

      if (!farcasterFid || !email) {
        console.log("Missing data - FID:", !!farcasterFid, "Email:", !!email);
        return res.status(400).json({ error: "FID and email are required" });
      }

      // Get member ID from farcasterFid
      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      const code = generateVerificationCode();
      const verification = await storage.createEmailVerification({
        memberId: member.id,
        farcasterFid,
        email,
        verificationCode: code,
        expiresAt: new Date(getCurrentUTC().getTime() + 10 * 60 * 1000), // 10 minutes from UTC now
      });

      // Display verification code prominently for testing
      console.log("");
      console.log("=====================================");
      console.log(`VERIFICATION CODE FOR ${email}: ${code}`);
      console.log(`Copy this code: ${code}`);
      console.log("=====================================");
      console.log("");

      const emailSent = await sendVerificationEmail(email, code);

      if (!emailSent) {
        return res
          .status(500)
          .json({ error: "Failed to send verification email" });
      }

      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Send verification email error:", error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });

  // Confirm email verification code
  app.post("/api/auth/confirm-email", async (req, res) => {
    try {
      const { farcasterFid, code } = req.body;

      if (!farcasterFid || !code) {
        return res.status(400).json({ error: "FID and code are required" });
      }

      // Get memberId from farcasterFid  
      const memberId = await storage.getMemberIdFromFarcasterFid(farcasterFid);
      if (!memberId) {
        return res.status(404).json({ error: "Member not found" });
      }

      const verification = await storage.getEmailVerification(
        memberId,
        code,
      );

      if (!verification) {
        return res
          .status(400)
          .json({ error: "Invalid or expired verification code" });
      }

      if (verification.expiresAt < getCurrentUTC()) {
        return res.status(400).json({ error: "Verification code has expired" });
      }

      await storage.markEmailVerified(memberId);

      // Update member status - member should already exist from member check endpoint
      const member = await storage.updateMember(memberId, {
        email: verification.email,
        emailVerified: true,
        status: "email_verified",
      });

      res.json({
        success: true,
        message: "Email verified successfully",
        member,
      });
    } catch (error) {
      console.error("Confirm email verification error:", error);
      res.status(500).json({ error: "Failed to confirm email verification" });
    }
  });

  // Register new member
  app.post("/api/register", async (req, res) => {
    try {
      const registrationData = insertMemberSchema.parse(req.body);
      const member = await storage.createMember(registrationData);
      res.json({ success: true, member });
    } catch (error) {
      console.error("Register member error:", error);
      res.status(500).json({ error: "Failed to register member" });
    }
  });

  // Check Ipê passport availability
  app.get("/api/passport/check/:passport", async (req, res) => {
    try {
      const passport = req.params.passport;
      const existingMember = await storage.getMemberByIpePassport(passport);

      res.json({
        available: !existingMember,
        reason: existingMember ? "This passport is already taken" : undefined,
      });
    } catch (error) {
      console.error("Check passport availability error:", error);
      res.status(500).json({ error: "Failed to check passport availability" });
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
      console.error("Username availability check error:", error);
      res.status(500).json({ error: "Failed to check username availability" });
    }
  });

  // Send passport verification email
  app.post("/api/passport/send-verification", async (req, res) => {
    try {
      const { farcasterFid, ipePassport } = req.body;

      if (!farcasterFid || !ipePassport) {
        return res.status(400).json({ error: "FID and passport are required" });
      }

      // Get member data first
      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Generate verification token
      const verificationToken = crypto.randomUUID().replace(/-/g, "");

      // Create challenge message
      const challengeMessage = `Verify ownership of ${ipePassport}.ipecity.eth for Ipê City registration\n\nFID: ${farcasterFid}\nTimestamp: ${getCurrentUTC().toISOString()}`;

      // Store verification in database
      const verification = await storage.createPassportVerification({
        memberId: member.id,
        farcasterFid,
        ipePassport: `${ipePassport}.ipecity.eth`,
        verificationToken,
        challengeMessage,
        verified: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
      if (!member?.email) {
        return res.status(400).json({ error: "Member email not found" });
      }

      // Send verification email
      const verificationUrl = `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/verify-passport/${verificationToken}`;

      // For development, log the verification URL
      if (process.env.NODE_ENV === "development") {
        console.log("\n=== PASSPORT VERIFICATION EMAIL ===");
        console.log(`To: ${member.email}`);
        console.log(`Subject: Verify ownership of ${ipePassport}.ipecity.eth`);
        console.log(`\nVerification Link: ${verificationUrl}`);
        console.log("=====================================\n");
      }

      // TODO: Implement actual email sending when email service is configured
      // await sendPassportVerificationEmail(member.email, ipePassport, verificationUrl);

      res.json({
        success: true,
        message: "Verification email sent",
        token: verificationToken, // For development only
      });
    } catch (error) {
      console.error("Send passport verification error:", error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });

  // Get passport verification details by token
  app.get("/api/passport/verify/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const verification = await storage.getPassportVerification(token);

      if (!verification) {
        return res.status(404).json({ error: "Verification token not found" });
      }

      if (verification.expiresAt < getCurrentUTC()) {
        return res
          .status(400)
          .json({ error: "Verification token has expired" });
      }

      res.json({
        passport: verification.ipePassport,
        farcasterFid: verification.farcasterFid,
        challenge: verification.challengeMessage,
        verified: verification.verified,
      });
    } catch (error) {
      console.error("Get passport verification error:", error);
      res.status(500).json({ error: "Failed to get verification details" });
    }
  });

  // Verify passport ownership (signature-based verification)
  app.post("/api/passport/verify", async (req, res) => {
    try {
      const { farcasterFid, ensName, walletAddress, message, signature } = req.body;

      if (!farcasterFid || !ensName || !walletAddress || !message || !signature) {
        return res
          .status(400)
          .json({ error: "FID, ENS name, wallet address, message, and signature are required" });
      }

      // Verify the ENS domain is an Ipê City domain
      if (!ensName.endsWith(".ipecity.eth") && ensName !== "ipecity.eth") {
        return res.status(400).json({
          error:
            "Only Ipê City domains (ipecity.eth and *.ipecity.eth) are supported",
        });
      }

      // Enhanced secure signature verification for both EOA and smart contract wallets
      try {
        console.log("Starting secure signature verification for:", walletAddress);
        
        // Use the enhanced signature verification with proper smart contract support
        const verificationResult = await verifyWalletSignature(
          message, 
          signature, 
          walletAddress,
          {
            domain: req.get('host') || 'localhost:5000',
            requiredStatement: ensName,
            allowContentOnlyVerification: true // Allow fallback for complex smart contract wallets
          }
        );

        // Log the verification attempt for security audit
        logSignatureVerification(
          verificationResult,
          walletAddress,
          req.get('user-agent'),
          req.ip || req.connection.remoteAddress
        );

        if (!verificationResult.success) {
          console.error("Signature verification failed:", verificationResult.error);
          return res.status(400).json({ 
            error: "Signature verification failed",
            details: verificationResult.error,
            walletType: verificationResult.walletType
          });
        }

        console.log(`Signature verification successful for ${verificationResult.walletType} wallet using ${verificationResult.verificationMethod}`);
      } catch (error) {
        console.error("Message verification error:", error);
        return res.status(400).json({ error: "Message verification failed" });
      }

      // Get member and update with passport verification
      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      // Store the full ENS domain (not just the subdomain name)
      const fullEnsName = ensName; // Store complete domain like "jean.ipecity.eth" or "ipecity.eth"
      
      // Extract username from full ENS domain
      const ipeUsername = ensName === "ipecity.eth" 
        ? "admin" 
        : ensName.replace(".ipecity.eth", "");

      // Set active_member status after successful signature verification
      const updatedMember = await storage.updateMemberByFarcasterFid(farcasterFid, {
        ipePassport: fullEnsName,
        ipeUsername: ipeUsername,
        passportVerified: true,
        status: "active_member",
        walletAddress: walletAddress,
      });

      res.json({
        success: true,
        message: "Passport verified successfully - active member status granted",
        member: updatedMember,
      });
    } catch (error) {
      console.error("Verify passport error:", error);
      res.status(500).json({ error: "Failed to verify passport" });
    }
  });

  // Confirm passport verification
  app.post("/api/passport/confirm-verification", async (req, res) => {
    try {
      const { token, signature, message, address } = req.body;

      if (!token || !signature || !message || !address) {
        return res.status(400).json({
          error: "Token, signature, message, and address are required",
        });
      }

      const verification = await storage.getPassportVerification(token);

      if (!verification) {
        return res.status(404).json({ error: "Verification token not found" });
      }

      if (verification.verified) {
        return res.status(400).json({ error: "Passport already verified" });
      }

      if (verification.expiresAt < getCurrentUTC()) {
        return res
          .status(400)
          .json({ error: "Verification token has expired" });
      }

      // Mark as verified in database
      await storage.markPassportVerified(token);

      res.json({
        success: true,
        message: "Passport ownership verified successfully",
        passport: verification.ipePassport,
      });
    } catch (error) {
      console.error("Confirm passport verification error:", error);
      res
        .status(500)
        .json({ error: "Failed to confirm passport verification" });
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
      console.error("ENS lookup route error:", error);
      res.status(500).json({
        ensName: null,
        source: "justaname",
        error: "Internal server error",
      });
    }
  });

  // Update member profile
  app.patch("/api/members/:farcasterFid", 
    authenticateUser, 
    requireOwnershipByFid('farcasterFid'),
    auditLogger("UPDATE_MEMBER_PROFILE"),
    async (req: AuthenticatedRequest, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      const updateData = req.body;

      if (!farcasterFid) {
        return res
          .status(400)
          .json({ error: "Valid Farcaster FID is required" });
      }

      const member = await storage.getMemberByFarcasterFid(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      const updatedMember = await storage.updateMemberByFarcasterFid(
        farcasterFid,
        updateData,
      );

      res.json({
        success: true,
        message: "Profile updated successfully",
        member: updatedMember,
      });
    } catch (error) {
      console.error("Update member profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  /* ───────────────────────────────────────────────────────────── */
  // JustaName SDK might still call server endpoints for subdomain creation
  app.post("/api/subnames/add", async (req, res) => {
    console.log("=== JustaName SDK Server Call ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Headers:", req.headers);

    // Return error to force client-side operation
    res.status(501).json({
      error: "Server-side subdomain creation disabled",
      message: "Use client-side JustaName SDK only",
    });
  });

  return createServer(app);
}

// Generate signature for sponsored signer using developer mnemonic
async function generateSignature(
  publicKey: string,
  requestFid: number,
  isSponsored = true,
) {
  const mnemonic = await getSecureEnvironmentVariable('farcaster_developer_mnemonic', 'FARCASTER_DEVELOPER_MNEMONIC');
  if (!mnemonic) {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not available in secure storage or environment variables.");
  }

  const account = mnemonicToAccount(mnemonic);

  console.log("Developer wallet address:", account.address);

  // For sponsored signers, we need to use the FID of the requesting user (requestFid)
  // and register it under that user's account, not the developer's account
  const APP_FID = requestFid; // Use the requesting user's FID instead of developer FID
  const appAccountKey = new ViemLocalEip712Signer(account as any);

  // Generates an expiration date for the signature (24 hours from now)
  const deadline = Math.floor(Date.now() / 1000) + 86400;

  const uintAddress = hexToBytes(publicKey as `0x${string}`);

  const signature = await appAccountKey.signKeyRequest({
    requestFid: BigInt(requestFid),
    key: uintAddress,
    deadline: BigInt(deadline),
  });

  if (signature.isErr()) {
    throw new Error("Failed to generate signature");
  }

  const sigHex = bytesToHex(signature.value);

  let sponsor;

  if (isSponsored) {
    const sponsorSignature = await account.signMessage({
      message: { raw: sigHex },
    });

    sponsor = {
      signature: sponsorSignature,
      fid: APP_FID,
    };
  }

  return { deadline, signature: sigHex, sponsor };
}
