import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  NeynarAPIClient,
  Configuration,
  isApiErrorResponse,
} from "@neynar/nodejs-sdk";
import { storage } from "./storage";
import { insertPulseSchema, updatePulseSchema, insertMemberSchema, insertPulseExecutionSchema } from "@shared/schema";

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

      console.log(`Publishing ${reaction_type} reaction with signer: ${signer_uuid}, target: ${target}`);

      const out = await neynar.publishReaction({
        signerUuid: signer_uuid,
        reactionType: reaction_type,
        target,
      });

      console.log(`${reaction_type} reaction successful:`, out);
      res.json(out);
    } catch (e: any) {
      console.error(`Error publishing ${req.body.reaction_type} reaction:`, e);
      const msg = isApiErrorResponse(e) ? e.response.data : e.message;
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
      
      // Check if user has existing signer
      let userSigner = await storage.getUserSigner(fid);
      
      if (!userSigner) {
        // Auto-create signer for new users
        try {
          const createSignerResponse = await fetch('https://api.neynar.com/v2/farcaster/signer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
            },
            body: JSON.stringify({})
          });
          
          if (!createSignerResponse.ok) {
            throw new Error('Failed to create signer');
          }
          
          const signerData = await createSignerResponse.json();
          
          // Store the new signer
          userSigner = await storage.createUserSigner({
            farcasterFid: fid,
            signerUuid: signerData.signer_uuid
          });
          
          console.log(`Created new signer for FID ${fid}: ${signerData.signer_uuid}`);
        } catch (error) {
          console.error('Failed to create signer:', error);
          return res.status(500).json({ 
            error: 'Failed to create signer. Please try again later.' 
          });
        }
      }
      
      res.json({ signer_uuid: userSigner.signerUuid });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
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
      const validatedData = insertPulseSchema.parse(req.body);
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
