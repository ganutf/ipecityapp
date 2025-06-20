import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

export async function registerRoutes(app: Express): Promise<Server> {
  const config = new Configuration({
    apiKey: process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS',
    baseOptions: {
      headers: {
        "x-neynar-experimental": true,
      },
    },
  });
  const neynarClient = new NeynarAPIClient(config);

  // Post a reaction (like) - use direct API call since SDK method might not exist
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
    } catch (error: any) {
      console.error('Reaction error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error'
      });
    }
  });

  // Post a cast (recast) - use direct API call since SDK method might not exist
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
          text: text || '',
          embeds
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error: any) {
      console.error('Cast error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error'
      });
    }
  });

  // Check if user has quoted a specific cast
  app.get('/api/neynar/cast/:hash/quotes/:viewerFid', async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;
      
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/quotes?identifier=${encodeURIComponent(hash)}&type=hash&limit=150`,
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
      
      // Check if viewerFid has quoted this cast
      const userQuoted = data.casts?.some((cast: any) => cast.author?.fid === parseInt(viewerFid)) || false;
      
      res.json({ hasQuoted: userQuoted });
    } catch (error: any) {
      console.error('Quote check error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error'
      });
    }
  });

  // Get cast data with viewer context
  app.get('/api/neynar/cast/:identifier/:viewerFid', async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const { type = 'url' } = req.query;
      
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(identifier)}&type=${type}&viewer_fid=${viewerFid}`,
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
    } catch (error: any) {
      console.error('Cast lookup error:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
