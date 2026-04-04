interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
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

interface SubnameResponse {
  statusCode: number;
  result: {
    data: {
      subnames: Array<{
        id: string;
        ens: string;
        username: string;
        isClaimable: boolean;
        isClaimed: boolean;
        isReserved: boolean;
        reservedFor: string | null;
        claimTxHash: string | null;
        claimAddress: string | null;
        resolver: string | null;
        textRecords: Array<{
          key: string;
          value: string;
        }>;
        coinTypeAddresses: Array<{
          coinType: number;
          address: string;
        }>;
        contentHash: string | null;
        ensDomain: string;
        createdAt: string;
        updatedAt: string;
      }>;
    };
    error: string | null;
  };
}

export async function lookupEnsName(address: string): Promise<EnsLookupResult> {
  // Validate address format
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return {
      ensName: null,
      ensNames: [],
      source: 'justaname',
      error: 'Invalid wallet address format'
    };
  }

  try {
    // First, check specifically for ipecity.eth subdomains
    const ipecityDomains = await lookupIpecitySubdomain(address);
    if (ipecityDomains.length > 0) {
      return {
        ensName: ipecityDomains[0], // Default to first domain for backward compatibility
        ensNames: ipecityDomains,
        source: 'justaname',
        error: null
      };
    }

    // Fallback to primary ENS name lookup
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
        ensNames: [],
        source: 'justaname',
        error: data.result.error
      };
    }

    // Extract ENS name from response
    const ensName = data.result.data?.name || null;

    // Only return primary ENS if it's an ipecity domain
    if (ensName && (ensName === 'ipecity.eth' || ensName.endsWith('.ipecity.eth'))) {
      return {
        ensName,
        ensNames: [ensName],
        source: 'justaname',
        error: null
      };
    }

    // Don't return non-ipecity domains
    return {
      ensName: null,
      ensNames: [],
      source: 'justaname',
      error: null
    };

  } catch (error) {
    console.error('ENS lookup error:', error);
    return {
      ensName: null,
      ensNames: [],
      source: 'justaname',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function lookupIpecitySubdomain(address: string): Promise<string[]> {
  try {
    // Query JustAName API for all ENS domains owned by this address
    const response = await fetch(
      `https://api.justaname.id/ens/v1/subname/address?address=${address}&chainId=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ipecity subdomain lookup error: ${response.status} - ${errorText}`);
      console.error(`Request URL: ${response.url}`);
      return [];
    }

    const data: SubnameResponse = await response.json();

    if (data.result.error) {
      console.error('Ipecity subdomain lookup error:', data.result.error);
      return [];
    }

    // Filter for ipecity.eth domains only
    const ipecitySubdomains = data.result.data?.subnames?.filter(subdomain => 
      subdomain.isClaimed && 
      (subdomain.ens === 'ipecity.eth' || subdomain.ens.endsWith('.ipecity.eth'))
    ) || [];

    const ipecityDomainNames = ipecitySubdomains.map(subdomain => subdomain.ens);

    console.log('Subdomain lookup result:', {
      address,
      totalSubnames: data.result.data?.subnames?.length || 0,
      ipecitySubdomains: ipecitySubdomains.length,
      ipecityDomains: ipecityDomainNames
    });

    // Return all ipecity domains found
    return ipecityDomainNames;

  } catch (error) {
    console.error('Ipecity subdomain lookup error:', error);
    return [];
  }
}