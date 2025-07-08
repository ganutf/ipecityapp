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
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-3 md:px-4 space-y-4 md:space-y-6">
        {/* Header with Profile Info */}
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center space-x-3 md:space-x-4">
                <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                    {fakeProfile.displayName || fakeProfile.username}
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">ID: {fakeProfile.fid}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-2">
                <div className={`flex items-center space-x-2 px-2 md:px-3 py-1.5 rounded-lg border ${
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
                    className={`text-xs md:text-sm font-mono hover:underline transition-colors ${
                      !isWalletDisconnected ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  >
                    {!isWalletDisconnected ? '0x7582...ECFf' : 'Connect Wallet'}
                  </button>
                  {!isWalletDisconnected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs hidden md:inline-flex">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
                
                <div className="inline-block px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <p className="text-purple-600 font-medium text-sm">alex.ipecity.eth</p>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Passport wallet: 0x7582...ECFf
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base md:text-lg">About</CardTitle>
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
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <Button size="sm" onClick={() => {
                    // Save bio logic here
                    setEditingBio(false);
                  }} className="flex-1 sm:flex-none">
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setBioValue(memberData.member?.bio || "");
                      setEditingBio(false);
                    }}
                    className="flex-1 sm:flex-none"
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
              <CardTitle className="text-base md:text-lg">Social Links</CardTitle>
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
                {/* Email Section */}
                <div>
                  <Label htmlFor="email" className="flex items-center space-x-1">
                    <Mail className="h-4 w-4" />
                    <span>Email Address</span>
                  </Label>
                  <div className="flex space-x-2 mt-1">
                    <Input
                      id="email"
                      value={emailValue}
                      onChange={(e) => setEmailValue(e.target.value)}
                      placeholder="your.email@example.com"
                      className="flex-1"
                    />
                    {!isVerificationSent ? (
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={isSendingVerification}
                        onClick={() => {
                          setIsSendingVerification(true);
                          // Simulate API call
                          setTimeout(() => {
                            setIsSendingVerification(false);
                            setIsVerificationSent(true);
                            toast({
                              title: "Verification email sent!",
                              description: "Check your inbox for the verification code.",
                            });
                          }, 1500);
                        }}
                      >
                        {isSendingVerification ? "Sending..." : "Send Verification"}
                      </Button>
                    ) : null}
                  </div>
                  
                  {/* Verification Code Input */}
                  {isVerificationSent && (
                    <div className="mt-3 p-3 bg-blue-50 rounded border">
                      <Label htmlFor="verificationCode" className="text-sm font-medium">
                        Enter 6-digit verification code:
                      </Label>
                      <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-2 mt-2">
                        <Input
                          id="verificationCode"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          className="flex-1"
                        />
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            disabled={isVerifyingCode || verificationCode.length !== 6}
                            onClick={() => {
                              setIsVerifyingCode(true);
                              setTimeout(() => {
                                setIsVerifyingCode(false);
                                setIsVerificationSent(false);
                                setVerificationCode("");
                                toast({
                                  title: "Email verified!",
                                  description: "Your email address has been successfully verified.",
                                });
                              }, 1000);
                            }}
                            className="flex-1 md:flex-none"
                          >
                            {isVerifyingCode ? "Verifying..." : "Confirm"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled={isSendingVerification}
                            onClick={() => {
                              setIsSendingVerification(true);
                              setVerificationCode("");
                              setTimeout(() => {
                                setIsSendingVerification(false);
                                toast({
                                  title: "New code sent!",
                                  description: "A new verification code has been sent to your email.",
                                });
                              }, 1500);
                            }}
                            className="flex-1 md:flex-none"
                          >
                            {isSendingVerification ? "Sending..." : "Resend"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
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
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <Button size="sm" onClick={() => {
                    // Save social links logic here
                    setEditingSocial(false);
                  }} className="flex-1 sm:flex-none">
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setEmailValue(memberData.member?.email || "");
                      setIsVerificationSent(false);
                      setVerificationCode("");
                      setTwitterValue(memberData?.member?.twitter || "");
                      setLinkedinValue(memberData?.member?.linkedin || "");
                      setInstagramValue(memberData?.member?.instagram || "");
                      setEditingSocial(false);
                    }}
                    className="flex-1 sm:flex-none"
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
              <CardTitle className="text-base md:text-lg">Interests & Skills</CardTitle>
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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