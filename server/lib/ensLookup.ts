interface EnsLookupResult {
  ensName: string | null;
  source: 'justaname' | 'onchain';
  error: string | null;
}

interface JustANameResponse {
  statusCode: number;
  result: {
    data: {
      name: string;
      address: string;
      nameHash: string;
      chainId: number;
    } | null;
    error: string | null;
  };
}

export async function lookupEnsName(address: string): Promise<EnsLookupResult> {
  // Validate address format
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      ensName: null,
      source: 'justaname',
      error: 'Invalid wallet address format'
    };
  }

  try {
    // Call JustAName API
    const response = await fetch(
      `https://api.justaname.id/ens/v1/primary-name/address?address=${address}&chainId=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`JustAName API error: ${response.status}`);
    }

    const data: JustANameResponse = await response.json();

    // Check if API returned an error
    if (data.result.error) {
      return {
        ensName: null,
        source: 'justaname',
        error: data.result.error
      };
    }

    // Extract ENS name from response
    const ensName = data.result.data?.name || null;

    return {
      ensName,
      source: 'justaname',
      error: null
    };

  } catch (error) {
    console.error('ENS lookup error:', error);
    return {
      ensName: null,
      source: 'justaname',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}