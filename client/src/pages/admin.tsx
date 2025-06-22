import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Pulse, Member } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistentAuth } from "@/hooks/use-persistent-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";

export default function AdminPage() {
  const { isAuthenticated, profile, isLoading } = usePersistentAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize all state hooks first (must be at top level)
  const [newPulse, setNewPulse] = useState({
    farcasterUrl: "",
    date: "",
    description: "",
  });

  const [csvData, setCsvData] = useState("");
  const [editingPulse, setEditingPulse] = useState<number | null>(null);
  const [editData, setEditData] = useState({
    farcasterUrl: "",
    date: "",
    description: "",
  });

  // Check if user is admin (FID 2790)
  const isAdmin = profile?.fid === 2790;

  // Show loading while auth is initializing
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Access Restricted</h2>
        <p className="text-gray-600">Admin access required.</p>
      </div>
    );
  }

  // Fetch all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch all members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/members"],
    enabled: isAuthenticated && isAdmin,
  });

  // Create pulse mutation
  const createPulseMutation = useMutation({
    mutationFn: async (pulseData: any) => {
      const response = await fetch('/api/pulses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pulseData,
          createdBy: profile?.username || profile?.displayName || 'admin'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pulse');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setNewPulse({ farcasterUrl: "", date: "", description: "" });
    },
  });

  // Update pulse mutation
  const updatePulseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/pulses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update pulse');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setEditingPulse(null);
      toast({
        title: "Success",
        description: "Pulse updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import members mutation
  const importMembersMutation = useMutation({
    mutationFn: async (members: any[]) => {
      const response = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import members');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setCsvData("");
      toast({
        title: "Success",
        description: `Successfully imported ${data.members?.length || 0} members`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreatePulse = () => {
    if (!newPulse.farcasterUrl || !newPulse.date || !newPulse.description) {
      alert("Please fill in all fields");
      return;
    }
    createPulseMutation.mutate(newPulse);
  };

  const handleEditStart = (pulse: Pulse) => {
    setEditingPulse(pulse.id);
    setEditData({
      farcasterUrl: pulse.farcasterUrl,
      date: pulse.date,
      description: pulse.description,
    });
  };

  const handleEditCancel = () => {
    setEditingPulse(null);
    setEditData({ farcasterUrl: "", date: "", description: "" });
  };

  const handleEditSave = () => {
    if (editingPulse) {
      updatePulseMutation.mutate({
        id: editingPulse,
        data: editData,
      });
    }
  };

  const isFuturePulse = (pulse: Pulse) => {
    const today = new Date();
    const pulseDate = new Date(pulse.date + 'T00:00:00');
    today.setHours(0, 0, 0, 0);
    pulseDate.setHours(0, 0, 0, 0);
    return pulseDate > today;
  };

  const handleImportCSV = () => {
    try {
      if (!csvData.trim()) {
        toast({
          title: "Error",
          description: "Please enter CSV data",
          variant: "destructive",
        });
        return;
      }

      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        toast({
          title: "Error", 
          description: "CSV must contain at least a header and one data row",
          variant: "destructive",
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      
      // Validate required headers
      const requiredHeaders = ['farcasterFid', 'farcasterUsername', 'name', 'ipePassport'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast({
          title: "Error",
          description: `Missing required headers: ${missingHeaders.join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      const members = lines.slice(1)
        .filter(line => line.trim()) // Skip empty lines
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const memberData: any = {};
          
          headers.forEach((header, index) => {
            memberData[header] = values[index] || null;
          });

          // Convert farcasterFid to number
          const farcasterFid = parseInt(memberData.farcasterFid);
          if (isNaN(farcasterFid)) {
            throw new Error(`Invalid farcasterFid: ${memberData.farcasterFid}`);
          }

          return {
            farcasterFid,
            farcasterUsername: memberData.farcasterUsername || null,
            name: memberData.name,
            ipePassport: memberData.ipePassport || null,
            approved: true
          };
        });

      if (members.length === 0) {
        toast({
          title: "Error",
          description: "No valid member data found in CSV",
          variant: "destructive",
        });
        return;
      }

      console.log('Importing members:', members);
      importMembersMutation.mutate(members);
    } catch (error) {
      console.error('CSV import error:', error);
      toast({
        title: "Error",
        description: error.message || "Error parsing CSV. Please check the format.",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to access admin panel.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage pulses and community members</p>
      </header>

        {/* Create New Pulse */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Pulse</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Farcaster URL
              </label>
              <input
                type="url"
                value={newPulse.farcasterUrl}
                onChange={(e) => setNewPulse(prev => ({ ...prev, farcasterUrl: e.target.value }))}
                placeholder="https://warpcast.com/username/cast-hash"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <input
                type="date"
                value={newPulse.date}
                onChange={(e) => setNewPulse(prev => ({ ...prev, date: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={newPulse.description}
              onChange={(e) => setNewPulse(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the engagement task..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleCreatePulse}
            disabled={createPulseMutation.isPending}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {createPulseMutation.isPending ? "Creating..." : "Create Pulse"}
          </button>
        </div>

        {/* Import Members */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Import Members (CSV)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Format: farcasterFid,farcasterUsername,name,ipePassport
          </p>
          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="2790,jeanhansen,Jean Hansen,jean.ipecity.eth"
            rows={6}
            className="w-full border rounded-lg px-3 py-2 mb-4"
          />
          <button
            onClick={handleImportCSV}
            disabled={importMembersMutation.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {importMembersMutation.isPending ? "Importing..." : "Import Members"}
          </button>
        </div>

        {/* Pulses List */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">All Pulses</h2>
          {pulsesLoading ? (
            <p>Loading pulses...</p>
          ) : (
            <div className="space-y-4">
              {pulsesData?.pulses?.map((pulse: Pulse) => {
                const isEditing = editingPulse === pulse.id;
                const isFuture = isFuturePulse(pulse);
                
                return (
                  <div key={pulse.id} className="border rounded-lg p-4">
                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <Textarea
                            value={editData.description}
                            onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <Input
                              type="date"
                              value={editData.date}
                              onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Farcaster URL</label>
                            <Input
                              type="url"
                              value={editData.farcasterUrl}
                              onChange={(e) => setEditData(prev => ({ ...prev, farcasterUrl: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleEditSave} disabled={updatePulseMutation.isPending} size="sm">
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button onClick={handleEditCancel} variant="outline" size="sm">
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold">{pulse.description}</h4>
                            <p className="text-sm text-gray-600">
                              Date: {new Date(pulse.date + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-gray-600">
                              URL: <a href={pulse.farcasterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {pulse.farcasterUrl}
                              </a>
                            </p>
                            <p className="text-xs text-gray-500">Created by: {pulse.createdBy}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded ${
                              !isFuture && new Date(pulse.date + 'T00:00:00').toDateString() !== new Date().toDateString() ? 'bg-gray-100 text-gray-800' :
                              new Date(pulse.date + 'T00:00:00').toDateString() === new Date().toDateString() ? 'bg-green-100 text-green-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {!isFuture && new Date(pulse.date + 'T00:00:00').toDateString() !== new Date().toDateString() ? 'Past' :
                               new Date(pulse.date + 'T00:00:00').toDateString() === new Date().toDateString() ? 'Today' :
                               'Future'}
                            </span>
                            {isFuture && (
                              <Button onClick={() => handleEditStart(pulse)} variant="outline" size="sm">
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>
                        {!isFuture && new Date(pulse.date + 'T00:00:00').toDateString() !== new Date().toDateString() && (
                          <p className="text-xs text-orange-600 mt-1">Past pulse - editing disabled</p>
                        )}
                        {new Date(pulse.date + 'T00:00:00').toDateString() === new Date().toDateString() && (
                          <p className="text-xs text-orange-600 mt-1">Current pulse - editing disabled</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {pulsesData?.pulses?.length === 0 && (
                <p className="text-gray-500 text-center py-8">No pulses created yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Members List */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Community Members ({membersData?.members?.length || 0})</h2>
          {membersLoading ? (
            <p>Loading members...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">FID</th>
                    <th className="text-left py-2">Username</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Ipê Passport</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {membersData?.members?.map((member: Member) => (
                    <tr key={member.id} className="border-b">
                      <td className="py-2">{member.farcasterFid}</td>
                      <td className="py-2">{member.farcasterUsername || '-'}</td>
                      <td className="py-2">{member.name}</td>
                      <td className="py-2">{member.ipePassport || '-'}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          member.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {member.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {membersData?.members?.length === 0 && (
                <p className="text-gray-500 text-center py-8">No members imported yet.</p>
              )}
            </div>
          )}
        </div>
    </div>
  );
}