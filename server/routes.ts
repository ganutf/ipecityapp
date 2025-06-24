import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import { storage } from "./storage";
import { insertPulseSchema, updatePulseSchema, insertMemberSchema, insertPulseExecutionSchema } from "@shared/schema";
import QRCode from "qrcode";
import { ViemLocalEip712Signer } from "@farcaster/hub-nodejs";
import { bytesToHex, hexToBytes } from "viem";
import { mnemonicToAccount } from "viem/accounts";

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
      
      if (userSigner && userSigner.status === 'approved') {
        // Return existing approved signer
        res.json({ 
          signer_uuid: userSigner.signerUuid,
          status: userSigner.status,
          message: 'Existing sponsored signer found'
        });
      } else {
        // Delete any existing non-approved signers and create new one
        if (userSigner) {
          await storage.getUserSigner(fid); // This will be replaced below
        }
        // Create new sponsored signer
        console.log('Creating new sponsored signer for FID:', fid);
        const createResponse = await neynar.createSigner();
        console.log('Created signer:', createResponse);
        
        // Generate signature using developer mnemonic
        const { deadline, signature, sponsor } = await generateSignature(
          createResponse.public_key,
          fid,
          true // is_sponsored = true
        );

        // Register the sponsored signer using the developer managed signer method
        const registeredSigner = await neynar.registerSignedKeyForDeveloperManagedSigner({
          signerUuid: createResponse.signer_uuid,
          signature,
          deadline,
          sponsorship: sponsor
        });

        console.log('Registered sponsored signer:', registeredSigner);
        
        // Use the actual status from Neynar response instead of assuming 'approved'
        const actualStatus = registeredSigner.status || 'pending_approval';
        console.log('Actual signer status from Neynar:', actualStatus);
        
        // Store the signer in database with actual status from Neynar
        const newSigner = await storage.createUserSigner({
          farcasterFid: fid,
          signerUuid: createResponse.signer_uuid,
          publicKey: createResponse.public_key || '',
          status: actualStatus,
          approvalUrl: actualStatus === 'approved' ? null : registeredSigner.signer_approval_url
        });

        res.json({
          signer_uuid: newSigner.signerUuid,
          status: newSigner.status,
          signer_approval_url: newSigner.approvalUrl,
          message: actualStatus === 'approved' ? 'Sponsored signer automatically approved' : 'Signer created but requires approval'
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
        const signerInfo = await neynar.lookupSigner(userSigner.signerUuid);
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

  // Import members via CSV (admin only)
  app.post("/api/members/import", async (req, res) => {
    try {
      const { members } = req.body;
      
      if (!Array.isArray(members)) {
        return res.status(400).json({ error: 'Members must be an array' });
      }
      
      if (members.length === 0) {
        return res.status(400).json({ error: 'No members provided for import' });
      }
      
      const validatedMembers = members.map(member => insertMemberSchema.parse(member));
      const createdMembers = await storage.createMembersBatch(validatedMembers);
      res.json({ success: true, members: createdMembers });
    } catch (err: any) {
      console.error("Import members error:", err);
      res.status(500).json({ error: err.message || 'Failed to import members' });
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

  // Check if user is approved member
  app.get("/api/members/check/:farcasterFid", async (req, res) => {
    try {
      const farcasterFid = parseInt(req.params.farcasterFid);
      const member = await storage.getMember(farcasterFid);
      res.json({ 
        isMember: !!member,
        approved: member?.approved || false,
        member: member || null
      });
    } catch (err: any) {
      console.error("Check member error:", err);
      res.status(500).json({ error: err.message || 'Failed to check member status' });
    }
  });

  /* ───────────────────────────────────────────────────────────── */
  return createServer(app);
}

// Generate signature for sponsored signer using developer mnemonic
async function generateSignature(
  publicKey: string,
  requestFid: number,
  isSponsored = false
) {
  if (typeof process.env.FARCASTER_DEVELOPER_MNEMONIC === "undefined") {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not defined");
  }

  const FARCASTER_DEVELOPER_MNEMONIC = process.env.FARCASTER_DEVELOPER_MNEMONIC;
  const APP_FID = 2790; // Your app's FID

  const account = mnemonicToAccount(FARCASTER_DEVELOPER_MNEMONIC);
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
