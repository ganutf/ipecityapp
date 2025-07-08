import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEnsLookup } from "@/hooks/useEnsLookup";
import { 
  User, 
  Mail, 
  Globe, 
  Edit3, 
  Save, 
  X, 
  CheckCircle, 
  AlertCircle,
  Wallet,
  Shield,
  Twitter,
  Linkedin,
  Instagram
} from "lucide-react";
import * as z from "zod";

interface MemberData {
  isMember: boolean;
  status?: string;
  member?: {
    email?: string;
    emailVerified?: boolean;
    ipePassport?: string;
    bio?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    profileTags?: string[];
    profileCompleted?: boolean;
  };
}

const profileSchema = z.object({
  bio: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  profileTags: z.array(z.string()).optional(),
});

const AVAILABLE_TAGS = [
  "Developer", "Designer", "Builder", "Community", "DeFi", "NFTs", 
  "Gaming", "Art", "Music", "Writing", "Investing", "Trading"
];

export default function ProfileMockupPage() {
  const { profile } = usePersistentAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { ensName, isLoading: ensLoading } = useEnsLookup(address);

  // Edit mode states
  const [editingBio, setEditingBio] = useState(false);
  const [editingSocial, setEditingSocial] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [editingVerification, setEditingVerification] = useState(false);

  // Form states
  const [bioValue, setBioValue] = useState("");
  const [twitterValue, setTwitterValue] = useState("");
  const [linkedinValue, setLinkedinValue] = useState("");
  const [instagramValue, setInstagramValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [emailValue, setEmailValue] = useState("");
  
  // Fake simulation states
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isWalletDisconnected, setIsWalletDisconnected] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Fake data for mockup
  const memberData: MemberData = {
    isMember: true,
    status: "active_member",
    member: {
      email: "alex.santos@example.com",
      emailVerified: true,
      ipePassport: "alex.ipecity.eth",
      bio: "Passionate builder in the web3 space. Love creating decentralized applications and contributing to open source projects. Always learning and exploring new technologies.",
      twitter: "@alexsantos",
      linkedin: "linkedin.com/in/alexsantos",
      instagram: "@alexcreates",
      profileTags: ["Developer", "Builder", "DeFi", "Community"],
      profileCompleted: true,
    }
  };

  // Initialize form values with fake data
  useEffect(() => {
    setBioValue(memberData.member?.bio || "");
    setTwitterValue(memberData.member?.twitter || "");
    setLinkedinValue(memberData.member?.linkedin || "");
    setInstagramValue(memberData.member?.instagram || "");
    setSelectedTags(memberData.member?.profileTags || []);
    setEmailValue(memberData.member?.email || "");
  }, []);

  // Check verification statuses (using fake data)
  const isEmailVerified = !isVerificationSent; // If we sent verification, show as pending
  const hasIpeCityDomain = true;
  const isPassportVerified = true;

  // Fake profile data for mockup
  const fakeProfile = profile || {
    fid: 12345,
    username: "alexsantos",
    displayName: "Alex Santos",
    pfpUrl: "",
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header with Profile Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {fakeProfile.displayName || fakeProfile.username}
                  </h1>
                  <p className="text-purple-600 font-medium">alex.ipecity.eth</p>
                  <p className="text-sm text-gray-500">ID: {fakeProfile.fid}</p>
                </div>
              </div>
              
              {/* Wallet Status */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${
                  !isWalletDisconnected 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <Wallet className={`h-4 w-4 ${!isWalletDisconnected ? 'text-blue-600' : 'text-gray-400'}`} />
                  <button
                    onClick={() => {
                      if (!isWalletDisconnected) {
                        setIsWalletDisconnected(true);
                        toast({
                          title: "Wallet disconnected",
                          description: "Your wallet has been disconnected successfully.",
                        });
                      } else {
                        setIsWalletDisconnected(false);
                        toast({
                          title: "Wallet connected",
                          description: "Your wallet has been connected successfully.",
                        });
                      }
                    }}
                    className={`text-sm font-mono hover:underline transition-colors ${
                      !isWalletDisconnected ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  >
                    {!isWalletDisconnected ? '0x7582...ECFf' : 'Connect Wallet'}
                  </button>
                  {!isWalletDisconnected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">About</CardTitle>
              {!editingBio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingBio(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingBio ? (
              <div className="space-y-3">
                <Textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="min-h-[100px]"
                />
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => {
                    // Save bio logic here
                    setEditingBio(false);
                  }}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setBioValue(memberData?.member?.bio || "");
                      setEditingBio(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-gray-700">
                Passionate builder in the web3 space. Love creating decentralized applications and contributing to open source projects. Always learning and exploring new technologies.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Social Links</CardTitle>
              {!editingSocial && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingSocial(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingSocial ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="twitter" className="flex items-center space-x-1">
                    <Twitter className="h-4 w-4" />
                    <span>Twitter</span>
                  </Label>
                  <Input
                    id="twitter"
                    value={twitterValue}
                    onChange={(e) => setTwitterValue(e.target.value)}
                    placeholder="@username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin" className="flex items-center space-x-1">
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn</span>
                  </Label>
                  <Input
                    id="linkedin"
                    value={linkedinValue}
                    onChange={(e) => setLinkedinValue(e.target.value)}
                    placeholder="linkedin.com/in/username"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="instagram" className="flex items-center space-x-1">
                    <Instagram className="h-4 w-4" />
                    <span>Instagram</span>
                  </Label>
                  <Input
                    id="instagram"
                    value={instagramValue}
                    onChange={(e) => setInstagramValue(e.target.value)}
                    placeholder="@username"
                    className="mt-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => {
                    // Save social links logic here
                    setEditingSocial(false);
                  }}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setTwitterValue(memberData?.member?.twitter || "");
                      setLinkedinValue(memberData?.member?.linkedin || "");
                      setInstagramValue(memberData?.member?.instagram || "");
                      setEditingSocial(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className={`h-4 w-4 ${isEmailVerified ? 'text-green-600' : 'text-yellow-600'}`} />
                  <span className="text-sm">alex.santos@example.com</span>
                  <Badge variant="secondary" className={isEmailVerified ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                    {isEmailVerified ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Twitter className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">@alexsantos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Linkedin className="h-4 w-4 text-blue-700" />
                  <span className="text-sm">linkedin.com/in/alexsantos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  <span className="text-sm">@alexcreates</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>



        {/* Profile Tags */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Interests & Skills</CardTitle>
              {!editingTags && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTags(true)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingTags ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {AVAILABLE_TAGS.map((tag) => (
                    <label key={tag} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTags([...selectedTags, tag]);
                          } else {
                            setSelectedTags(selectedTags.filter(t => t !== tag));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{tag}</span>
                    </label>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" onClick={() => {
                    // Save tags logic here
                    setEditingTags(false);
                  }}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setSelectedTags(memberData.member?.profileTags || []);
                      setEditingTags(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Developer</Badge>
                <Badge variant="secondary">Builder</Badge>
                <Badge variant="secondary">DeFi</Badge>
                <Badge variant="secondary">Community</Badge>
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </div>
  );
}