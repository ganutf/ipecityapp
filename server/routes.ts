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

  // Check if user has quoted a specific cast
  app.get('/api/neynar/cast/:hash/quotes/:viewerFid', async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;
      
      console.log(`Checking quotes for hash: ${hash}, viewerFid: ${viewerFid}`);
      
      // Try the quotes endpoint first
      let response = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/quotes?identifier=${encodeURIComponent(hash)}&type=hash&limit=50`,
        {
          headers: {
            'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
          }
        }
      );

      let data = await response.json();
      console.log(`Quotes API response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`Quotes API error:`, data);
        // Try alternative approach - check user's recent casts for this embed
        response = await fetch(
          `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${viewerFid}&limit=25`,
          {
            headers: {
              'x-api-key': process.env.NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
            }
          }
        );
        
        if (response.ok) {
          const userData = await response.json();
          const userQuoted = userData.casts?.some((cast: any) => 
            cast.embeds?.some((embed: any) => 
              embed.cast_id?.hash === hash
            )
          ) || false;
          console.log(`User ${viewerFid} has quoted (via user feed): ${userQuoted}`);
          return res.json({ hasQuoted: userQuoted });
        }
        
        return res.json({ hasQuoted: false });
      }
      
      // Check if viewerFid has quoted this cast
      const userQuoted = data.casts?.some((cast: any) => cast.author?.fid === parseInt(viewerFid)) || false;
      console.log(`User ${viewerFid} has quoted: ${userQuoted}`);
      
      res.json({ hasQuoted: userQuoted });
    } catch (error) {
      console.error('Quote check error:', error);
      res.json({ hasQuoted: false });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
