import { SignInButton } from "@farcaster/auth-kit";
import { Link, useLocation } from "wouter";
import { usePersistentAuth, logout } from "@/hooks/use-persistent-auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const [location] = useLocation();
  
  const isAdmin = profile?.fid === 2790; // Jean Hansen's FID
  
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
          
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Hello, {profile?.displayName || profile?.username || '?'}
              </span>
              <span className="text-xs text-gray-400 ml-2">
                (FID: {profile?.fid || 'none'})
              </span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                {profile?.pfpUrl ? (
                  <img 
                    src={profile.pfpUrl} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-purple-600 text-sm font-semibold">
                    {(profile?.displayName || profile?.username || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <SignInButton />
              <button
                onClick={() => {
                  try {
                    const testData = {
                      fid: 2790,
                      username: "jhansen",
                      displayName: "Jean Hansen",
                      pfpUrl: "",
                      custodyAddress: "",
                      timestamp: Date.now()
                    };
                    console.log('🧪 Manual test auth:', testData);
                    console.log('🧪 Attempting to save to localStorage...');
                    localStorage.setItem('farcaster_auth_data', JSON.stringify(testData));
                    console.log('🧪 Save completed');
                    
                    // Immediately verify
                    const verify = localStorage.getItem('farcaster_auth_data');
                    console.log('🧪 Verification check:', verify ? 'SUCCESS' : 'FAILED');
                    
                    if (verify) {
                      console.log('🧪 Reloading page...');
                      window.location.reload();
                    } else {
                      console.error('❌ localStorage save failed!');
                      alert('localStorage save failed - check console for details');
                    }
                  } catch (error) {
                    console.error('💥 localStorage error:', error);
                    alert('localStorage error: ' + error.message);
                  }
                }}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
              >
                Test
              </button>
              <button
                onClick={() => {
                  const stored = localStorage.getItem('farcaster_auth_data');
                  console.log('🔍 Direct localStorage check:', stored);
                  console.log('🔍 All localStorage keys:', Object.keys(localStorage));
                  if (stored) {
                    const parsed = JSON.parse(stored);
                    console.log('📋 Parsed data:', parsed);
                  } else {
                    console.log('❌ No data found in localStorage');
                  }
                }}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                Check
              </button>
            </div>
          )}
        </div>
      </header>
      
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </main>
  );
}