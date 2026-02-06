import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useConnectWallet } from "@privy-io/react-auth";
import { 
  User, 
  Wallet, 
  Globe, 
  CheckCircle,
  AlertCircle,
  Compass,
  Shield,
  Users,
  Star
} from "lucide-react";

interface ProfileHeaderProps {
  displayName?: string;
  username?: string;
  fid?: number;
  memberId?: number;
  memberType?: string;
  ipePassport?: string;
  passportVerified?: boolean;
  walletAddress?: string;
  isConnected?: boolean;
  address?: string;
  showWalletActions?: boolean;
  onDisconnectWallet?: () => void;
  pfpUrl?: string;
  createdAt?: string;
}

const memberTypeConfig = {
  architect: { 
    label: 'Architect', 
    icon: User, 
    color: 'bg-purple-100 text-purple-600',
    hoverColor: 'hover:bg-purple-200',
    description: 'Building the future of communities'
  },
  explorer: { 
    label: 'Explorer', 
    icon: Compass, 
    color: 'bg-blue-100 text-blue-600',
    hoverColor: 'hover:bg-blue-200',
    description: 'Discovering new possibilities'
  },
  admin: { 
    label: 'Admin', 
    icon: Shield, 
    color: 'bg-green-100 text-green-600',
    hoverColor: 'hover:bg-green-200',
    description: 'Leading and managing the community'
  },
  org_team: { 
    label: 'Org Team', 
    icon: Users, 
    color: 'bg-orange-100 text-orange-600',
    hoverColor: 'hover:bg-orange-200',
    description: 'Supporting organizational operations'
  },
  core_team: { 
    label: 'Core Team', 
    icon: Star, 
    color: 'bg-red-100 text-red-600',
    hoverColor: 'hover:bg-red-200',
    description: 'Core development and leadership'
  },
  pending: { 
    label: 'Pending', 
    icon: AlertCircle, 
    color: 'bg-gray-100 text-gray-600',
    hoverColor: 'hover:bg-gray-200',
    description: 'Awaiting approval'
  }
};

export function ProfileHeader({
  displayName,
  username,
  fid,
  memberId,
  memberType = 'pending',
  ipePassport,
  passportVerified,
  walletAddress,
  isConnected,
  address,
  showWalletActions = false,
  onDisconnectWallet,
  pfpUrl,
  createdAt
}: ProfileHeaderProps) {
  // Privy wallet hooks (replacing RainbowKit)
  const { connectWallet } = useConnectWallet();

  const memberTypeInfo = memberTypeConfig[memberType as keyof typeof memberTypeConfig];

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
                <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors ${memberTypeInfo.color} ${memberTypeInfo.hoverColor} cursor-pointer`}>
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
        {/* Connected Wallet Info Box */}
        {showWalletActions && (
          <div
            className={`flex flex-col px-3 py-3 rounded-lg border-l-4 border ${
              isConnected
                ? "bg-sky-50 border-sky-200 border-l-sky-500"
                : "bg-gray-50 border-gray-200 border-l-gray-400"
            }`}
          >
            <div className="flex items-center space-x-2">
              <Wallet
                className={`h-4 w-4 ${isConnected ? "text-sky-600" : "text-gray-400"}`}
              />
              <span className="text-xs text-gray-600 font-medium">
                {isConnected ? "Connected Wallet" : "Wallet Not Connected"}
              </span>
            </div>
            <div className="mt-1">
              {isConnected ? (
                <div className="flex items-center space-x-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="text-xs md:text-sm font-mono hover:underline transition-colors text-sky-600 font-medium">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Wallet</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to disconnect your wallet? You'll need to reconnect to perform transactions.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDisconnectWallet}>
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 text-xs"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
              ) : (
                <button
                  onClick={() => connectWallet()}
                  className="text-xs md:text-sm text-gray-500 hover:underline transition-colors font-medium"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        )}

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
              {walletAddress && (
                <div className="text-xs text-gray-500 mt-1">
                  Passport wallet: {walletAddress?.slice(0, 6)}...
                  {walletAddress?.slice(-4)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}