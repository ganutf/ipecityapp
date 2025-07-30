import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Compass, 
  Shield, 
  Users, 
  Star, 
  AlertCircle,
  Globe,
  TrendingUp,
  Target
} from "lucide-react";
import { Link } from "wouter";

interface MemberCardProps {
  farcasterFid: number;
  displayName?: string;
  username?: string;
  memberType?: string;
  ipePassport?: string;
  totalPoints: number;
  pulseStreak: number;
  pfpUrl?: string;
}

const memberTypeConfig = {
  architect: { 
    label: 'Architect', 
    icon: User, 
    color: 'bg-purple-100 text-purple-600',
    description: 'Building the future of communities'
  },
  explorer: { 
    label: 'Explorer', 
    icon: Compass, 
    color: 'bg-blue-100 text-blue-600',
    description: 'Discovering new possibilities'
  },
  admin: { 
    label: 'Admin', 
    icon: Shield, 
    color: 'bg-green-100 text-green-600',
    description: 'Leading and managing the community'
  },
  org_team: { 
    label: 'Org Team', 
    icon: Users, 
    color: 'bg-orange-100 text-orange-600',
    description: 'Supporting organizational operations'
  },
  core_team: { 
    label: 'Core Team', 
    icon: Star, 
    color: 'bg-red-100 text-red-600',
    description: 'Core development and leadership'
  },
  pending: { 
    label: 'Pending', 
    icon: AlertCircle, 
    color: 'bg-gray-100 text-gray-600',
    description: 'Awaiting approval'
  }
};

export function MemberCard({ 
  farcasterFid, 
  displayName, 
  username, 
  memberType = 'pending',
  ipePassport,
  totalPoints,
  pulseStreak,
  pfpUrl
}: MemberCardProps) {
  const memberTypeInfo = memberTypeConfig[memberType as keyof typeof memberTypeConfig];

  return (
    <Link href={`/member/${farcasterFid}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            {/* Profile Avatar */}
            {pfpUrl ? (
              <img 
                src={pfpUrl} 
                alt={`${displayName || username || 'User'} profile picture`}
                className="h-12 w-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                {displayName || username ? (
                  <span className="text-white text-lg font-semibold">
                    {(displayName || username || '?')[0].toUpperCase()}
                  </span>
                ) : (
                  <User className="h-6 w-6 text-white" />
                )}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {/* Name and Type */}
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                    {displayName || username}
                  </h3>
                  <p className="text-xs text-gray-500">ID: {farcasterFid}</p>
                </div>
                
                {/* Member Type Badge */}
                {memberTypeInfo && (
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${memberTypeInfo.color}`}>
                    <memberTypeInfo.icon className="h-4 w-4" />
                  </div>
                )}
              </div>
              
              {/* Passport */}
              {ipePassport && (
                <div className="flex items-center space-x-1 mb-2">
                  <Globe className="h-3 w-3 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium truncate">
                    {ipePassport}
                  </span>
                </div>
              )}
              
              {/* Stats Row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <span className="text-gray-600">
                    <span className="font-semibold text-green-600">{totalPoints}</span> pts
                  </span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Target className="h-3 w-3 text-orange-600" />
                  <span className="text-gray-600">
                    <span className="font-semibold text-orange-600">{pulseStreak}</span> streak
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}