import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

// Initialize with placeholder - will be updated when first used
let neynarClient: NeynarAPIClient;

// Initialize client with proper API key
async function initializeNeynarClient() {
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

    console.log("Neynar client initialized with API key:", apiKey.substring(0, 8) + "...");
  }
  return neynarClient;
}

export { initializeNeynarClient };

// Legacy export - will initialize if needed
export const neynar = {
  async createSigner(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.createSigner as any)(...args);
  },
  async registerSignedKey(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.registerSignedKey as any)(...args);
  },
  async lookupSigner(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.lookupSigner as any)(...args);
  },
  async fetchBulkUsers(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.fetchBulkUsers as any)(...args);
  },
  async lookupUserByCustodyAddress(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.lookupUserByCustodyAddress as any)(...args);
  },
  async lookupCastByHashOrWarpcastUrl(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.lookupCastByHashOrWarpcastUrl as any)(...args);
  },
  async publishReaction(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.publishReaction as any)(...args);
  },
  async publishCast(...args: any[]) {
    const client = await initializeNeynarClient();
    return (client.publishCast as any)(...args);
  }
};