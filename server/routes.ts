import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Neynar API proxy endpoints for authenticated operations
  app.post('/api/neynar/reaction', async (req, res) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body;
      
      const response = await fetch('https://api.neynar.com/v2/farcaster/reaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
        },
        body: JSON.stringify({
          signer_uuid,
          reaction_type,
          target
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/neynar/cast', async (req, res) => {
    try {
      const { signer_uuid, text, embeds } = req.body;
      
      const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
        },
        body: JSON.stringify({
          signer_uuid,
          text,
          embeds
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/neynar/cast-lookup', async (req, res) => {
    try {
      const { identifier, type, viewer_fid } = req.body;
      
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}&viewer_fid=${viewer_fid}`,
        {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
