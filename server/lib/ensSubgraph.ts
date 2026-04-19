/**
 * ENS Subgraph client.
 *
 * The only reliable way to enumerate ENS names owned by an address is via an
 * indexer — ENS NFTs (ERC-1155 via NameWrapper) don't implement the
 * `Enumerable` extension, so there is no on-chain `tokenOfOwnerByIndex`.
 * We query the official ENS subgraph on TheGraph's decentralized network
 * and filter results to `*.ipecity.eth`.
 *
 * Degrades gracefully: if the API key is missing, the network is unreachable,
 * or the request times out, we return an empty list and log a warning. Callers
 * fall back to the "no passport detected" path rather than hanging.
 */

import logger from '../logger';

const SUBGRAPH_TIMEOUT_MS = 5000;
const IPECITY_SUFFIX = '.ipecity.eth';

const QUERY = `
  query($owner: String!) {
    wrappedDomains(
      where: { owner: $owner, name_ends_with: ".ipecity.eth" }
      first: 100
    ) {
      name
    }
  }
`.trim();

interface SubgraphResponse {
  data?: {
    wrappedDomains?: Array<{ name: string | null }>;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Returns every `*.ipecity.eth` name the given wallet currently owns according
 * to the ENS subgraph (NameWrapper-owned names). Also includes `ipecity.eth`
 * itself when the wallet owns the root.
 *
 * Never throws — returns `[]` on error.
 */
export async function fetchIpecitySubdomainsOwnedBy(address: string): Promise<string[]> {
  const apiKey = process.env.THEGRAPH_API_KEY;
  const subgraphId = process.env.THEGRAPH_ENS_SUBGRAPH_ID;

  if (!apiKey || !subgraphId) {
    logger.warn('ENS subgraph lookup skipped: THEGRAPH_API_KEY or THEGRAPH_ENS_SUBGRAPH_ID not set');
    return [];
  }

  const url = `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${subgraphId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUBGRAPH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: { owner: address.toLowerCase() },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('ENS subgraph request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const body: SubgraphResponse = await response.json();

    if (body.errors?.length) {
      logger.warn('ENS subgraph returned errors', {
        errors: body.errors.map(e => e.message),
      });
      return [];
    }

    const names = (body.data?.wrappedDomains ?? [])
      .map(d => d.name)
      .filter((n): n is string => typeof n === 'string' && n.endsWith(IPECITY_SUFFIX));

    // Sort so `ipecity.eth` root comes first, then subdomains alphabetically.
    // Stable ordering matters for the UI's default-selection behavior.
    return names.sort((a, b) => {
      if (a === 'ipecity.eth') return -1;
      if (b === 'ipecity.eth') return 1;
      return a.localeCompare(b);
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    logger.warn('ENS subgraph lookup failed', {
      address,
      reason: aborted ? `timeout after ${SUBGRAPH_TIMEOUT_MS}ms` : err instanceof Error ? err.message : String(err),
    });
    return [];
  } finally {
    clearTimeout(timer);
  }
}
