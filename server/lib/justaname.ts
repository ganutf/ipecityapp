import axios from "axios";
import { ethers } from "ethers";

interface CreateSubdomainParams {
  username: string;
  userWalletAddress: string;
  adminMessage: string;
  adminSignature: string;
  adminAddress: string;
}

interface JustaNameResponse {
  result: {
    data: {
      ens: string;
    };
  };
}

const API_BASE_URL = "https://api.justaname.id";
const ENS_DOMAIN = "ipecity.eth";
const CHAIN_ID = 1; // Mainnet

// New function to get challenge from JustaName
export async function getJustaNameChallenge(adminAddress: string): Promise<string> {
  try {
    console.log('🔄 Requesting challenge from JustaName for:', adminAddress);
    
    const response = await axios.post(`${API_BASE_URL}/ens/v1/siwe/request-challenge`, {
      domain: 'justaname.id',
      origin: 'https://justaname.id',
      address: adminAddress,
      chainId: CHAIN_ID,
    });

    console.log('📋 JustaName response status:', response.status);
    console.log('📋 JustaName response data:', JSON.stringify(response.data, null, 2));

    const challenge = response.data.result.data.challenge;
    console.log('✅ Extracted challenge:', challenge);
    
    return challenge;
  } catch (error: any) {
    console.error("❌ Failed to get JustaName challenge:");
    console.error("Response status:", error.response?.status);
    console.error("Response data:", error.response?.data);
    console.error("Error message:", error.message);
    
    throw new Error(`JustaName challenge error: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

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

  const payload = {
    username,
    ensDomain: ENS_DOMAIN,
    chainId: CHAIN_ID,
    addresses: [
      {
        address: userWalletAddress, // Points to user's wallet
        coinType: 60 // SLIP-44 for Ethereum
      }
    ]
  };

  const headers = {
    "x-api-key": apiKey,
    "x-signature": adminSignature,
    "x-message": Buffer.from(adminMessage, "utf8").toString("base64"),
    "x-address": adminAddress,
    "Content-Type": "application/json"
  };

  console.log('🔄 Creating subdomain for:', username);

  try {
    const { data } = await axios.post<JustaNameResponse>(
      `${API_BASE_URL}/ens/v1/subname/add`,
      payload,
      { headers }
    );

    const createdEns = data.result.data.ens;
    console.log(`✅ Subdomain created: ${createdEns}`);
    return createdEns;

  } catch (error: any) {
    console.error("❌ Failed to create subdomain:", error.response?.data || error.message);
    
    // Re-throw with more specific error message
    if (error.response?.data) {
      throw new Error(`JustaName API error: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to create subdomain: ${error.message}`);
  }
}

export function sanitizeUsername(username: string): string {
  // Convert to lowercase and remove invalid characters for ENS
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Keep only letters and numbers
    .slice(0, 20); // Ensure max length
}