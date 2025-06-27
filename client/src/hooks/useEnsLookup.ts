import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface EnsLookupResult {
  ensName: string | null;
  source: 'justaname' | 'onchain';
  error: string | null;
}

export function useEnsLookup(address: string | undefined) {
  const query = useQuery({
    queryKey: ['ens-lookup', address],
    queryFn: async (): Promise<EnsLookupResult> => {
      if (!address) {
        return { ensName: null, source: 'justaname', error: 'No address provided' };
      }
      
      return apiRequest(`/api/ens/lookup/${address}`, {
        method: 'GET',
      });
    },
    enabled: !!address && !!address.match(/^0x[a-fA-F0-9]{40}$/),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  return {
    ensName: query.data?.ensName || null,
    source: query.data?.source || 'justaname',
    isLoading: query.isLoading,
    error: query.error || query.data?.error || null,
    refetch: query.refetch,
  };
}