import { SignInButton } from "@farcaster/auth-kit";
import { Link, useLocation } from "wouter";
import { usePersistentAuth, logout } from "@/hooks/use-persistent-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const [location] = useLocation();
  
  const isAdmin = profile?.fid === 1109894; // Admin FID
  
  // Check member status to determine if user is in verification process
  const { data: memberCheck } = useQuery({
    queryKey: [`/api/members/check/${profile?.fid}`],
    enabled: Boolean(isAuthenticated && profile?.fid),
  });
  
  const memberStatus = (memberCheck as any)?.status;
  const isInVerificationProcess = Boolean(isAuthenticated && memberStatus && !['active_member'].includes(memberStatus));
  
  // Don't render navigation until auth is determined
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { path: "/", label: "Pulses", showWhen: "member" },
    { path: "/admin", label: "Admin", showWhen: "admin" },
  ];

  const shouldShowNavItem = (item: typeof navItems[0]) => {
    // Hide navigation items if user is in verification process
    if (isInVerificationProcess) return false;
    
    if (item.showWhen === "always") return true;
    if (item.showWhen === "member" && isAuthenticated) return true;
    if (item.showWhen === "admin" && isAdmin) return true;
    return false;
  };

  return (
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full flex items-center justify-between mb-12 px-4">
        <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-purple-600 transition-colors">
          Ipê City
        </Link>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated && !isInVerificationProcess && (
            <nav className="flex space-x-1">
              {navItems.filter(shouldShowNavItem).map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                    location === item.path
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:text-purple-600 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Hello, {profile?.displayName || profile?.username || '?'}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                    {profile?.pfpUrl ? (
                      <img 
                        src={profile.pfpUrl} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 text-sm font-semibold">
                          {(profile?.displayName || profile?.username || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <SignInButton />
          )}
        </div>
      </header>
      
      <div className="w-full flex flex-col items-center">
        {children}
      </div>
    </main>
  );
}