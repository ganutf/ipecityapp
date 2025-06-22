import { SignInButton, useProfile } from "@farcaster/auth-kit";
import { Link, useLocation } from "wouter";
import { useServerAuth } from "@/hooks/use-persistent-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: serverAuth, profile: serverProfile } = useServerAuth();
  const { isAuthenticated: kitAuth } = useProfile();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  
  // Use server auth state if available
  const isAuthenticated = serverAuth || kitAuth;
  const profile = serverProfile;
  
  const isAdmin = profile?.fid === 2790; // Jean Hansen's FID

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/session'] });
      window.location.reload(); // Full reload to clear AuthKit state
    },
  });

  const navItems = [
    { path: "/", label: "Pulses", showWhen: "member" },
    { path: "/admin", label: "Admin", showWhen: "admin" },
  ];

  const shouldShowNavItem = (item: typeof navItems[0]) => {
    if (item.showWhen === "always") return true;
    if (item.showWhen === "member" && isAuthenticated) return true;
    if (item.showWhen === "admin" && isAdmin) return true;
    return false;
  };

  return (
    <main className="font-sans min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <header className="w-full max-w-4xl flex items-center justify-between mb-6">
        <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-purple-600 transition-colors">
          Ipê City Pulse
        </Link>
        
        <div className="flex items-center space-x-4">
          {isAuthenticated && (
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
          
          {isAuthenticated && profile?.pfpUrl ? (
            <SignInButton>
              <img 
                src={profile.pfpUrl} 
                alt={profile.displayName || profile.username || 'Profile'}
                className="w-10 h-10 rounded-full border-2 border-purple-600 cursor-pointer hover:border-purple-700 transition-colors"
              />
            </SignInButton>
          ) : (
            <SignInButton />
          )}
        </div>
      </header>
      
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </main>
  );
}