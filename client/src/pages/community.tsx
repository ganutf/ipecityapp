import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, Trophy, Target, SortAsc, SortDesc, Coins } from "lucide-react";
import { getMemberTypeInfo } from "@/lib/memberTypeConfig";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

interface CommunityMember {
  id: number;
  farcasterFid: number;
  memberType: string;
  ipePassport?: string;
  totalPoints: number;
  pulseStreak: number;
  createdAt: string;
  walletAddress?: string;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
  rank?: number;
  ipeBalance?: string; // Formatted balance from server (e.g., "1,234.56")
  ipeBalanceRaw?: string; // Raw balance for sorting
}

type SortOption = 'ipe' | 'points' | 'streak' | 'name';
type SortDirection = 'asc' | 'desc';


// MemberRow component for table display
function MemberRow({
  member,
  showRank
}: {
  member: CommunityMember;
  showRank: boolean;
}) {
  const [, setLocation] = useLocation();
  const typeInfo = getMemberTypeInfo(member.memberType);
  const MemberIcon = typeInfo.icon;

  // Rank badge styling
  const getRankBadge = (rank?: number) => {
    if (!rank) return null;

    if (rank === 1) {
      return (
        <Badge className="px-3 py-1.5 text-sm font-semibold rounded-full bg-amber-500 text-white">
          #1
        </Badge>
      );
    } else if (rank === 2) {
      return (
        <Badge className="px-3 py-1.5 text-sm font-semibold rounded-full bg-gray-400 text-white">
          #2
        </Badge>
      );
    } else if (rank === 3) {
      return (
        <Badge className="px-3 py-1.5 text-sm font-semibold rounded-full bg-orange-600 text-white">
          #3
        </Badge>
      );
    } else {
      return (
        <span className="text-sm font-semibold text-gray-600">
          #{rank}
        </span>
      );
    }
  };

  return (
    <tr className="border-b border-gray-200 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setLocation(`/member/${member.id}`)}>
        {showRank && (
          <td className="px-4 py-4 text-center align-middle">
            {getRankBadge(member.rank)}
          </td>
        )}
        <td className="px-4 py-4 align-middle">
          <div className="flex items-center space-x-3">
            <img
              src={member.pfpUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.farcasterFid}`}
              alt={member.displayName || member.username || `User ${member.farcasterFid}`}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <div className="font-semibold text-gray-900">
                {member.displayName || member.username || `User ${member.farcasterFid}`}
              </div>
              <div className="text-sm text-gray-600">
                Member ID: {member.id}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-4 align-middle">
          <div className="flex items-center space-x-1.5">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${typeInfo.badgeColor}`}>
              <MemberIcon className="h-3 w-3" />
            </div>
            <span className="text-xs text-gray-600">{typeInfo.label}</span>
          </div>
        </td>
        <td className="px-4 py-4 align-middle">
          {member.ipePassport ? (
            <span className="text-sm font-medium text-lime-600">
              {member.ipePassport}
            </span>
          ) : (
            <span className="text-sm text-gray-400">
              No passport
            </span>
          )}
        </td>
        <td className="px-4 py-4 align-middle">
          {member.ipeBalance && member.ipeBalance !== '0' ? (
            <span className="text-sm font-semibold text-gray-900">
              {member.ipeBalance}
            </span>
          ) : member.walletAddress ? (
            <span className="text-sm text-gray-400">0</span>
          ) : (
            <span className="text-sm text-gray-400">No wallet</span>
          )}
        </td>
        <td className="px-4 py-4 align-middle">
          <div className="flex items-center space-x-2">
            <Trophy className="h-4 w-4 text-lime-500" />
            <span className="text-sm font-semibold text-gray-900">
              {member.totalPoints}
            </span>
          </div>
        </td>
        <td className="px-4 py-4 align-middle">
          <div className="flex items-center space-x-2">
            <Target className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-semibold text-gray-900">
              {member.pulseStreak}
            </span>
          </div>
        </td>
    </tr>
  );
}

export default function Community() {
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('ipe');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch community members using Privy auth
  const { data: membersData, isLoading: membersLoading, error } = useQuery<{ members: CommunityMember[] }>({
    queryKey: ["/api/v2/community/members"],
    queryFn: async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/v2/community/members", {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error text:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response.json();
    },
    enabled: isAuthenticated,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Sort and filter members
  const sortedAndFilteredMembers = useMemo(() => {
    if (!membersData?.members) return [];

    let members = [...membersData.members];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      members = members.filter((member: CommunityMember) => {
        const searchableText = [
          member.displayName,
          member.username,
          member.ipePassport,
          member.memberType,
          member.farcasterFid.toString(),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    // First, calculate fixed ranks based on performance (separate from display sorting)
    let membersWithRanks = members;
    if (sortBy === 'ipe' || sortBy === 'points' || sortBy === 'streak') {
      console.log("=== RANKING DEBUG START ===");
      console.log("Raw members data:", members.map(m => ({
        id: m.id,
        ipeBalance: m.ipeBalance,
        ipeBalanceRaw: m.ipeBalanceRaw,
        points: m.totalPoints,
        streak: m.pulseStreak,
        name: m.displayName || m.username
      })));

      // Create a performance-sorted array to determine ranks
      const performanceSorted = [...members].sort((a, b) => {
        let comparison = 0;

        if (sortBy === 'ipe') {
          // Sort by IPE balance (highest first) using raw balance from API
          const balanceA = BigInt(a.ipeBalanceRaw || '0');
          const balanceB = BigInt(b.ipeBalanceRaw || '0');

          if (balanceA > balanceB) {
            comparison = -1;
          } else if (balanceA < balanceB) {
            comparison = 1;
          }

          // Tiebreaker 1: points
          if (comparison === 0) {
            comparison = b.totalPoints - a.totalPoints;
          }
          // Tiebreaker 2: streak
          if (comparison === 0) {
            comparison = b.pulseStreak - a.pulseStreak;
          }
          // Tiebreaker 3: registration date or member ID
          if (comparison === 0) {
            if (a.createdAt && b.createdAt) {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              comparison = dateA - dateB;
            } else {
              comparison = a.id - b.id;
            }
          }
        } else if (sortBy === 'points') {
          // Always sort by highest points first for ranking
          comparison = b.totalPoints - a.totalPoints;
          if (comparison === 0) {
            comparison = b.pulseStreak - a.pulseStreak;
          }
          if (comparison === 0) {
            // Handle missing createdAt gracefully
            if (a.createdAt && b.createdAt) {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              comparison = dateA - dateB;
            } else {
              // Fallback to member ID if createdAt is missing
              comparison = a.id - b.id;
            }
          }
        } else { // streak
          // Always sort by highest streak first for ranking
          comparison = b.pulseStreak - a.pulseStreak;
          if (comparison === 0) {
            comparison = b.totalPoints - a.totalPoints;
          }
          if (comparison === 0) {
            // Handle missing createdAt gracefully
            if (a.createdAt && b.createdAt) {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              comparison = dateA - dateB;
            } else {
              // Fallback to member ID if createdAt is missing
              comparison = a.id - b.id;
            }
          }
        }

        return comparison;
      });

      console.log("Performance sorted order:", performanceSorted.map((m, idx) => ({
        rank: idx + 1,
        id: m.id,
        ipeBalance: m.ipeBalance,
        ipeBalanceRaw: m.ipeBalanceRaw,
        points: m.totalPoints,
        streak: m.pulseStreak,
        name: m.displayName || m.username
      })));

      // Assign fixed ranks based on performance position (highest performance = #1)
      membersWithRanks = members.map(member => {
        // Use member.id for matching since farcasterFid may not be unique (Privy users without Farcaster)
        const performanceIndex = performanceSorted.findIndex(p => p.id === member.id);
        const rank = performanceIndex + 1;
        console.log(`Member ${member.displayName || member.username} (${member.totalPoints}pts, ${member.pulseStreak}streak) -> Rank #${rank}`);
        return {
          ...member,
          rank
        };
      });

      console.log("=== RANKING DEBUG END ===");
    } else {
      // For name sorting, don't show ranks
      membersWithRanks = members.map(member => ({
        ...member,
        rank: undefined
      }));
    }

    // Then, sort the display order (keeping the fixed ranks intact)
    // For performance metrics, sort by rank to maintain consistency
    if (sortBy === 'ipe' || sortBy === 'points' || sortBy === 'streak') {
      console.log("=== DISPLAY SORTING DEBUG START ===");
      console.log("Before display sort - Members with ranks:", membersWithRanks.map(m => ({
        name: m.displayName || m.username,
        rank: m.rank,
        points: m.totalPoints,
        streak: m.pulseStreak
      })));

      // For performance-based sorting, use rank order to maintain consistency
      membersWithRanks.sort((a, b) => {
        const rankComparison = (a.rank || 999) - (b.rank || 999);
        // ASC: show #1, #2, #3 (best first) - normal rank order
        // DESC: show worst first - reverse rank order
        return sortDirection === 'asc' ? rankComparison : -rankComparison;
      });
    } else {
      // For name sorting, use normal alphabetical sorting
      membersWithRanks.sort((a, b) => {
        let comparison = 0;

        // Primary: sort by name
        const nameA = (a.displayName || a.username || '').toLowerCase();
        const nameB = (b.displayName || b.username || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
        // Tiebreaker 1: if names are equal, sort by points
        if (comparison === 0) {
          comparison = a.totalPoints - b.totalPoints;
        }
        // Tiebreaker 2: if still equal, sort by registration date (earliest wins)
        if (comparison === 0) {
          if (a.createdAt && b.createdAt) {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            comparison = dateA - dateB;
          } else {
            // Fallback to member ID if createdAt is missing
            comparison = a.id - b.id;
          }
        }

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    console.log(`After display sort (${sortDirection}) - Final order:`, membersWithRanks.map(m => ({
      name: m.displayName || m.username,
      rank: m.rank,
      points: m.totalPoints,
      streak: m.pulseStreak
    })));
    console.log("=== DISPLAY SORTING DEBUG END ===");

    return membersWithRanks;
  }, [membersData?.members, searchQuery, sortBy, sortDirection]);

  // Show loading state
  if (authLoading) {
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4">
          <Card className="bg-white shadow-sm">
            <CardContent className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4">
          <Card className="bg-white shadow-sm">
            <CardContent className="text-center py-16 px-8">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-slate-700" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Authentication Required
              </h2>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Please sign in to view the community members and explore the Ipê City community.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.error("Community page error:", error);
    return (
      <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
        <div className="w-full mx-auto px-3 md:px-4">
          <Card className="bg-white shadow-sm">
            <CardContent className="text-center py-16 px-8">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Error Loading Community
              </h2>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                Failed to load community members. Please try again later.
              </p>
              <details className="text-left text-sm text-gray-500 max-w-md mx-auto bg-gray-50 rounded-lg p-4">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{error instanceof Error ? error.message : String(error)}</pre>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalMembers = membersData?.members?.length || 0;
  const filteredCount = sortedAndFilteredMembers.length;

  return (
    <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
      <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Header Card */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-slate-700" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Community</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Meet the active members of Ipê City
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center">
                <div className="text-center px-4 py-2 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{totalMembers}</div>
                  <div className="text-xs text-gray-600">Members</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filters Card */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, passport, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Sorting Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={sortBy === 'ipe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('ipe')}
                >
                  <Coins className="h-4 w-4 mr-2" />
                  $IPE
                </Button>
                <Button
                  variant={sortBy === 'points' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('points')}
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Points
                </Button>
                <Button
                  variant={sortBy === 'streak' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('streak')}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Streak
                </Button>
                <Button
                  variant={sortBy === 'name' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('name')}
                >
                  Name
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? (
                  <SortDesc className="h-4 w-4" />
                ) : (
                  <SortAsc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content Area */}
        {membersLoading ? (
          <Card className="bg-white shadow-sm">
            <CardContent className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading community members...</p>
            </CardContent>
          </Card>
        ) : sortedAndFilteredMembers.length > 0 ? (
          <Card className="bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-gray-200">
                  <tr>
                    {(sortBy === 'ipe' || sortBy === 'points' || sortBy === 'streak') && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                        Rank
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Member
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Passport
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      $IPE
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Points
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Streak
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredMembers.map((member: CommunityMember) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      showRank={sortBy === 'ipe' || sortBy === 'points' || sortBy === 'streak'}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="bg-white shadow-sm">
            <CardContent className="text-center py-16 px-8">
              {searchQuery ? (
                <>
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No members found
                  </h3>
                  <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                    No members match your search "{searchQuery}". Try adjusting your search terms or filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No active members
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    There are currently no active members in the community. Check back later!
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
