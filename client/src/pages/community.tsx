import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { MemberCard } from "@/components/profile/MemberCard";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, Trophy, TrendingUp, Target, SortAsc, SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";

interface CommunityMember {
  id: number;
  farcasterFid: number;
  memberType: string;
  ipePassport?: string;
  totalPoints: number;
  pulseStreak: number;
  createdAt: string;
  // Add any additional fields from the member model that we might need
}

type SortOption = 'points' | 'streak' | 'name';
type SortDirection = 'asc' | 'desc';

export default function Community() {
  const { isAuthenticated, profile, isLoading: authLoading } = usePersistentAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Fetch community members
  const { data: membersData, isLoading: membersLoading, error } = useQuery<{ members: Array<CommunityMember & any> }>({
    queryKey: ["/api/community/members"],
    queryFn: async () => {
      console.log("=== FRONTEND COMMUNITY QUERY DEBUG START ===");
      console.log("Making request to /api/community/members");
      console.log("Profile FID:", profile?.fid);
      console.log("Is authenticated:", isAuthenticated);
      
      const response = await fetch("/api/community/members", {
        headers: {
          "x-farcaster-fid": profile?.fid?.toString() || "",
        },
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error text:", errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Response data:", data);
      console.log("Members count:", data?.members?.length || 0);
      console.log("=== FRONTEND COMMUNITY QUERY DEBUG END ===");
      
      return data;
    },
    enabled: Boolean(isAuthenticated && profile?.fid),
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
      members = members.filter((member: CommunityMember & any) => {
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
    if (sortBy === 'points' || sortBy === 'streak') {
      console.log("=== RANKING DEBUG START ===");
      console.log("Raw members data:", members.map(m => ({ 
        fid: m.farcasterFid, 
        points: m.totalPoints, 
        streak: m.pulseStreak, 
        createdAt: m.createdAt,
        name: m.displayName || m.username 
      })));
      
      // Create a performance-sorted array to determine ranks
      const performanceSorted = [...members].sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'points') {
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
              // Fallback to FID if createdAt is missing
              comparison = a.farcasterFid - b.farcasterFid;
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
              // Fallback to FID if createdAt is missing
              comparison = a.farcasterFid - b.farcasterFid;
            }
          }
        }
        
        return comparison;
      });

      console.log("Performance sorted order:", performanceSorted.map((m, idx) => ({ 
        rank: idx + 1,
        fid: m.farcasterFid, 
        points: m.totalPoints, 
        streak: m.pulseStreak, 
        createdAt: m.createdAt,
        name: m.displayName || m.username 
      })));

      // Assign fixed ranks based on performance position (highest performance = #1)
      membersWithRanks = members.map(member => {
        const performanceIndex = performanceSorted.findIndex(p => p.farcasterFid === member.farcasterFid);
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
    console.log("=== DISPLAY SORTING DEBUG START ===");
    console.log("Before display sort - Members with ranks:", membersWithRanks.map(m => ({ 
      name: m.displayName || m.username,
      rank: m.rank,
      points: m.totalPoints,
      streak: m.pulseStreak
    })));
    
    membersWithRanks.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'points':
          // Primary: sort by points
          comparison = a.totalPoints - b.totalPoints;
          // Tiebreaker 1: if points are equal, sort by streak
          if (comparison === 0) {
            comparison = a.pulseStreak - b.pulseStreak;
          }
          // Tiebreaker 2: if still equal, sort by registration date (earliest wins)
          if (comparison === 0) {
            if (a.createdAt && b.createdAt) {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              comparison = dateA - dateB;
            } else {
              // Fallback to FID if createdAt is missing
              comparison = a.farcasterFid - b.farcasterFid;
            }
          }
          break;
        case 'streak':
          // Primary: sort by streak
          comparison = a.pulseStreak - b.pulseStreak;
          // Tiebreaker 1: if streaks are equal, sort by points
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
              // Fallback to FID if createdAt is missing
              comparison = a.farcasterFid - b.farcasterFid;
            }
          }
          break;
        case 'name':
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
              // Fallback to FID if createdAt is missing
              comparison = a.farcasterFid - b.farcasterFid;
            }
          }
          break;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16 px-8">
              <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-slate-700" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Authentication Required
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Please sign in to view the community members and explore the Ipê City community.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.error("Community page error:", error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16 px-8">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Error Loading Community
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Failed to load community members. Please try again later.
              </p>
              <details className="text-left text-sm text-gray-500 max-w-md mx-auto bg-gray-50 rounded-lg p-4">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{error instanceof Error ? error.message : String(error)}</pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalMembers = membersData?.members?.length || 0;
  const filteredCount = sortedAndFilteredMembers.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="bg-gradient-to-r from-slate-800 to-sky-600 rounded-t-xl px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">Community</h1>
                  <p className="text-slate-200 mt-1">
                    Meet the active members of Ipê City
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-6 text-white/90">
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalMembers}</div>
                  <div className="text-sm text-slate-200">Members</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-8 py-6 space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, passport, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 border-gray-200 focus:border-lime-500 focus:ring-lime-500"
              />
            </div>

            {/* Sorting Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={sortBy === 'points' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('points')}
                  className="h-9 px-4 font-medium"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Points
                </Button>
                <Button
                  variant={sortBy === 'streak' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('streak')}
                  className="h-9 px-4 font-medium"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Streak
                </Button>
                <Button
                  variant={sortBy === 'name' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('name')}
                  className="h-9 px-4 font-medium"
                >
                  Name
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="h-9 px-3 font-medium border-gray-200"
              >
                {sortDirection === 'desc' ? (
                  <SortDesc className="h-4 w-4" />
                ) : (
                  <SortAsc className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {membersLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading community members...</p>
            </div>
          </div>
        ) : sortedAndFilteredMembers.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedAndFilteredMembers.map((member: CommunityMember & any) => (
                <MemberCard
                  key={member.farcasterFid}
                  farcasterFid={member.farcasterFid}
                  displayName={member.displayName}
                  username={member.username}
                  memberType={member.memberType}
                  ipePassport={member.ipePassport}
                  totalPoints={member.totalPoints}
                  pulseStreak={member.pulseStreak}
                  pfpUrl={member.pfpUrl}
                  rank={member.rank}
                  showRank={sortBy === 'points' || sortBy === 'streak'}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16 px-8">
              {searchQuery ? (
                <>
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    No members found
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    No members match your search "{searchQuery}". Try adjusting your search terms or filters.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    className="font-medium"
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    No active members
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    There are currently no active members in the community. Check back later!
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}