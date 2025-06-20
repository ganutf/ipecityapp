import { useState } from "react";
import {
  NeynarAuthButton,
  NeynarCastCard,
  useNeynarContext,
} from "@neynar/react";
import { SignInButton, useProfile } from "@farcaster/auth-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Radio, 
  User, 
  Shield, 
  Zap, 
  Smartphone, 
  Code, 
  Settings, 
  Check,
  Heart,
  RefreshCw,
  MessageCircle,
  Share,
  Info,
  Lock,
  ArrowUp,
  Key,
  Search,
  Loader2
} from "lucide-react";

export default function FarcasterEmbed() {
  const { isAuthenticated, profile } = useProfile();
  const { user: neynarUser } = useNeynarContext();
  const viewerFid = profile?.fid;

  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<null | { liked: boolean; recasted: boolean }>(null);

  async function handleCheck() {
    if (!url) return;
    setChecking(true);

    try {
      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(
          url
        )}&type=url&viewer_fid=${viewerFid}`,
        { headers: { "x-api-key": "NEYNAR_API_DOCS" } }
      );
      const { cast } = await res.json();
      setStats({
        liked: !!cast.viewer_context?.liked,
        recasted: !!cast.viewer_context?.recasted,
      });
    } catch (error) {
      console.error("Error fetching cast:", error);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[var(--farcaster-purple)] rounded-lg flex items-center justify-center">
                <Radio className="text-white text-sm" size={16} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Farcaster Embed</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <SignInButton />
            </div>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Embed & Interact with Farcaster Posts
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Paste any Warpcast or Farcaster URL to view, like, and recast posts directly from your application.
            </p>
          </div>

          {/* Post Tool */}
          <div className="max-w-2xl mx-auto">
            
            {/* Authentication Required State */}
            {!isAuthenticated && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6 text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="text-blue-600" size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Required</h3>
                <p className="text-gray-600 mb-4">Please sign in with Farcaster to start embedding and interacting with posts.</p>
                <div className="text-sm text-gray-500 flex items-center justify-center">
                  <ArrowUp className="text-blue-500 mr-1" size={16} />
                  <span>Click "Sign In with Farcaster" above</span>
                </div>
              </div>
            )}

            {/* Main Tool Interface */}
            {isAuthenticated && (
              <Card className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                
                {/* Neynar Authentication Section */}
                <div className="p-6 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Enable Post Interactions
                      </h3>
                      <p className="text-sm text-gray-600">
                        Connect with Neynar to like and recast posts
                      </p>
                    </div>
                    <NeynarAuthButton primary className="bg-[var(--farcaster-purple)] hover:bg-[var(--farcaster-purple-dark)] text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2" />
                  </div>
                </div>

                {/* URL Input Section */}
                <CardContent className="p-6">
                  <label htmlFor="postUrl" className="block text-sm font-medium text-gray-700 mb-2">
                    Farcaster Post URL
                  </label>
                  <div className="flex space-x-3">
                    <Input
                      id="postUrl"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://warpcast.com/username/0x..."
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[var(--farcaster-purple)] focus:border-transparent transition-colors duration-200"
                    />
                    <Button
                      onClick={handleCheck}
                      disabled={!url || checking}
                      className="bg-[var(--farcaster-purple)] hover:bg-[var(--farcaster-purple-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 whitespace-nowrap"
                    >
                      {checking ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                      <span>{checking ? 'Fetching...' : 'Fetch Post'}</span>
                    </Button>
                  </div>
                  
                  {/* Helper Text */}
                  <div className="mt-3 text-sm text-gray-500">
                    <div className="flex items-start space-x-2">
                      <Info className="mt-0.5 text-blue-500" size={16} />
                      <div>
                        <p className="mb-1">Supports URLs from:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>warpcast.com</li>
                          <li>farcaster.xyz</li>
                          <li>Direct cast hashes</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Status Section */}
                  {stats && (
                    <div className="mt-6 px-6 py-4 bg-gray-50 border border-gray-100 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Your Engagement Status</h4>
                      <div className="flex space-x-6">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                            <Heart className={stats.liked ? "text-red-500 fill-current" : "text-gray-400"} size={16} />
                          </div>
                          <span className="text-sm text-gray-600">
                            {stats.liked ? 'Liked' : 'Not liked'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <RefreshCw className={stats.recasted ? "text-green-500" : "text-gray-400"} size={16} />
                          </div>
                          <span className="text-sm text-gray-600">
                            {stats.recasted ? 'Recasted' : 'Not recasted'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Post Embed Section */}
                  {url && (
                    <div className="mt-6 border-t border-gray-100 pt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-4">Post Preview</h4>
                      
                      <NeynarCastCard
                        type="url"
                        identifier={url}
                        viewerFid={viewerFid}
                        signerUuid={import.meta.env.VITE_NEYNAR_SIGNER_UUID}
                        allowReactions
                      />
                      
                      {/* Real-time Update Notice */}
                      <Alert className="mt-4 border-blue-200 bg-blue-50">
                        <Info className="h-4 w-4 text-blue-500" />
                        <AlertDescription className="text-blue-700">
                          Reactions will update in real-time after interacting with the post
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Features Section */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="text-purple-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Authentication</h3>
              <p className="text-gray-600">
                Connect securely using Farcaster's Auth Kit and Neynar's authentication system
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="text-green-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Interactions</h3>
              <p className="text-gray-600">
                Like and recast posts instantly with immediate feedback and status updates
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Smartphone className="text-blue-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Responsive Design</h3>
              <p className="text-gray-600">
                Optimized for all devices with a clean, modern interface that works everywhere
              </p>
            </div>
          </div>

          {/* Technical Details Section */}
          <div className="mt-16 bg-gray-900 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-6">Technical Implementation</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-4 text-purple-300 flex items-center">
                  <Code className="mr-2" size={20} />
                  Built With
                </h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>React + TypeScript</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>@farcaster/auth-kit</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>@neynar/react components</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>Tailwind CSS</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4 text-purple-300 flex items-center">
                  <Settings className="mr-2" size={20} />
                  Features
                </h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>Decentralized authentication</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>Post embedding & interaction</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>Real-time engagement tracking</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="text-green-400" size={16} />
                    <span>Error handling & loading states</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 flex items-center justify-center">
            Built with <Heart className="text-red-500 mx-1 fill-current" size={16} /> for the Farcaster ecosystem
          </p>
        </div>
      </footer>
    </div>
  );
}
