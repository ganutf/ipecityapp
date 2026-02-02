import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

export function PrivyLoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <Button disabled variant="outline" size="sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (authenticated && user) {
    const displayName = user.email?.address ||
      user.wallet?.address?.slice(0, 6) + '...' + user.wallet?.address?.slice(-4) ||
      'Connected';

    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{displayName}</span>
        <Button onClick={logout} variant="outline" size="sm">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={login} variant="default" size="sm">
      <LogIn className="h-4 w-4 mr-2" />
      Sign In
    </Button>
  );
}
