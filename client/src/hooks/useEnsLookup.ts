import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EnsLookupResult {
  ensName: string | null;
  ensNames: string[];
  source: 'database' | 'subgraph' | null;
  error: string | null;
}

export function useEnsLookup(address: string | undefined) {
  const query = useQuery({
    queryKey: ['ens-lookup', address],
    queryFn: async (): Promise<EnsLookupResult> => {
      if (!address) {
        return { ensName: null, ensNames: [], source: null, error: 'No address provided' };
      }

      return apiRequest(`/api/v2/passport/ens/lookup/${address}`, {
        method: 'GET',
      });
    },
    enabled: Boolean(address && address.match(/^0x[a-fA-F0-9]{40}$/)),
    staleTime: 5 * 60 * 1000, // 5 minutes
    // No retry: server bounds the RPC at 3s; retrying just multiplies the wait
    // for wallets that genuinely have no ENS name.
    retry: 0,
  });

  return {
    ensName: query.data?.ensName || null,
    ensNames: query.data?.ensNames || [],
    source: query.data?.source || null,
    isLoading: query.isLoading,
    error: query.error || query.data?.error || null,
    refetch: query.refetch,
  };
}
