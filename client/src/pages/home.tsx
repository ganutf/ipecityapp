import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  GraduationCap,
  Mail,
  Wallet,
  CheckCircle,
  Zap,
  Fingerprint
} from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, isLoading, isMember, memberStatus, login } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to appropriate page
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (isMember) {
        if (memberStatus === 'active_member') {
          // Active members go to community (main landing page for members)
          setLocation("/community");
        } else {
          // All other statuses: id-verification page handles the full onboarding flow
          // (pending_id_verification, pending_application_review, approved_application, denied_application)
          setLocation("/id-verification");
        }
      }
    }
  }, [isAuthenticated, isLoading, isMember, memberStatus, setLocation]);

  // Show loading while determining authentication status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
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

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8">

          {/* Hero Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-8 py-12">
              <div className="text-center max-w-4xl mx-auto">
                <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="h-8 w-8 text-gray-600" />
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
                  Welcome to Ipê City
                </h1>
                <p className="text-xl text-gray-600 mb-2">
                  A techno-optimistic network state community
                </p>
                <p className="text-gray-500">
                  Join builders, innovators, and visionaries shaping the future
                </p>
              </div>
            </div>
          </div>

          {/* Why Join Section */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Why Join Ipê City?</h2>
              <p className="text-gray-600">Unlock opportunities and connect with the future</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-l-4 border-l-lime-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-lime-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-lime-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Connect and Co-create</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Network with like-minded builders, entrepreneurs, and innovators from around the world.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-sky-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-sky-100 rounded-full flex items-center justify-center">
                      <Briefcase className="h-6 w-6 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Access Opportunities</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Get exclusive access to grants, job opportunities, and funding in the network state ecosystem.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-amber-500 bg-white shadow-sm hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Learn & Grow</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Stay ahead with insights on crypto, AI, and network states from industry leaders.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* How It Works Section */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">How It Works</h2>
              <p className="text-gray-600">Already have an Ipê Passport? Get started in three simple steps</p>
            </div>

            <Card className="bg-white shadow-sm border border-gray-100">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center relative">
                        <Mail className="h-8 w-8 text-slate-700" />
                        <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-lime-500 text-white text-xs flex items-center justify-center p-0">
                          1
                        </Badge>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Sign Up with Email</h3>
                    <p className="text-gray-600 text-sm">
                      Create your account with email and set up a secure passkey.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center relative">
                        <Fingerprint className="h-8 w-8 text-slate-700" />
                        <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center p-0">
                          2
                        </Badge>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Create Your Wallet</h3>
                    <p className="text-gray-600 text-sm">
                      A smart wallet is automatically created for you, secured by your passkey.
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center relative">
                        <Wallet className="h-8 w-8 text-slate-700" />
                        <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center p-0">
                          3
                        </Badge>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Claim Your Username</h3>
                    <p className="text-gray-600 text-sm">
                      Reserve your unique Ipê subdomain and join the community.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action Section */}
          <Card className="border-l-4 border-l-lime-500 bg-lime-50 shadow-sm">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="h-16 w-16 bg-lime-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-lime-600" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Ready to Join?
              </h3>
              <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
                Create your account with email or connect your wallet to join the community.
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  onClick={() => login()}
                  size="lg"
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8"
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Sign Up / Sign In
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-4">
            <p>Ipê City • A Network State Community</p>
          </div>
        </div>
      </div>
    );
  }

  // For authenticated users who haven't been redirected, show a loading state
  // (AuthGuard will handle redirection for users in verification process)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Redirecting...</p>
          </div>
        </div>
      </div>
    </div>
  );
}