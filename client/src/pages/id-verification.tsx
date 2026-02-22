import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { EmailVerificationSection } from "@/components/EmailVerificationSection";
import { PassportVerificationSection } from "@/components/PassportVerificationSection";
import { useConnectWallet } from "@privy-io/react-auth";
import { useActiveWallet } from "@/hooks/useActiveWallet";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { Mail, Shield, CheckCircle, Clock, Wallet } from "lucide-react";

export default function IdVerificationPage() {
  const { member, memberId, isMemberLoading, memberStatus, refreshMember, isAuthenticated, getAccessToken } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { connectWallet } = useConnectWallet();
  const { activeWallet, isExternalWallet, disconnectExternalWallet } = useActiveWallet();
  const address = activeWallet?.address as `0x${string}` | undefined;
  const isConnected = !!activeWallet;

  const [emailComplete, setEmailComplete] = useState(false);
  const [passportComplete, setPassportComplete] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isMemberLoading) {
      setLocation("/");
    }
  }, [isAuthenticated, isMemberLoading, setLocation]);

  // Use member data directly from AuthContext
  const memberLoading = isMemberLoading;

  // Get wallet address for ENS lookup
  const walletForLookup = address || member?.walletAddress;

  // Lookup ENS subdomain at parent level for accurate progress tracking
  const { ensNames, isLoading: ensLoading } = useEnsLookup(walletForLookup || "");
  const hasSubdomainFromEns = ensNames && ensNames.length > 0;

  // Calculate progress (0/3, 1/3, 2/3, 3/3)
  const isWalletConnected = !!member?.walletAddress || isConnected;
  const isEmailVerified = member?.emailVerified || false;
  // Consider subdomain linked if either member has ipePassport OR we found one via ENS lookup
  const isSubdomainLinked = !!member?.ipePassport || hasSubdomainFromEns;

  const progressCount = [isWalletConnected, isEmailVerified, isSubdomainLinked].filter(Boolean).length;
  const allComplete = progressCount === 3;

  // Debug logging
  console.log("ID Verification Page - Status:", {
    isWalletConnected,
    isEmailVerified,
    isSubdomainLinked,
    hasSubdomainFromEns,
    memberIpePassport: member?.ipePassport,
    progressCount,
    memberStatus,
    memberId,
    // Wallet debug
    privyWalletAddress: address,
    memberWalletAddress: member?.walletAddress,
    displayedWallet: address ?? member?.walletAddress,
  });

  // Save wallet address when connected via Privy (also updates if wallet changed)
  useEffect(() => {
    const saveWalletAddress = async () => {
      if (isConnected && address && memberId && address.toLowerCase() !== member?.walletAddress?.toLowerCase()) {
        try {
          const token = await getAccessToken();
          if (!token) {
            console.error('No access token available for wallet save');
            return;
          }
          const response = await fetch(`/api/v2/members/${memberId}/wallet`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ walletAddress: address }),
          });
          if (response.ok) {
            refreshMember(); // Refresh to get updated member data
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Failed to save wallet address:', response.status, errorData);
          }
        } catch (error) {
          console.error('Failed to save wallet address:', error);
        }
      }
    };
    saveWalletAddress();
  }, [isConnected, address, memberId, member?.walletAddress, refreshMember, getAccessToken]);

  // Redirect to home if user becomes approved member
  useEffect(() => {
    if (memberStatus === 'active_member') {
      setLocation("/");
    }
  }, [memberStatus, setLocation]);

  const handleEmailComplete = () => {
    setEmailComplete(true);
    refreshMember(); // Refresh member status from AuthContext
  };

  const handlePassportComplete = () => {
    setPassportComplete(true);
    refreshMember(); // Refresh member status from AuthContext
  };

  const handleDone = () => {
    setLocation("/");
  };

  // Show loading state while member status is being fetched
  if (memberLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading verification status...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="bg-gradient-to-r from-slate-800 to-sky-600 rounded-t-xl px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">ID Verification Process ({progressCount}/3)</h1>
                  <p className="text-slate-200 mt-1">
                    Connect wallet, verify email, and link your subdomain
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center space-x-6 text-white/90">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {progressCount}/3
                  </div>
                  <div className="text-sm text-slate-200">Complete</div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress indicators */}
          <div className="px-8 py-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {isWalletConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${isWalletConnected ? 'text-green-700' : 'text-gray-600'}`}>
                  Wallet Connection
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isEmailVerified ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${isEmailVerified ? 'text-green-700' : 'text-gray-600'}`}>
                  Email Verification
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSubdomainLinked ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Clock className="h-5 w-5 text-gray-400" />
                )}
                <span className={`text-sm font-medium ${isSubdomainLinked ? 'text-green-700' : 'text-gray-600'}`}>
                  Subdomain
                </span>
              </div>
            </div>
          </div>
        </div>

      {/* 1. Wallet Connection Section */}
      <Card className="border-l-4 border-l-purple-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-600" />
            Wallet Connection
          </CardTitle>
          <CardDescription>
            Connect your Ethereum wallet to proceed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isWalletConnected ? (
            <Button onClick={() => connectWallet()} className="w-full">
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-900">Wallet Connected</p>
                    <p className="text-sm text-green-700">
                      {(address ?? member?.walletAddress)?.slice(0, 6)}...{(address ?? member?.walletAddress)?.slice(-4)}
                      {isExternalWallet && <span className="ml-1 text-green-600">(external)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isExternalWallet && disconnectExternalWallet && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnectExternalWallet}
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connectWallet()}
                    className="text-xs"
                  >
                    Change Wallet
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Email Verification Section */}
      <Card className="border-l-4 border-l-lime-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-lime-600" />
            Email Verification
          </CardTitle>
          <CardDescription>
            Verify your email address to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailVerificationSection
            memberId={memberId || 0}
            currentEmail={member?.email || ""}
            isVerified={member?.emailVerified || false}
            onVerificationComplete={handleEmailComplete}
            allowChange={true}
          />
        </CardContent>
      </Card>

      {/* 3. Passport Verification Section - Only show if wallet is connected */}
      {isWalletConnected && (
        <PassportVerificationSection
          memberId={memberId || 0}
          memberData={{
            isMember: true,
            status: member?.status,
            member: member ? {
              id: member.id,
              email: member.email,
              status: member.status,
              ipeUsername: member.ipeUsername,
              walletAddress: member.walletAddress || address,
              memberType: member.memberType,
              ipePassport: member.ipePassport,
            } : undefined,
          }}
          currentPassport={member?.ipePassport || undefined}
          isVerified={member?.status === 'active_member'}
          context="id-verification"
          onVerificationComplete={() => {
            refreshMember();
            setLocation("/");
          }}
        />
      )}
      </div>
    </div>
  );
}
