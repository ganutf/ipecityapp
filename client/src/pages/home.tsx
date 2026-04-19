import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  const { isAuthenticated, isLoading, isMember, memberStatus, login } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to appropriate page
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      if (isMember) {
        if (memberStatus === 'active_member') {
          setLocation("/community");
        } else {
          setLocation("/id-verification");
        }
      }
    }
  }, [isAuthenticated, isLoading, isMember, memberStatus, setLocation]);

  // Show loading while determining authentication status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-ipe-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ipe-navy"></div>
      </div>
    );
  }

  // Show welcome page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-ipe-white overflow-hidden">
        {/* Subtle decorative background — Ipê chevron watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <svg
            viewBox="0 0 200 200"
            className="w-[600px] h-[600px] opacity-[0.03]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M100 20L40 100L100 180L160 100L100 20Z"
              fill="#002642"
            />
          </svg>
        </div>

        {/* Accent line at top */}
        <div className="h-1 bg-gradient-to-r from-ipe-lime via-ipe-blue to-ipe-navy" />

        {/* Main content */}
        <div className="relative z-10 min-h-[calc(100vh-4px)] flex flex-col">
          {/* Header */}
          <header className="w-full px-6 sm:px-10 py-8">
            <img
              src="/logo-dark.svg"
              alt="Ipê City"
              className="h-8 w-auto"
            />
          </header>

          {/* Hero — vertically centered in remaining space */}
          <main className="flex-1 flex items-center px-6 sm:px-10 lg:px-20 pb-20">
            <div className="max-w-2xl space-y-8">
              <div className="space-y-6">
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-ipe-navy tracking-tight leading-[1.05]">
                  Join Ipê City
                  <br />
                  <span className="text-ipe-blue">Platform</span>
                </h1>

                <p className="font-body text-xl sm:text-2xl font-medium text-ipe-navy/70 leading-relaxed max-w-lg">
                  Your interface with the physical and onchain world.
                </p>
              </div>

              <p className="font-body text-base sm:text-lg text-ipe-navy/50 leading-relaxed max-w-lg">
                Manage your passport, events, tokens, reputation, opportunities, and
                collaborations — all in one place.
              </p>

              {/* CTA */}
              <div className="pt-4">
                <button
                  onClick={() => login()}
                  className="group inline-flex items-center gap-3 bg-ipe-navy hover:bg-ipe-navy/90 text-white font-body font-medium pl-8 pr-6 py-4 text-lg rounded-full transition-all duration-200 hover:shadow-lg hover:shadow-ipe-navy/20"
                >
                  Sign In / Sign Up
                  <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="px-6 sm:px-10 py-6 flex items-center justify-between">
            <p className="font-body text-sm text-ipe-navy/30">
              &copy; 2026 Ipê City
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-ipe-lime" />
              <div className="w-2 h-2 rounded-full bg-ipe-blue" />
              <div className="w-2 h-2 rounded-full bg-ipe-navy" />
            </div>
          </footer>
        </div>
      </div>
    );
  }

  // For authenticated users who haven't been redirected, show a loading state
  return (
    <div className="min-h-screen bg-ipe-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ipe-navy"></div>
    </div>
  );
}
