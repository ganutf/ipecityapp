import { useState } from "react";
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

  // Fetch all pulses - must be called before any returns
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch all members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/members"],
    enabled: isAuthenticated && isAdmin,
  });

  // All mutations must also be declared before returns
  const createPulseMutation = useMutation({
    mutationFn: async (pulse: { farcasterUrl: string; date: string; description: string }) => {
      const response = await fetch("/api/pulses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pulse),
      });
      if (!response.ok) throw new Error("Failed to create pulse");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setNewPulse({ farcasterUrl: "", date: "", description: "" });
      toast({ title: "Success", description: "Pulse created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePulseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { farcasterUrl: string; date: string; description: string } }) => {
      const response = await fetch(`/api/pulses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update pulse");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pulses"] });
      setEditingPulse(null);
      toast({ title: "Success", description: "Pulse updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const importMembersMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await fetch("/api/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to import members");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setCsvData("");
      toast({ 
        title: "Success", 
        description: `Imported ${data.imported} members, skipped ${data.skipped} duplicates` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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

  // Helper functions
  const handleEditStart = (pulse: Pulse) => {
    setEditingPulse(pulse.id);
    setEditData({
      farcasterUrl: pulse.farcasterUrl,
      date: pulse.date,
      description: pulse.description,
    });
  };

  const isFuturePulse = (pulse: Pulse) => {
    const today = new Date().toISOString().split('T')[0];
    return pulse.date > today;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="space-y-8">
        {/* Create Pulse Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Pulse</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            createPulseMutation.mutate(newPulse);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Farcaster URL
              </label>
              <Input
                type="url"
                value={newPulse.farcasterUrl}
                onChange={(e) => setNewPulse({ ...newPulse, farcasterUrl: e.target.value })}
                placeholder="https://farcaster.xyz/..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <Input
                type="date"
                value={newPulse.date}
                onChange={(e) => setNewPulse({ ...newPulse, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Textarea
                value={newPulse.description}
                onChange={(e) => setNewPulse({ ...newPulse, description: e.target.value })}
                placeholder="Enter pulse description..."
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={createPulseMutation.isPending}
              className="w-full"
            >
              {createPulseMutation.isPending ? "Creating..." : "Create Pulse"}
            </Button>
          </form>
        </div>

        {/* Import Members Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Import Members</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            importMembersMutation.mutate(csvData);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CSV Data
              </label>
              <Textarea
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="farcaster_fid,farcaster_username,name,ipe_passport,approved&#10;2790,jhansen,Jean Hansen,jean.ipecity.eth,true"
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <Button 
              type="submit" 
              disabled={importMembersMutation.isPending}
              className="w-full"
            >
              {importMembersMutation.isPending ? "Importing..." : "Import Members"}
            </Button>
          </form>
        </div>
      </div>

      {/* Pulses List */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Manage Pulses</h2>
        </div>
        <div className="p-6">
          {pulsesLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading pulses...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pulsesData?.pulses?.map((pulse: Pulse) => {
                const isEditing = editingPulse === pulse.id;
                const canEdit = isFuturePulse(pulse);
                const today = new Date().toISOString().split('T')[0];
                const isPast = pulse.date < today;
                const isToday = pulse.date === today;
                
                return (
                  <div key={pulse.id} className={`border rounded-lg p-4 ${
                    isToday
                      ? "border-green-300 bg-green-50"
                      : isPast
                        ? "border-gray-200 bg-gray-50"
                        : "border-blue-200 bg-blue-50"
                  }`}>
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={editData.farcasterUrl}
                          onChange={(e) => setEditData({ ...editData, farcasterUrl: e.target.value })}
                          placeholder="Farcaster URL"
                        />
                        <Input
                          type="date"
                          value={editData.date}
                          onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        />
                        <Textarea
                          value={editData.description}
                          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Description"
                        />
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              updatePulseMutation.mutate({ id: pulse.id, data: editData });
                            }}
                            disabled={updatePulseMutation.isPending}
                          >
                            <Save className="w-4 h-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPulse(null)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`font-medium ${
                              isToday
                                ? "text-green-700"
                                : isPast
                                  ? "text-gray-600"
                                  : "text-blue-700"
                            }`}>
                              Date: {new Date(pulse.date + "T00:00:00").toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">{pulse.description}</p>
                          <p className="text-sm text-gray-500 break-all">{pulse.farcasterUrl}</p>
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditStart(pulse)}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Members List */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Members ({membersData?.members?.length || 0})</h2>
        </div>
        <div className="p-6">
          {membersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading members...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
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
                      <td className="py-2">{member.farcasterUsername}</td>
                      <td className="py-2">{member.name}</td>
                      <td className="py-2">{member.ipePassport}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          member.approved 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {member.approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}