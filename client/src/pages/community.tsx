import { useQuery } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { MemberCard } from "@/components/profile/MemberCard";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface CommunityMember {
  id: number;
  farcasterFid: number;
  memberType: string;
  ipePassport?: string;
  totalPoints: number;
  pulseStreak: number;
  // Add any additional fields from the member model that we might need
}

export default function Community() {
  const { isAuthenticated, profile, isLoading: authLoading } = usePersistentAuth();
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!membersData?.members || !searchQuery.trim()) {
      return membersData?.members || [];
    }

    const query = searchQuery.toLowerCase();
    return membersData.members.filter((member: CommunityMember & any) => {
      // Search by display name, username, passport, or member type
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
  }, [membersData?.members, searchQuery]);

  // Show loading state
  if (authLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authentication required
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Card>
          <CardContent className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600">
              Please sign in to view the community members.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.error("Community page error:", error);
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-red-500 mb-4">
              <Users className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Error Loading Community
            </h2>
            <p className="text-gray-600 mb-4">
              Failed to load community members. Please try again later.
            </p>
            <details className="text-left text-xs text-gray-500 max-w-md mx-auto">
              <summary className="cursor-pointer">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap">{error instanceof Error ? error.message : String(error)}</pre>
            </details>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMembers = membersData?.members?.length || 0;
  const filteredCount = filteredMembers.length;

  return (
    <div className="w-full mx-auto bg-gray-50 px-3 md:px-4 space-y-4 md:space-y-6">
      <div className="w-full mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Community</h1>
              <p className="text-gray-600">
                Meet the active members of Ipê City
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search members by name, passport, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {searchQuery ? (
                <>
                  Showing {filteredCount} of {totalMembers} members
                </>
              ) : (
                <>
                  {totalMembers} active member{totalMembers !== 1 ? 's' : ''}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Members Grid */}
        {membersLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading community members...</p>
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map((member: CommunityMember & any) => (
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
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              {searchQuery ? (
                <>
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No members found
                  </h3>
                  <p className="text-gray-600">
                    No members match your search "{searchQuery}". Try adjusting your search terms.
                  </p>
                </>
              ) : (
                <>
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No active members
                  </h3>
                  <p className="text-gray-600">
                    There are currently no active members in the community.
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