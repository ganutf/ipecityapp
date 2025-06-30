import { JustaName } from "@justaname.id/sdk";

interface CreateSubdomainParams {
  username: string;
  userWalletAddress: string;
  adminMessage: string;
  adminSignature: string;
  adminAddress: string;
}

const ENS_DOMAIN = "ipecity.eth";

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
    const justaname = JustaName.init({
      xApiKey: apiKey,
      xAddress: adminAddress,
      xMessage: adminMessage,
      xSignature: adminSignature
    });

    // @ts-ignore - SDK types may be incorrect, testing functionality  
    const result = await justaname.subnames.addSubname({
      username,
      ensDomain: ENS_DOMAIN,
      addresses: [{
        address: userWalletAddress,
        coinType: 60
      }]
    });

    const createdEns = `${username}.${ENS_DOMAIN}`;
    console.log(`✅ Subdomain created with SDK: ${createdEns}`);
    return createdEns;
  } catch (error: any) {
    console.error("❌ Failed to create subdomain with SDK:", error);
    
    // Re-throw with more specific error message
    if (error.message) {
      throw new Error(`JustaName SDK error: ${error.message}`);
    }
    throw new Error(`Failed to create subdomain: ${error}`);
  }
}

export function sanitizeUsername(username: string): string {
  // Convert to lowercase and remove invalid characters for ENS
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
    .slice(0, 20); // Ensure max length
}