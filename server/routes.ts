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

  // Post a reaction (like)
  app.post('/api/neynar/reaction', async (req, res) => {
    try {
      const { signer_uuid, reaction_type, target } = req.body;
      
      const result = await neynarClient.publishReaction({
        signerUuid: signer_uuid,
        reaction: reaction_type,
        target: target
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Reaction error:', error);
      res.status(error.status || 500).json({ 
        error: error.message || 'Internal server error',
        details: error.details || null
      });
    }
  });

  // Post a cast (recast)
  app.post('/api/neynar/cast', async (req, res) => {
    try {
      const { signer_uuid, text, embeds } = req.body;
      
      const result = await neynarClient.publishCast({
        signerUuid: signer_uuid,
        text: text || '',
        embeds: embeds
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Cast error:', error);
      res.status(error.status || 500).json({ 
        error: error.message || 'Internal server error',
        details: error.details || null
      });
    }
  });

  // Check if user has quoted a specific cast
  app.get('/api/neynar/cast/:hash/quotes/:viewerFid', async (req, res) => {
    try {
      const { hash, viewerFid } = req.params;
      
      const quotes = await neynarClient.fetchQuotesForCast({
        identifier: hash,
        type: 'hash',
        limit: 150
      });
      
      // Check if viewerFid has quoted this cast
      const userQuoted = quotes.casts?.some((cast: any) => cast.author?.fid === parseInt(viewerFid)) || false;
      
      res.json({ hasQuoted: userQuoted });
    } catch (error: any) {
      console.error('Quote check error:', error);
      res.status(error.status || 500).json({ 
        error: error.message || 'Internal server error',
        details: error.details || null
      });
    }
  });

  // Get cast data with viewer context
  app.get('/api/neynar/cast/:identifier/:viewerFid', async (req, res) => {
    try {
      const { identifier, viewerFid } = req.params;
      const { type = 'url' } = req.query;
      
      const cast = await neynarClient.lookUpCastByHashOrWarpcastUrl({
        identifier,
        type: type as 'hash' | 'url',
        viewerFid: parseInt(viewerFid)
      });
      
      res.json(cast);
    } catch (error: any) {
      console.error('Cast lookup error:', error);
      res.status(error.status || 500).json({ 
        error: error.message || 'Internal server error',
        details: error.details || null
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
