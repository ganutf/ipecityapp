/**
 * Shared API response types used by both client and server.
 * These extend the Drizzle schema types with computed fields.
 */
import type { Member, Pulse, PulseType, PulseExecution, Attestation, MemberWallet } from './schema';

// Member with computed/aggregated fields added by API endpoints
export interface MemberWithStats extends Member {
  totalPoints: number;
  pulseStreak: number;
  ipeBalance?: string;
  ipeBalanceRaw?: string;
}

// /api/v2/auth/me response
export interface AuthMeResponse {
  isMember: boolean;
  memberId?: number;
  approved: boolean;
  status?: string;
  member?: MemberWithStats;
  privyUser?: {
    id: string;
    linkedAccounts: PrivyLinkedAccount[];
  };
}

// Privy linked account types
export interface PrivyLinkedAccount {
  type: string;
  address?: string;
  verified_at?: number;
  first_verified_at?: number;
  latest_verified_at?: number;
  chain_type?: string;
  wallet_client_type?: string;
  connector_type?: string;
}

// /api/pulses and /api/pulses/active response
export interface PulsesResponse {
  pulses: Pulse[];
}

// /api/pulse-types response
export interface PulseTypesResponse {
  pulseTypes: PulseType[];
}

// /api/members response (admin)
export interface MembersResponse {
  members: MemberWithStats[];
}

// /api/neynar/signer/:fid response
export interface SignerResponse {
  signer_uuid: string;
  status: string;
  public_key?: string;
  signer_approval_url?: string;
  fid?: number;
}

// /api/members/check/:fid response
export interface MemberCheckResponse {
  isMember: boolean;
  approved: boolean;
  member?: MemberWithStats;
}

// /api/executions/:memberId/details response
export interface ExecutionDetailItem {
  execution: {
    id: number;
    actions: unknown;
    executedAt: Date | string | null;
  };
  pulse: {
    id: number;
    description: string;
    points: number;
    datetimeStart: Date | string;
    interval: number;
    urlEmbed: string;
  };
  attestation: {
    id: number;
    status: string;
    attestationUid: string | null;
    transactionHash: string | null;
    createdAt: Date | string | null;
  } | null;
  pointsEarned: number;
}

export interface ExecutionDetailsResponse {
  executionDetails: ExecutionDetailItem[];
}

// /api/pulse/:pulseId/executions response
export interface PulseExecutionsResponse {
  executions: (PulseExecution & {
    member?: Pick<Member, 'id' | 'ipeUsername' | 'email' | 'walletAddress'>;
  })[];
}

// /api/v2/members/:memberId/wallets response
export interface MemberWalletsResponse {
  wallets: MemberWallet[];
}

// /api/v2/community/members response
export interface CommunityMember {
  id: number;
  ipeUsername?: string | null;
  email?: string | null;
  walletAddress?: string | null;
  memberType: string;
  status: string;
  bio?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  profileTags?: string[] | null;
  totalPoints: number;
  pulseStreak: number;
  ipeBalance?: string;
  ipeBalanceRaw?: string;
  pfpUrl?: string | null;
  createdAt?: string | null;
  rank?: number;
}

export interface CommunityMembersResponse {
  members: CommunityMember[];
}
