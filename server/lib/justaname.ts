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

const JUSTANAME_API_URL = "https://api.justaname.id/ens/v1/subname/add";
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
    "x-message": adminMessage,
    "x-address": adminAddress,
    "Content-Type": "application/json"
  };

  try {
    const { data } = await axios.post<JustaNameResponse>(
      JUSTANAME_API_URL,
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