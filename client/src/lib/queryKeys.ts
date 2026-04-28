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
    all: ['/api/v2/admin/members'] as const,
    list: () => ['/api/v2/admin/members'] as const,
    community: () => ['/api/v2/community/members'] as const,
    communityDetail: (id: string) => [`/api/v2/community/members/${id}`] as const,
    wallets: (memberId?: number) => ['member-wallets', memberId] as const,
  },

  // Pulses
  pulses: {
    all: ['/api/v2/pulses'] as const,
    list: () => ['/api/v2/pulses'] as const,
    executions: (pulseId: number | string) =>
      [`/api/v2/pulses/${pulseId}/executions`] as const,
  },

  // Pulse types
  pulseTypes: {
    all: ['/api/v2/pulse-types'] as const,
    list: () => ['/api/v2/pulse-types'] as const,
  },

  // Executions
  executions: {
    all: ['/api/v2/executions'] as const,
    details: (memberId?: number | null) => [`/api/v2/executions/${memberId}/details`] as const,
    byMember: (memberId?: number | null) => [`/api/v2/executions/${memberId}`] as const,
  },

  // Signers
  signers: {
    all: ['/api/v2/farcaster/signer'] as const,
    byMember: (memberId?: number | null) => ['/api/v2/farcaster/signer', memberId] as const,
  },

  // ENS
  ens: {
    lookup: (address?: string) => ['ens-lookup', address] as const,
  },

  // Passport
  passport: {
    verify: (token?: string) => ['/api/passport/verify', token] as const,
    availability: (username?: string) => ['/api/v2/passport/availability', username] as const,
  },

  // Projects
  projects: {
    all: ['/api/v2/projects'] as const,
    list: () => ['/api/v2/projects'] as const,
    detail: (id: number | string) => [`/api/v2/projects/${id}`] as const,
    byMember: (memberId: number | string) => [`/api/v2/projects/by-member/${memberId}`] as const,
  },
} as const;
