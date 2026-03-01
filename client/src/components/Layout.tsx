import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coins } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, member, isLoading, logout, login } = useAuth();
  const [location] = useLocation();

  // IPE balance from backend (passport wallet only)
  const ipeBalance = member?.ipeBalance || '0';

  // Check if user is admin based on memberType
  const isAdmin = member?.memberType === 'admin';

  const memberStatus = member?.status;
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
    { path: "/community", label: "Community", showWhen: "member" },
    { path: "/pulses", label: "Pulses", showWhen: "member" },
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
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="w-full max-w-4xl flex items-center justify-between mb-12">
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
              {/* IPE Token Balance (from backend, passport wallet) */}
              {member?.walletAddress && (
                <div className="flex items-center space-x-2 bg-lime-50 px-3 py-1.5 rounded-full border border-lime-200">
                  <Coins className="h-4 w-4 text-lime-600" />
                  <span className="text-sm font-semibold text-lime-900">
                    {`${ipeBalance} IPE`}
                  </span>
                </div>
              )}

              <span className="text-sm text-gray-600">
                Hello, {member?.ipeUsername || member?.email?.split('@')[0] || 'User'}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600 text-sm font-semibold">
                        {(member?.email?.split('@')[0] || 'U')[0].toUpperCase()}
                      </span>
                    </div>
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
            <Button onClick={login} variant="default">
              Sign In
            </Button>
          )}
        </div>
      </header>
      
      <div className="w-full max-w-4xl flex flex-col items-center">
        {children}
      </div>
    </main>
  );
}