import { Badge } from "@/components/ui/badge";
import {
  User,
  Globe,
  CheckCircle,
} from "lucide-react";
import { getMemberTypeInfo } from "@/lib/memberTypeConfig";

interface ProfileHeaderProps {
  displayName?: string;
  username?: string;
  fid?: number;
  memberId?: number;
  memberType?: string;
  ipePassport?: string;
  passportVerified?: boolean;
  pfpUrl?: string;
  createdAt?: string;
}


export function ProfileHeader({
  displayName,
  username,
  fid,
  memberId,
  memberType = 'pending',
  ipePassport,
  passportVerified,
  pfpUrl,
  createdAt
}: ProfileHeaderProps) {
  const memberTypeInfo = memberType ? getMemberTypeInfo(memberType) : null;

  // Format join date
  const memberSince = createdAt ? new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric"
  }) : null;

  return (
    <div className="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
      <div className="flex items-center space-x-3 md:space-x-4">
        {pfpUrl ? (
          <img
            src={pfpUrl}
            alt={`${displayName || username || 'User'} profile picture`}
            className="h-12 w-12 md:h-16 md:w-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            {displayName || username ? (
              <span className="text-white text-lg md:text-2xl font-semibold">
                {(displayName || username || '?')[0].toUpperCase()}
              </span>
            ) : (
              <User className="h-6 w-6 md:h-8 md:w-8 text-white" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {displayName || username}
          </h1>
          <p className="text-xs md:text-sm text-gray-500">
            Member ID: {memberId}{memberSince && <span className="text-gray-400"> • Member since {memberSince}</span>}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            {memberTypeInfo && (
              <div className="group relative">
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${memberTypeInfo.color} cursor-pointer`}>
                  <memberTypeInfo.icon className="h-4 w-4" />
                  <span>{memberTypeInfo.label}</span>
                </div>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="font-medium">{memberTypeInfo.label}</div>
                  <div className="text-xs text-gray-300 mt-1">{memberTypeInfo.description}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-2 lg:flex-shrink-0">
        {/* Passport Info Box */}
        {ipePassport && passportVerified && (
          <div className="inline-block px-3 py-3 bg-lime-50 border border-lime-200 border-l-4 border-l-lime-500 rounded-lg">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-lime-600" />
              <span className="text-sm font-medium text-gray-700">Ipê Passport</span>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800 text-xs"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>
            <div className="mt-1">
              <p className="text-lime-600 font-semibold text-base">
                {ipePassport}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}