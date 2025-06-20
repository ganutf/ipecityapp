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

      // Use direct API call for reliability
      const response = await fetch('https://api.neynar.com/v2/farcaster/reaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY ?? 'NEYNAR_API_DOCS'
        },
        body: JSON.stringify({
          signer_uuid,
          reaction_type,
          target_cast_hash: target,
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (err: any) {
      console.error("Reaction error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 3️⃣  QUOTE-CAST (or any new cast)                          */
  /* --------------------------------------------------------- */
  app.post("/api/neynar/cast", async (req, res) => {
    try {
      const { signer_uuid, text = "", embeds } = req.body as CreateCastRequest;

      // Use direct API call for reliability
      const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY ?? 'NEYNAR_API_DOCS'
        },
        body: JSON.stringify({
          signer_uuid,
          text,
          embeds,
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (err: any) {
      console.error("Cast error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 4️⃣  DID THIS VIEWER QUOTE-RECAST?                         */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:hash/quotes/:viewerFid", async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;

      // Use direct API call for reliability
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/quotes?identifier=${encodeURIComponent(hash)}&type=hash&limit=150`,
        {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY ?? 'NEYNAR_API_DOCS'
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      const hasQuoted = data.casts?.some(
        (c: any) => c.author?.fid === Number(viewerFid)
      ) || false;

      res.json({ hasQuoted });
    } catch (err: any) {
      console.error("Quote-check error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  /* --------------------------------------------------------- */
  /* 5️⃣  FETCH CAST + VIEWER CONTEXT                           */
  /* --------------------------------------------------------- */
  app.get("/api/neynar/cast/:identifier/:viewerFid", async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const type = (req.query.type as string) ?? "url"; // "url" | "hash"

      console.log("NeynarClient structure:", Object.keys(neynarClient));
      console.log("Has v2?", !!neynarClient.v2);
      if (neynarClient.v2) {
        console.log("v2 keys:", Object.keys(neynarClient.v2));
      }

      // Fallback to direct API call for now
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}&viewer_fid=${viewerFid}`,
        {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY ?? 'NEYNAR_API_DOCS'
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
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
