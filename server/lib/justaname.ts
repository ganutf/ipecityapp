import { JustaName } from "@justaname.id/sdk";

interface CreateSubdomainParams {
  username: string;
  userWalletAddress: string;
  adminMessage: string;
  adminSignature: string;
  adminAddress: string;
}

const ENS_DOMAIN = "ipecity.eth";
const CHAIN_ID = 1; // Mainnet

export async function createSubdomain({
  username,
  userWalletAddress,
  adminMessage,
  adminSignature,
  adminAddress
}: CreateSubdomainParams): Promise<string> {
  const apiKey = process.env.JUSTANAME_API_KEY;
  if (!apiKey) {
    throw new Error("JUSTANAME_API_KEY environment variable is required");
  }

  try {
    // Initialize the SDK with proper configuration
    const jan = JustaName.init({
      ensDomains: [
        {
          domain: ENS_DOMAIN,
          chainId: CHAIN_ID,
          apiKey,
        },
      ],
      networks: [{ chainId: CHAIN_ID }],
      config: { domain: 'localhost', origin: 'http://localhost:5000' },
    });

    // Create subdomain with proper parameter structure
    await jan.subnames.addSubname(
      {
        username,
        ensDomain: ENS_DOMAIN,
        chainId: CHAIN_ID,
        addresses: [{ address: userWalletAddress, coinType: 60 }],
      },
      {
        xApiKey: apiKey,
        xAddress: adminAddress,
        xMessage: adminMessage,
        xSignature: adminSignature,
      }
    );

    const createdEns = `${username}.${ENS_DOMAIN}`;
    console.log(`✅ Subdomain created with SDK: ${createdEns}`);
    return createdEns;
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("❌ Failed to create subdomain with SDK:", msg);
    throw new Error(`JustaName SDK error: ${msg}`);
  }
}

export function sanitizeUsername(username: string): string {
  // Convert to lowercase and remove invalid characters for ENS
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
    .slice(0, 20); // Ensure max length
}

/**
 * Request a challenge from JustaName for SIWE signing
 */
export async function requestJustaNameChallenge(adminAddress: string): Promise<string> {
  const apiKey = process.env.JUSTANAME_API_KEY;
  if (!apiKey) {
    throw new Error("JUSTANAME_API_KEY environment variable is required");
  }

  try {
    // Get or create JustaName instance
    const jan = JustaName.init({
      ensDomains: [
        {
          domain: ENS_DOMAIN,
          chainId: CHAIN_ID,
          apiKey,
        },
      ],
      networks: [{ chainId: CHAIN_ID }],
      config: { domain: 'localhost', origin: 'http://localhost:5000' },
    });

    // Request challenge from JustaName
    const { challenge } = await jan.siwe.requestChallenge({
      address: adminAddress,
      chainId: CHAIN_ID,
      domain: 'justaname.id',
      origin: 'https://justaname.id',
    });

    console.log(`✅ JustaName challenge requested for address: ${adminAddress}`);
    return challenge;
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("❌ Failed to request JustaName challenge:", msg);
    throw new Error(`JustaName challenge error: ${msg}`);
  }
}