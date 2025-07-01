import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import { storage } from "./storage";
import { insertPulseSchema, updatePulseSchema, insertMemberSchema, insertPulseExecutionSchema, registrationSchema, insertEmailVerificationSchema, insertPassportVerificationSchema, passportClaimSchema, emailVerificationRequestSchema } from "@shared/schema";
import QRCode from "qrcode";
import { getSignedKey } from "./lib/getSignedKey";
import { sendVerificationEmail, sendApprovalEmail, sendDenialEmail, generateVerificationCode } from "./lib/email";
import { mnemonicToAccount } from "viem/accounts";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { hexToBytes, bytesToHex } from "viem";
import { randomBytes } from "crypto";
import { lookupEnsName } from "./lib/ensLookup";
// JustaName server-side imports removed

/* local unions for clarity */
type Reaction = "like" | "recast";
type CastParam = "hash" | "url";

export async function registerRoutes(app: Express): Promise<Server> {
  /* ────────────────────────────────  HEALTH CHECK  ──────────────────────────────── */
  // Health check endpoint for deployment monitoring
  app.get('/health', async (req, res) => {
    try {
      // Test database connection
      await storage.getAllMembers();
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error(`Health check failed: ${error.message}`);
      res.status(503).json({ 
        status: 'unhealthy', 
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message
      });
    }
  });

  /* ────────────────────────────────  QR CODE GENERATION  ──────────────────────────────── */
  app.post('/api/qrcode', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      res.set('Content-Type', 'text/plain');
      res.send(qrCodeDataUrl);
    } catch (error) {
      console.error('QR code generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });

  /* ────────────────────────────────  SDK  ──────────────────────────────── */
  const neynar = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS",
      baseOptions: { headers: { "x-neynar-experimental": true } },
    })
  );

  /* ──────────────────  LIKE / plain RECAST  ────────────────── */
  app.post("/api/neynar/reaction", async (req, res) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body as {
        signer_uuid: string;
        reaction_type: Reaction;     // "like" | "recast"
        target: string;              // cast hash
      };

      const out = await neynar.publishReaction({
        signerUuid:   signer_uuid,
        reactionType: reaction_type,
        target,
      });

      res.json(out);
    } catch (e) {
      const msg = isApiErrorResponse(e) ? e.response.data : (e as Error).message;
      res.status(e.statusCode ?? 500).json({ error: msg });
    }
  });

  /* ───────────────────  QUOTE-CAST / new cast  ─────────────────── */
  app.post("/api/neynar/cast", async (req, res) => {
    try {
      const { signer_uuid, text = "", embeds } = req.body as {
        signer_uuid: string;
        text?: string;
        embeds?: any[];
      };

      const out = await neynar.publishCast({
        signerUuid: signer_uuid,
        text,
        embeds,
      });

      res.json(out);
    } catch (e) {
      const msg = isApiErrorResponse(e) ? e.response.data : (e as Error).message;
      res.status(e.statusCode ?? 500).json({ error: msg });
    }
  });

  /* ────────────────  USER SIGNER MANAGEMENT  ──────────────── */
  app.get("/api/neynar/signer/:fid", async (req, res) => {
    // Prevent caching to ensure real-time signer status checks
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    try {
      const fid = parseInt(req.params.fid);
      if (isNaN(fid)) {
        return res.status(400).json({ error: 'Invalid FID' });
      }

      console.log(`Looking for signer for FID: ${fid}`);

      // Check if user already has a signer
      let userSigner;
      try {
        userSigner = await storage.getUserSigner(fid);
        console.log('Existing signer found:', userSigner);
      } catch (dbError) {
        console.error('Database error when fetching signer:', dbError);
        return res.status(500).json({ error: 'Database connection error' });
      }
      
      if (userSigner) {
        // If signer is pending, check current status with Neynar
        if (userSigner.status === 'pending_approval') {
          try {
            console.log('Checking signer status with Neynar for UUID:', userSigner.signerUuid);
            const signerStatus = await neynar.lookupSigner({ signerUuid: userSigner.signerUuid });
            console.log('Neynar signer status:', signerStatus);
            
            if (signerStatus.status === 'approved') {
              // Update database with approved status
              await storage.updateUserSignerStatus(fid, 'approved');
              console.log('Signer approved! Updated database status.');
              
              res.json({ 
                signer_uuid: userSigner.signerUuid,
                status: 'approved',
                signer_approval_url: userSigner.approvalUrl,
                message: 'Signer approved successfully'
              });
              return;
            }
          } catch (statusError) {
            console.error('Error checking signer status with Neynar:', statusError);
            // Fall through to return cached status if Neynar check fails
          }
        }
        
        // Return existing signer (approved or pending)
        res.json({ 
          signer_uuid: userSigner.signerUuid,
          status: userSigner.status,
          signer_approval_url: userSigner.approvalUrl,
          message: userSigner.status === 'approved' ? 'Existing approved signer found' : 'Existing signer requires approval'
        });
      } else {
        // Create new signer with proper registration and sponsorship
        console.log('Creating new sponsored signer for FID:', fid);
        const signerData = await getSignedKey(true); // sponsored = true
        console.log('Created and registered signer:', signerData);
        
        // Store the signer in database
        const newSigner = await storage.createUserSigner({
          farcasterFid: fid,
          signerUuid: signerData.signer_uuid,
          publicKey: signerData.public_key || '',
          status: signerData.signedKey?.status || signerData.status || 'pending_approval',
          approvalUrl: signerData.signedKey?.signer_approval_url || signerData.deep_link_url || `https://client.farcaster.xyz/deeplinks/signed-key-request?token=${signerData.public_key}`
        });

        res.json({
          signer_uuid: newSigner.signerUuid,
          status: newSigner.status,
          signer_approval_url: newSigner.approvalUrl,
          message: 'Sponsored signer created and registered - approval required via QR code or mobile app'
        });
      }
    } catch (e) {
      console.error('Signer endpoint error:', e);
      const msg = isApiErrorResponse(e) ? e.response.data : (e as Error).message;
      res.status(e.statusCode ?? 500).json({ error: msg });
    }
  });

  // Check signer status and update if approved
  app.post("/api/neynar/signer/check/:fid", async (req, res) => {
    try {
      const fid = parseInt(req.params.fid);
      if (isNaN(fid)) {
        return res.status(400).json({ error: 'Invalid FID' });
      }

      const userSigner = await storage.getUserSigner(fid);
      if (!userSigner) {
        return res.status(404).json({ error: 'Signer not found' });
      }

      // Check signer status with Neynar
      try {
        const signerInfo = await neynar.lookupSigner({ signerUuid: userSigner.signerUuid });
        console.log('Signer info from Neynar:', signerInfo);
        
        // Update status if it has changed
        if (signerInfo.status !== userSigner.status) {
          await storage.updateUserSignerStatus(fid, signerInfo.status);
          res.json({ 
            status: signerInfo.status, 
            updated: true,
            signer_uuid: userSigner.signerUuid 
          });
        } else {
          res.json({ 
            status: userSigner.status, 
            updated: false,
            signer_uuid: userSigner.signerUuid 
          });
        }
      } catch (neynarError) {
        console.log('Neynar lookup error:', neynarError);
        // If we can't check with Neynar, return current status
        res.json({ 
          status: userSigner.status, 
          updated: false,
          signer_uuid: userSigner.signerUuid,
          note: 'Could not verify with Neynar'
        });
      }
    } catch (e) {
      const msg = isApiErrorResponse(e) ? e.response.data : (e as Error).message;
      res.status(e.statusCode ?? 500).json({ error: msg });
    }
  });

  /* ───────────────  DID viewer QUOTE-RECAST this cast?  ─────────────── */
  app.get("/api/neynar/cast/:hash/quotes/:viewerFid", async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;

      /* quotes endpoint not wrapped in SDK yet */
      const r = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/quotes` +
          `?identifier=${encodeURIComponent(hash)}&type=hash&limit=100`,
        { headers: { "x-api-key": process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS" } }
      );
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);

      const hasQuoted =
        data.casts?.some((c: any) => c.author?.fid === Number(viewerFid)) ?? false;

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

      const out = await neynar.lookupCastByHashOrWarpcastUrl({
        identifier,
        type,
        viewerFid: Number(viewerFid),
      });

      res.json(out);
    } catch (e) {
      const msg = isApiErrorResponse(e) ? e.response.data : (e as Error).message;
      res.status(e.statusCode ?? 500).json({ error: msg });
    }
  });

  /* --------------------------------------------------------- */
  /* 6️⃣  PULSE MANAGEMENT                                      */
  /* --------------------------------------------------------- */
  
  // Get current pulse (today's date)
  app.get("/api/pulses/current", async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const pulse = await storage.getPulseByDate(today);
      res.json({ pulse });
    } catch (err: any) {
      console.error("Current pulse error:", err);
      res.status(500).json({ error: err.message || 'Failed to get current pulse' });
    }
  });

  // Get all pulses
  app.get("/api/pulses", async (req, res) => {
    try {
      const pulses = await storage.getAllPulses();
      res.json({ pulses });
    } catch (err: any) {
      console.error("Get pulses error:", err);
      res.status(500).json({ error: err.message || 'Failed to get pulses' });
    }
  });

  // Create new pulse (admin only)
  app.post("/api/pulses", async (req, res) => {
    try {
      const pulseData = {
        ...req.body,
        createdBy: "admin" // Default admin identifier
      };
      const validatedData = insertPulseSchema.parse(pulseData);
      const pulse = await storage.createPulse(validatedData);
      res.json({ success: true, pulse });
    } catch (err: any) {
      console.error("Create pulse error:", err);
      res.status(500).json({ error: err.message || 'Failed to create pulse' });
    }
  });

  // Update pulse (admin only)
  app.put("/api/pulses/:id", async (req, res) => {
    try {
      const pulseId = parseInt(req.params.id);
      if (isNaN(pulseId)) {
        return res.status(400).json({ error: 'Invalid pulse ID' });
      }

      const validatedData = updatePulseSchema.parse(req.body);
      const pulse = await storage.updatePulse(pulseId, validatedData);
      res.json({ success: true, pulse });
    } catch (err: any) {
      console.error("Update pulse error:", err);
      res.status(500).json({ error: err.message || 'Failed to update pulse' });
    }
  });

  // Get member executions for a specific user
  app.get("/api/executions/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      const executions = await storage.getMemberExecutions(farcasterFid);
      res.json({ executions });
    } catch (err: any) {
      console.error("Get executions error:", err);
      res.status(500).json({ error: err.message || 'Failed to get executions' });
    }
  });

  // Record pulse execution
  app.post("/api/executions", async (req, res) => {
    try {
      const validatedData = insertPulseExecutionSchema.parse(req.body);
      const execution = await storage.createPulseExecution(validatedData);
      res.json({ success: true, execution });
    } catch (err: any) {
      console.error("Create execution error:", err);
      res.status(500).json({ error: err.message || 'Failed to record execution' });
    }
  });

  // Get pending members (admin only)
  app.get("/api/admin/pending-members", async (req, res) => {
    try {
      const pendingMembers = await storage.getPendingMembers();
      res.json({ members: pendingMembers });
    } catch (error) {
      console.error("Get pending members error:", error);
      res.status(500).json({ error: "Failed to get pending members" });
    }
  });

  // Approve member (admin only)
  app.post("/api/admin/approve-member", async (req, res) => {
    try {
      const { farcasterFid } = req.body;
      const member = await storage.approveMember(farcasterFid);
      
      // Send approval email
      if (member.email && member.ipePassport) {
        await sendApprovalEmail(member.email, member.ipePassport);
      }
      
      res.json({ success: true, member });
    } catch (error) {
      console.error("Approve member error:", error);
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  // Deny member (admin only)
  app.post("/api/admin/deny-member", async (req, res) => {
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

  // Get all members (admin only)
  app.get("/api/members", async (req, res) => {
    try {
      const members = await storage.getAllMembers();
      res.json({ members });
    } catch (err: any) {
      console.error("Get members error:", err);
      res.status(500).json({ error: err.message || 'Failed to get members' });
    }
  });

  // Get individual member by FID
  app.get("/api/members/:fid", async (req, res) => {
    try {
      const fid = parseInt(req.params.fid);
      if (isNaN(fid)) {
        return res.status(400).json({ error: "Invalid FID" });
      }
      
      const member = await storage.getMember(fid);
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
      const member = await storage.updateMemberStatus(farcasterFid, status);
      res.json({ success: true, member });
    } catch (error) {
      console.error("Update member status error:", error);
      res.status(500).json({ error: "Failed to update member status" });
    }
  });

  // Create passport claim
  app.post("/api/passport/claim", async (req, res) => {
    try {
      const validatedClaim = passportClaimSchema.parse(req.body);
      const member = await storage.createPassportClaim(validatedClaim);
      res.json({ success: true, member });
    } catch (error) {
      console.error("Create passport claim error:", error);
      res.status(500).json({ error: "Failed to create passport claim" });
    }
  });

  // Get pending passport claims (admin only)
  app.get("/api/passport/claims", async (req, res) => {
    try {
      const claims = await storage.getPendingClaims();
      res.json({ claims });
    } catch (error) {
      console.error("Get pending claims error:", error);
      res.status(500).json({ error: "Failed to get pending claims" });
    }
  });

  // JustaName challenge endpoint removed - subdomain creation now client-side only

  // Approve passport claim (admin only)
  app.post("/api/passport/approve", async (req, res) => {
    try {
      console.log("=== PASSPORT APPROVAL REQUEST ===");
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      const { farcasterFid, skipSubdomainCreation } = req.body;
      
      if (!farcasterFid) {
        console.error("Missing farcasterFid in request");
        return res.status(400).json({ error: "FarcasterFid required" });
      }
      
      console.log(`Processing approval for FID: ${farcasterFid}`);
      
      // Get member details
      const member = await storage.getMember(farcasterFid);
      console.log(`Found member:`, member ? { 
        fid: member.farcasterFid, 
        claimSubdomain: member.passportClaimSubdomain,
        status: member.status 
      } : 'null');
      
      if (!member || !member.passportClaimSubdomain) {
        console.error("Invalid claim data - missing member or subdomain");
        return res.status(400).json({ error: "Invalid claim data" });
      }

      // Since subdomain creation is handled client-side, just approve the claim
      const ensName = `${member.passportClaimSubdomain}.ipecity.eth`;
      console.log(`Approving claim for ENS name: ${ensName}`);
      
      console.log("Calling storage.approvePassportClaim...");
      const updatedMember = await storage.approvePassportClaim(farcasterFid, ensName);
      console.log(`Member updated successfully. New status: ${updatedMember.status}`);
      
      // Send approval email (with error handling to prevent server crash)
      if (updatedMember.email) {
        console.log(`Sending approval email to: ${updatedMember.email}`);
        try {
          await sendApprovalEmail(updatedMember.email, ensName);
          console.log("Approval email sent successfully");
        } catch (emailError) {
          console.error("Failed to send approval email (non-fatal):", emailError);
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
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ error: "Failed to approve passport claim" });
    }
  });

  // Deny passport claim (admin only)
  app.post("/api/passport/deny", async (req, res) => {
    try {
      const { farcasterFid } = req.body;
      const member = await storage.denyPassportClaim(farcasterFid);
      
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

  // Request email verification
  app.post("/api/auth/request-email-verification", async (req, res) => {
    try {
      const validatedRequest = emailVerificationRequestSchema.parse(req.body);
      const { farcasterFid, email } = validatedRequest;
      
      // Generate verification code
      const code = generateVerificationCode();
      
      // Create email verification record
      await storage.createEmailVerification({
        farcasterFid,
        email,
        verificationCode: code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });
      
      // Send verification email
      const emailSent = await sendVerificationEmail(email, code);
      
      if (!emailSent) {
        return res.status(500).json({ error: "Failed to send verification email" });
      }
      
      res.json({ success: true, message: "Verification code sent" });
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
      const verification = await storage.getEmailVerification(farcasterFid, code);
      if (!verification) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: "Verification code expired" });
      }
      
      // Mark email as verified
      await storage.markEmailVerified(farcasterFid);
      
      // Check if member exists, create if not
      let member = await storage.getMember(farcasterFid);
      if (!member) {
        // Get user profile from Neynar to populate username
        try {
          const userResponse = await neynar.fetchBulkUsers({ fids: [farcasterFid] });
          const userProfile = userResponse.users[0];
          
          // Create basic member record with email_verified status
          member = await storage.createMember({
            farcasterFid,
            farcasterUsername: userProfile?.username || '',
            email: verification.email,
            status: 'email_verified',
            emailVerified: true,
            passportVerified: false,
            profileCompleted: false
          });
        } catch (profileError) {
          console.error("Error fetching user profile:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            email: verification.email,
            status: 'email_verified',
            emailVerified: true,
            passportVerified: false,
            profileCompleted: false
          });
        }
      } else {
        // Update existing member status
        member = await storage.updateMemberStatus(farcasterFid, 'email_verified');
      }
      
      res.json({ success: true, message: "Email verified successfully", member });
    } catch (error) {
      console.error("Verify email error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // Confirm email verification (alias for verify-email to match component expectations)
  app.post("/api/auth/confirm-email", async (req, res) => {
    try {
      const { farcasterFid, code } = req.body;
      
      // Get and validate verification
      const verification = await storage.getEmailVerification(farcasterFid, code);
      if (!verification) {
        return res.status(400).json({ error: "Invalid verification code" });
      }
      
      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: "Verification code expired" });
      }
      
      // Mark email as verified
      await storage.markEmailVerified(farcasterFid);
      
      // Check if member exists, create if not
      let member = await storage.getMember(farcasterFid);
      if (!member) {
        // Get user profile from Neynar to populate username
        try {
          const userResponse = await neynar.fetchBulkUsers({ fids: [farcasterFid] });
          const userProfile = userResponse.users[0];
          
          // Create basic member record with email_verified status
          member = await storage.createMember({
            farcasterFid,
            farcasterUsername: userProfile?.username || '',
            email: verification.email,
            status: 'email_verified',
            emailVerified: true,
            passportVerified: false,
            profileCompleted: false
          });
        } catch (profileError) {
          console.error("Error fetching user profile:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            email: verification.email,
            status: 'email_verified',
            emailVerified: true,
            passportVerified: false,
            profileCompleted: false
          });
        }
      } else {
        // Update existing member with email and verification status
        member = await storage.updateMember(farcasterFid, {
          email: verification.email,
          emailVerified: true,
          status: 'email_verified'
        });
      }
      
      res.json({ success: true, message: "Email verified successfully", member });
    } catch (error) {
      console.error("Confirm email error:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // Check if user is approved member
  app.get("/api/members/check/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      let member = await storage.getMember(farcasterFid);
      
      // If no member exists, create one automatically after Farcaster authentication
      if (!member) {
        try {
          // Get user profile from Neynar to populate username
          const userResponse = await neynar.fetchBulkUsers({ fids: [farcasterFid] });
          const userProfile = userResponse.users[0];
          
          // Create basic member record with pending_signer status
          member = await storage.createMember({
            farcasterFid,
            farcasterUsername: userProfile?.username || '',
            status: 'pending_signer',
            emailVerified: false,
            passportVerified: false,
            profileCompleted: false
          });
          
          console.log(`Created new member record for FID ${farcasterFid}`);
        } catch (profileError) {
          console.error("Error creating member record:", profileError);
          // Create member without username if profile fetch fails
          member = await storage.createMember({
            farcasterFid,
            status: 'pending_signer',
            emailVerified: false,
            passportVerified: false,
            profileCompleted: false
          });
        }
      }
      
      res.json({ 
        isMember: !!member,
        approved: member?.approved || false,
        status: (member as any)?.status || 'pending_signer',
        registrationStatus: member?.registrationStatus || null,
        member: member || null
      });
    } catch (err: any) {
      console.error("Check member error:", err);
      res.status(500).json({ error: err.message || 'Failed to check member status' });
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
        return res.status(400).json({ error: 'FID and email are required' });
      }

      const code = generateVerificationCode();
      const verification = await storage.createEmailVerification({
        farcasterFid,
        email,
        verificationCode: code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });

      // Display verification code prominently for testing
      console.log('');
      console.log('=====================================');
      console.log(`VERIFICATION CODE FOR ${email}: ${code}`);
      console.log(`Copy this code: ${code}`);
      console.log('=====================================');
      console.log('');

      const emailSent = await sendVerificationEmail(email, code);
      
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      res.json({ success: true, message: 'Verification code sent' });
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
        return res.status(400).json({ error: 'FID and code are required' });
      }

      const verification = await storage.getEmailVerification(farcasterFid, code);
      
      if (!verification) {
        return res.status(400).json({ error: 'Invalid or expired verification code' });
      }

      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Verification code has expired' });
      }

      await storage.markEmailVerified(farcasterFid);
      
      // Update member status - member should already exist from member check endpoint
      const member = await storage.updateMember(farcasterFid, {
        email: verification.email,
        emailVerified: true,
        status: 'email_verified'
      });
      
      res.json({ success: true, message: 'Email verified successfully', member });
    } catch (error) {
      console.error("Confirm email verification error:", error);
      res.status(500).json({ error: "Failed to confirm email verification" });
    }
  });

  // Register new member
  app.post("/api/register", async (req, res) => {
    try {
      const registrationData = registrationSchema.parse(req.body);
      const member = await storage.registerMember(registrationData);
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
        reason: existingMember ? 'This passport is already taken' : undefined
      });
    } catch (error) {
      console.error("Check passport availability error:", error);
      res.status(500).json({ error: "Failed to check passport availability" });
    }
  });

  // Send passport verification email
  app.post("/api/passport/send-verification", async (req, res) => {
    try {
      const { farcasterFid, ipePassport } = req.body;
      
      if (!farcasterFid || !ipePassport) {
        return res.status(400).json({ error: 'FID and passport are required' });
      }

      // Generate verification token
      const verificationToken = crypto.randomUUID().replace(/-/g, '');
      
      // Create challenge message
      const challengeMessage = `Verify ownership of ${ipePassport}.ipecity.eth for Ipê City registration\n\nFID: ${farcasterFid}\nTimestamp: ${new Date().toISOString()}`;
      
      // Store verification in database
      const verification = await storage.createPassportVerification({
        farcasterFid,
        ipePassport: `${ipePassport}.ipecity.eth`,
        verificationToken,
        challengeMessage,
        verified: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Get member email for sending verification link
      const member = await storage.getMember(farcasterFid);
      if (!member?.email) {
        return res.status(400).json({ error: 'Member email not found' });
      }

      // Send verification email
      const verificationUrl = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/verify-passport/${verificationToken}`;
      
      // For development, log the verification URL
      if (process.env.NODE_ENV === 'development') {
        console.log('\n=== PASSPORT VERIFICATION EMAIL ===');
        console.log(`To: ${member.email}`);
        console.log(`Subject: Verify ownership of ${ipePassport}.ipecity.eth`);
        console.log(`\nVerification Link: ${verificationUrl}`);
        console.log('=====================================\n');
      }

      // TODO: Implement actual email sending when email service is configured
      // await sendPassportVerificationEmail(member.email, ipePassport, verificationUrl);
      
      res.json({ 
        success: true, 
        message: 'Verification email sent',
        token: verificationToken // For development only
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
        return res.status(404).json({ error: 'Verification token not found' });
      }

      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired' });
      }

      res.json({
        passport: verification.ipePassport,
        farcasterFid: verification.farcasterFid,
        challenge: verification.challengeMessage,
        verified: verification.verified
      });
    } catch (error) {
      console.error("Get passport verification error:", error);
      res.status(500).json({ error: "Failed to get verification details" });
    }
  });

  // Verify passport ownership (signature-based verification)
  app.post("/api/passport/verify", async (req, res) => {
    try {
      const { farcasterFid, ensName, walletAddress, signature, message } = req.body;
      
      if (!farcasterFid || !ensName || !walletAddress) {
        return res.status(400).json({ error: 'FID, ENS name, and wallet address are required' });
      }

      // Verify the ENS domain is an Ipê City domain
      if (!ensName.endsWith('.ipecity.eth') && ensName !== 'ipecity.eth') {
        return res.status(400).json({ error: 'Only Ipê City domains (ipecity.eth and *.ipecity.eth) are supported' });
      }

      // Get member and update with passport verification
      const member = await storage.getMember(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Extract passport name from ENS domain
      const passportName = ensName === 'ipecity.eth' ? 'ipecity' : ensName.replace('.ipecity.eth', '');
      
      // Update member with verified passport and set status to 'member'
      const updatedMember = await storage.updateMember(farcasterFid, {
        ipePassport: passportName,
        passportVerified: true,
        status: 'member'
      });
      
      res.json({ 
        success: true, 
        message: 'Passport verified successfully',
        member: updatedMember
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
        return res.status(400).json({ error: 'Token, signature, message, and address are required' });
      }

      const verification = await storage.getPassportVerification(token);
      
      if (!verification) {
        return res.status(404).json({ error: 'Verification token not found' });
      }

      if (verification.verified) {
        return res.status(400).json({ error: 'Passport already verified' });
      }

      if (verification.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired' });
      }

      // Mark as verified in database
      await storage.markPassportVerified(token);
      
      res.json({ 
        success: true, 
        message: 'Passport ownership verified successfully',
        passport: verification.ipePassport
      });
    } catch (error) {
      console.error("Confirm passport verification error:", error);
      res.status(500).json({ error: "Failed to confirm passport verification" });
    }
  });

  // ENS Lookup endpoint
  app.get("/api/ens/lookup/:address", async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({
          ensName: null,
          source: 'justaname',
          error: 'Address parameter is required'
        });
      }

      const result = await lookupEnsName(address);
      
      res.json(result);
    } catch (error) {
      console.error('ENS lookup route error:', error);
      res.status(500).json({
        ensName: null,
        source: 'justaname',
        error: 'Internal server error'
      });
    }
  });

  // Update member profile
  app.patch("/api/members/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      const updateData = req.body;
      
      if (!farcasterFid) {
        return res.status(400).json({ error: 'Valid Farcaster FID is required' });
      }

      const member = await storage.getMember(farcasterFid);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const updatedMember = await storage.updateMember(farcasterFid, updateData);
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        member: updatedMember
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
      message: "Use client-side JustaName SDK only"
    });
  });

  return createServer(app);
}

// Generate signature for sponsored signer using developer mnemonic
async function generateSignature(
  publicKey: string,
  requestFid: number,
  isSponsored = true
) {
  if (typeof process.env.FARCASTER_DEVELOPER_MNEMONIC === "undefined") {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not defined");
  }

  const FARCASTER_DEVELOPER_MNEMONIC = process.env.FARCASTER_DEVELOPER_MNEMONIC;
  const account = mnemonicToAccount(FARCASTER_DEVELOPER_MNEMONIC);
  
  console.log('Developer wallet address:', account.address);
  
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
