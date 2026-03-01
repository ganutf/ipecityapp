/**
 * Query key factory for React Query.
 * Centralizes all query keys to prevent typos and simplify invalidation.
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.pulses.list(), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.pulses.all })
 */
export const queryKeys = {
  // Auth
  auth: {
    all: ['/api/v2/auth'] as const,
    me: (accessToken?: string | null, identityToken?: string | null) =>
      ['/api/v2/auth/me', accessToken, identityToken] as const,
  },

  // Members
  members: {
    all: ['/api/members'] as const,
    list: () => ['/api/members'] as const,
    check: (id?: number | string | null) => [`/api/members/check/${id}`] as const,
    community: () => ['/api/v2/community/members'] as const,
    communityDetail: (id: string) => [`/api/v2/community/members/${id}`] as const,
    wallets: (memberId?: number) => ['member-wallets', memberId] as const,
  },

  // Pulses
  pulses: {
    all: ['/api/pulses'] as const,
    list: () => ['/api/pulses'] as const,
    executions: (pulseId: number | string, viewerFid?: number) =>
      [`/api/pulse/${pulseId}/executions`, viewerFid] as const,
  },

  // Pulse types
  pulseTypes: {
    all: ['/api/pulse-types'] as const,
    list: () => ['/api/pulse-types'] as const,
  },

  // Executions
  executions: {
    all: ['/api/executions'] as const,
    details: (memberId?: number | null) => [`/api/executions/${memberId}/details`] as const,
    byMember: (memberId?: number | null) => [`/api/v2/executions/${memberId}`] as const,
  },

  // Signers
  signers: {
    all: ['/api/neynar/signer'] as const,
    byMember: (memberIdOrFid?: number | null) => [`/api/neynar/signer/${memberIdOrFid}`] as const,
  },

  // ENS
  ens: {
    lookup: (address?: string) => ['ens-lookup', address] as const,
  },

  // Passport
  passport: {
    verify: (token?: string) => ['/api/passport/verify', token] as const,
  },
} as const;
