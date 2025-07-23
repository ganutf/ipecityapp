import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { getSecureEnvironmentVariable } from "./keyManagement";

// Initialize with placeholder - will be updated when first used
let neynarClient: NeynarAPIClient;

// Initialize client with proper API key
async function initializeNeynarClient() {
  if (!neynarClient) {
    const apiKey = await getSecureEnvironmentVariable('neynar_api_key', 'NEYNAR_API_KEY');
    if (!apiKey || apiKey === "NEYNAR_API_DOCS") {
      throw new Error("NEYNAR_API_KEY is not properly configured in environment variables or secure storage");
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
    return client.createSigner(...args);
  },
  async registerSignedKey(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.registerSignedKey(...args);
  },
  async lookupSigner(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.lookupSigner(...args);
  },
  async fetchBulkUsers(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.fetchBulkUsers(...args);
  },
  async lookupUserByCustodyAddress(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.lookupUserByCustodyAddress(...args);
  },
  async lookupCastByHashOrWarpcastUrl(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.lookupCastByHashOrWarpcastUrl(...args);
  },
  async publishReaction(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.publishReaction(...args);
  },
  async publishCast(...args: any[]) {
    const client = await initializeNeynarClient();
    return client.publishCast(...args);
  }
};