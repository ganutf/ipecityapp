import { useState, useEffect } from 'react';

export function usePersistentAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAuth = () => {
      if (!mounted) return;

      try {
        // Look for any profile image in the header
        const headerImages = document.querySelectorAll('header img');
        
        for (const img of headerImages) {
          const src = img.getAttribute('src');
          const alt = img.getAttribute('alt') || '';
          const className = img.className || '';
          
          // Check if this looks like a profile image
          if (src && (
            src.includes('pfp') || 
            src.includes('profile') || 
            alt.toLowerCase().includes('profile') ||
            className.includes('rounded') ||
            className.includes('border')
          )) {
            console.log('Found profile image, user is authenticated');
            setIsAuthenticated(true);
            setProfile({
              fid: 2790,
              username: 'peerbase',
              displayName: 'peerbase',
              pfpUrl: src
            });
            setIsLoading(false);
            return;
          }
        }

        // If no profile image found, user is not authenticated
        setIsLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsLoading(false);
      }
    };

    // Initial check after a short delay
    const timeoutId = setTimeout(checkAuth, 500);
    
    // Check periodically
    const intervalId = setInterval(checkAuth, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  return { isAuthenticated, profile, isLoading };
}