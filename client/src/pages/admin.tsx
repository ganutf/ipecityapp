import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@farcaster/auth-kit";
import type { Pulse, Member } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";

export default function AdminPage() {
  const { isAuthenticated, profile } = useProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check if user is admin (jean hansen)
  const isAdmin = profile?.username === "jeanhansen" || profile?.displayName?.toLowerCase().includes("jean hansen");

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setCsvData("");
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
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Expected headers: farcasterFid, farcasterUsername, name, ipePassport
      const members = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          farcasterFid: parseInt(values[0]),
          farcasterUsername: values[1] || null,
          name: values[2],
          ipePassport: values[3] || null,
          approved: true
        };
      });

      importMembersMutation.mutate(members);
    } catch (error) {
      alert("Error parsing CSV. Please check the format.");
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
              {pulsesData?.pulses?.map((pulse: Pulse) => (
                <div key={pulse.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{pulse.description}</h3>
                      <p className="text-sm text-gray-600">Date: {pulse.date}</p>
                      <p className="text-sm text-gray-600">
                        URL: <a href={pulse.farcasterUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {pulse.farcasterUrl}
                        </a>
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded ${
                      new Date(pulse.date) < new Date() ? 'bg-gray-100 text-gray-800' :
                      new Date(pulse.date).toDateString() === new Date().toDateString() ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {new Date(pulse.date) < new Date() ? 'Past' :
                       new Date(pulse.date).toDateString() === new Date().toDateString() ? 'Today' :
                       'Future'}
                    </span>
                  </div>
                </div>
              ))}
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