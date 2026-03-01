import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import logger from "../logger";

let neynarClient: NeynarAPIClient | null = null;

/**
 * Initialize and return the Neynar API client (lazy singleton).
 * Throws if NEYNAR_API_KEY is not set.
 */
export async function initializeNeynarClient(): Promise<NeynarAPIClient> {
  if (!neynarClient) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey || apiKey === "NEYNAR_API_DOCS") {
      throw new Error("NEYNAR_API_KEY must be set in environment variables");
    }

    neynarClient = new NeynarAPIClient(
      new Configuration({
        apiKey,
        baseOptions: { headers: { "x-neynar-experimental": true } },
      })
    );

    logger.info("Neynar client initialized");
  }
  return neynarClient;
}

/**
 * Get the initialized Neynar client.
 * Each method lazily initializes the client on first use and delegates
 * directly to the SDK — no `as any` casts needed.
 */
export const neynar = {
  async createSigner() {
    const client = await initializeNeynarClient();
    return client.createSigner();
  },

  async registerSignedKey(...args: Parameters<NeynarAPIClient["registerSignedKey"]>) {
    const client = await initializeNeynarClient();
    return client.registerSignedKey(...args);
  },

  async lookupSigner(...args: Parameters<NeynarAPIClient["lookupSigner"]>) {
    const client = await initializeNeynarClient();
    return client.lookupSigner(...args);
  },

  async fetchBulkUsers(...args: Parameters<NeynarAPIClient["fetchBulkUsers"]>) {
    const client = await initializeNeynarClient();
    return client.fetchBulkUsers(...args);
  },

  async lookupUserByCustodyAddress(...args: Parameters<NeynarAPIClient["lookupUserByCustodyAddress"]>) {
    const client = await initializeNeynarClient();
    return client.lookupUserByCustodyAddress(...args);
  },

  async lookupCastByHashOrWarpcastUrl(...args: Parameters<NeynarAPIClient["lookupCastByHashOrWarpcastUrl"]>) {
    const client = await initializeNeynarClient();
    return client.lookupCastByHashOrWarpcastUrl(...args);
  },

  async publishReaction(...args: Parameters<NeynarAPIClient["publishReaction"]>) {
    const client = await initializeNeynarClient();
    return client.publishReaction(...args);
  },

  async publishCast(...args: Parameters<NeynarAPIClient["publishCast"]>) {
    const client = await initializeNeynarClient();
    return client.publishCast(...args);
  },
};
