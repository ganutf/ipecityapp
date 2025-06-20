import type { Express } from "express";
import { createServer, type Server } from "http";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export async function registerRoutes(app: Express): Promise<Server> {
  /* 1️⃣  Boot the SDK v2 with Configuration */
  const config = new Configuration({
    apiKey: process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS",
    baseOptions: {
      headers: {
        "x-neynar-experimental": true,
      },
    },
  });
  const neynarClient = new NeynarAPIClient(config);

  /* --------------------------------------------------------- */
  /* 2️⃣  LIKE / PLAIN-RECAST  (ReactionAdd)                    */
  /* --------------------------------------------------------- */
  app.post("/api/neynar/reaction", async (req, res) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body;

      const result = await neynarClient.publishReactionToCast(
        signer_uuid,
        reaction_type, // "like" | "recast"
        target
      );

      res.json(result);
    } catch (err: any) {
      console.error("Reaction error:", err);
      res.status(err.status || 500).json({ 
        error: err.message || 'Failed to publish reaction'
      });
    }
  });

  /* --------------------------------------------------------- */
  /* 3️⃣  QUOTE-CAST (or any new cast)                          */
  /* --------------------------------------------------------- */
  app.post("/api/neynar/cast", async (req, res) => {
    try {
      const { signer_uuid, text = "", embeds } = req.body;

      const result = await neynarClient.publishCast(
        signer_uuid,
        text,
        { embeds }
      );

      res.json(result);
    } catch (err: any) {
      console.error("Cast error:", err);
      res.status(err.status || 500).json({ 
        error: err.message || 'Failed to publish cast'
      });
    }
  });

  /* --------------------------------------------------------- */
  /* 4️⃣  DID THIS VIEWER QUOTE-RECAST?                         */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:hash/quotes/:viewerFid", async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;

      const result = await neynarClient.fetchQuotesForCast(hash, {
        limit: 150
      });

      const hasQuoted = result.casts?.some(
        (c: any) => c.author?.fid === Number(viewerFid)
      ) || false;

      res.json({ hasQuoted });
    } catch (err: any) {
      console.error("Quote-check error:", err);
      res.status(err.status || 500).json({ 
        error: err.message || 'Failed to check quotes'
      });
    }
  });

  /* --------------------------------------------------------- */
  /* 5️⃣  FETCH CAST + VIEWER CONTEXT                           */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:identifier/:viewerFid", async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const type = (req.query.type as string) ?? "url"; // "url" | "hash"

      const result = await neynarClient.lookUpCastByHashOrWarpcastUrl(
        identifier,
        type as "hash" | "url",
        { viewerFid: Number(viewerFid) }
      );

      res.json(result);
    } catch (err: any) {
      console.error("Cast lookup error:", err);
      res.status(err.status || 500).json({ 
        error: err.message || 'Failed to fetch cast'
      });
    }
  });

  /* --------------------------------------------------------- */
  /* 6️⃣  Export HTTP server                                    */
  /* --------------------------------------------------------- */
  return createServer(app);
}
