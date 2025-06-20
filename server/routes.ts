import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  NeynarAPIClient,
  Configuration,
  // the following types are optional but handy in TS
  ReactionType,
  CreateCastRequest,
} from "@neynar/nodejs-sdk";

export async function registerRoutes(app: Express): Promise<Server> {
  /* 1️⃣  Boot the SDK once */
  const neynarClient = new NeynarAPIClient(
    new Configuration({
      apiKey: process.env.NEYNAR_API_KEY ?? "NEYNAR_API_DOCS",
      baseOptions: { headers: { "x-neynar-experimental": true } },
    })
  );

  /* --------------------------------------------------------- */
  /* 2️⃣  LIKE / PLAIN-RECAST  (ReactionAdd)                    */
  /* --------------------------------------------------------- */
  app.post("/api/neynar/reaction", async (req, res) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body as {
        signer_uuid: string;
        reaction_type: ReactionType; // "LIKE" | "RECAST"
        target: string;              // cast hash
      };

      const result = await neynarClient.v2.farcaster.reaction.add({
        signer_uuid,
        reaction_type,
        target_cast_hash: target,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Reaction error:", err);
      res
        .status(err.statusCode ?? 500)
        .json({ error: err.response?.data?.message ?? err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 3️⃣  QUOTE-CAST (or any new cast)                          */
  /* --------------------------------------------------------- */
  app.post("/api/neynar/cast", async (req, res) => {
    try {
      const { signer_uuid, text = "", embeds } = req.body as CreateCastRequest;

      const result = await neynarClient.v2.farcaster.cast.create({
        signer_uuid,
        text,
        embeds,
      });

      res.json(result);
    } catch (err: any) {
      console.error("Cast error:", err);
      res
        .status(err.statusCode ?? 500)
        .json({ error: err.response?.data?.message ?? err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 4️⃣  DID THIS VIEWER QUOTE-RECAST?                         */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:hash/quotes/:viewerFid", async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;

      const { casts } = await neynarClient.v2.farcaster.cast.getQuotes({
        identifier: hash,
        type: "hash",
        limit: 150,
      });

      const hasQuoted = casts.some(
        (c: any) => c.author?.fid === Number(viewerFid)
      );

      res.json({ hasQuoted });
    } catch (err: any) {
      console.error("Quote-check error:", err);
      res
        .status(err.statusCode ?? 500)
        .json({ error: err.response?.data?.message ?? err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 5️⃣  FETCH CAST + VIEWER CONTEXT                           */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:identifier/:viewerFid", async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const type = (req.query.type as string) ?? "url"; // "url" | "hash"

      const result = await neynarClient.v2.farcaster.cast.byIdentifier({
        identifier,
        type,
        viewer_fid: Number(viewerFid),
      });

      res.json(result);
    } catch (err: any) {
      console.error("Cast lookup error:", err);
      res
        .status(err.statusCode ?? 500)
        .json({ error: err.response?.data?.message ?? err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 6️⃣  Export HTTP server                                    */
  /* --------------------------------------------------------- */
  return createServer(app);
}
