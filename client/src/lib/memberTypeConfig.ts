import { User, Compass, Shield, Users, Star, AlertCircle, type LucideIcon } from "lucide-react";

export interface MemberTypeInfo {
  label: string;
  icon: LucideIcon;
  color: string;
  badgeColor: string;
  description: string;
}

/**
 * Single source of truth for member type display configuration.
 * Used across community page, admin page, profile header, and member cards.
 */
export const MEMBER_TYPE_CONFIG: Record<string, MemberTypeInfo> = {
  architect: {
    label: "Architect",
    icon: User,
    color: "bg-purple-100 text-purple-600",
    badgeColor: "bg-purple-500 text-white",
    description: "Building the future of communities",
  },
  explorer: {
    label: "Explorer",
    icon: Compass,
    color: "bg-blue-100 text-blue-600",
    badgeColor: "bg-blue-500 text-white",
    description: "Discovering new possibilities",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    color: "bg-green-100 text-green-600",
    badgeColor: "bg-green-500 text-white",
    description: "Leading and managing the community",
  },
  org_team: {
    label: "Org Team",
    icon: Users,
    color: "bg-orange-100 text-orange-600",
    badgeColor: "bg-orange-500 text-white",
    description: "Supporting organizational operations",
  },
  core_team: {
    label: "Core Team",
    icon: Star,
    color: "bg-red-100 text-red-600",
    badgeColor: "bg-red-500 text-white",
    description: "Core development and leadership",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    color: "bg-gray-100 text-gray-600",
    badgeColor: "bg-gray-500 text-white",
    description: "Awaiting approval",
  },
} as const;

export function getMemberTypeInfo(memberType: string): MemberTypeInfo {
  return MEMBER_TYPE_CONFIG[memberType] || MEMBER_TYPE_CONFIG.pending;
}
