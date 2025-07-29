import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authenticatedPost } from "@/lib/api";
import { getEasScanUrl } from "@/lib/easUtils";
import { CheckCircle, XCircle, Clock, ExternalLink, Loader2 } from "lucide-react";

interface Member {
  id: number;
  farcasterFid: number;
  ipePassport: string;
  ipeUsername: string;
  memberType: string;
}

interface Execution {
  id: number;
  actions: {
    liked: boolean;
    shared: boolean;
    abstained: boolean;
  };
  executedAt: string;
  points: number;
}

interface Attestation {
  id: number;
  status: 'pending' | 'completed' | 'failed';
  attestationUid?: string;
  transactionHash?: string;
  createdAt: string;
}

interface PulseExecution {
  member: Member;
  execution: Execution | null;
  attestation: Attestation | null;
}

interface Pulse {
  id: number;
  description: string;
  points: number;
  datetimeStart: string;
  interval: number;
}

interface PulseExecutionsTableProps {
  pulse: Pulse;
  executions: PulseExecution[];
  profile: any;
  onRefresh: () => void;
}

export function PulseExecutionsTable({ pulse, executions, profile, onRefresh }: PulseExecutionsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creatingAll, setCreatingAll] = useState(false);
  const [creatingIndividual, setCreatingIndividual] = useState<number | null>(null);

  // Mutation for creating all attestations for this pulse
  const createAllAttestationsMutation = useMutation({
    mutationFn: async () => {
      return authenticatedPost(`/api/admin/pulse/${pulse.id}/attestations/create-all`, {}, profile?.fid);
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: `${data.message}. Successful: ${data.successful}, Failed: ${data.failed}` 
      });
      onRefresh();
    },
    onError: (error: Error) => {
      let description = error.message;
      let retryable = true;
      
      // Parse specific error types
      if (error.message.includes('timed out')) {
        description = "Operation timed out. This may indicate network issues or high blockchain congestion.";
      } else if (error.message.includes('Too many requests')) {
        description = "Rate limit exceeded. Please wait a moment before trying again.";
      } else if (error.message.includes('Cannot create attestations for active pulse')) {
        description = "Cannot create attestations for an active pulse. Wait for the pulse to end.";
        retryable = false;
      }
      
      toast({ 
        title: "Error", 
        description: description,
        variant: "destructive",
        action: retryable ? (
          <button 
            onClick={() => createAllAttestationsMutation.mutate()}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        ) : undefined
      });
    },
    retry: (failureCount, error) => {
      // Don't retry for validation errors or rate limits
      if (error.message.includes('Cannot create attestations') || 
          error.message.includes('Too many requests') ||
          error.message.includes('Invalid pulse ID')) {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // Mutation for creating individual attestation
  const createAttestationMutation = useMutation({
    mutationFn: async (executionId: number) => {
      return authenticatedPost(`/api/admin/attestations/create/${executionId}`, {}, profile?.fid);
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      onRefresh();
    },
    onError: (error: Error, executionId) => {
      let description = error.message;
      let retryable = true;
      
      // Parse specific error types
      if (error.message.includes('timed out')) {
        description = "Attestation creation timed out. This may indicate network issues or high blockchain congestion.";
      } else if (error.message.includes('Too many requests')) {
        description = "Rate limit exceeded. Please wait a moment before trying again.";
      } else if (error.message.includes('Cannot create attestations for active pulse')) {
        description = "Cannot create attestations for an active pulse. Wait for the pulse to end.";
        retryable = false;
      } else if (error.message.includes('Member is not eligible')) {
        description = "Member is not eligible for attestations. Check member status and passport verification.";
        retryable = false;
      } else if (error.message.includes('already completed')) {
        description = "Attestation has already been completed for this execution.";
        retryable = false;
      }
      
      toast({ 
        title: "Error", 
        description: description,
        variant: "destructive",
        action: retryable ? (
          <button 
            onClick={() => createAttestationMutation.mutate(executionId)}
            className="text-sm font-medium text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        ) : undefined
      });
    },
    retry: (failureCount, error) => {
      // Don't retry for validation errors, rate limits, or completed attestations
      if (error.message.includes('Cannot create attestations') || 
          error.message.includes('Too many requests') ||
          error.message.includes('Invalid execution ID') ||
          error.message.includes('Member is not eligible') ||
          error.message.includes('already completed')) {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  });

  const handleCreateAllAttestations = async () => {
    setCreatingAll(true);
    try {
      await createAllAttestationsMutation.mutateAsync();
    } finally {
      setCreatingAll(false);
    }
  };

  const handleCreateIndividualAttestation = async (executionId: number) => {
    setCreatingIndividual(executionId);
    try {
      await createAttestationMutation.mutateAsync(executionId);
    } finally {
      setCreatingIndividual(null);
    }
  };

  const getExecutionStatusBadge = (execution: Execution | null) => {
    if (!execution) {
      return <Badge variant="secondary">Not Executed</Badge>;
    }

    const { liked, shared, abstained } = execution.actions;
    if (abstained) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Abstained</Badge>;
    }
    
    if (liked && shared) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Full Execution</Badge>;
    }
    
    if (liked || shared) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Partial Execution</Badge>;
    }

    return <Badge variant="secondary">No Actions</Badge>;
  };

  const getAttestationStatusBadge = (attestation: Attestation | null) => {
    if (!attestation) {
      return (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Not Created</span>
        </div>
      );
    }

    switch (attestation.status) {
      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">Completed</span>
            {attestation.attestationUid && (
              <a
                href={getEasScanUrl(attestation.attestationUid)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
                title="View attestation on EAS scan"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-700">Pending</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-700">Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Unknown</span>
          </div>
        );
    }
  };

  const eligibleExecutions = executions.filter(({ execution, attestation }) => 
    execution && (!attestation || attestation.status !== 'completed')
  );

  return (
    <div className="space-y-6">
      {/* Header with bulk action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pulse Executions & Attestations</h3>
          <p className="text-sm text-gray-600">
            {executions.filter(e => e.execution).length} of {executions.length} members executed this pulse
          </p>
        </div>
        {eligibleExecutions.length > 0 && (
          <Button
            onClick={handleCreateAllAttestations}
            disabled={creatingAll || createAllAttestationsMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {creatingAll || createAllAttestationsMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Attestations...
              </>
            ) : (
              `Create ${eligibleExecutions.length} Attestations`
            )}
          </Button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">
            {executions.filter(e => e.execution).length}
          </div>
          <div className="text-sm text-blue-600">Total Executions</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-slate-700">
            {executions.filter(e => !e.execution).length}
          </div>
          <div className="text-sm text-slate-600">Pending Executions</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-700">
            {executions.filter(e => e.attestation?.status === 'completed').length}
          </div>
          <div className="text-sm text-green-600">Completed Attestations</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-700">
            {executions.filter(e => e.attestation?.status === 'pending').length}
          </div>
          <div className="text-sm text-yellow-600">Pending Attestations</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-700">
            {executions.filter(e => e.attestation?.status === 'failed').length}
          </div>
          <div className="text-sm text-red-600">Failed Attestations</div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Execution Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Points
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attestation Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {executions.map(({ member, execution, attestation }) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {member.ipeUsername || member.ipePassport}
                      </div>
                      <div className="text-sm text-gray-500">
                        FID: {member.farcasterFid}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getExecutionStatusBadge(execution)}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap">
                    {execution ? (
                      <div className="flex gap-1">
                        {execution.actions.liked && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                            ❤️ Like
                          </Badge>
                        )}
                        {execution.actions.shared && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            🔄 Share
                          </Badge>
                        )}
                        {execution.actions.abstained && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                            ⏭️ Abstain
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap">
                    {execution ? (
                      <span className="text-sm font-medium text-green-600">
                        {pulse.points} pts
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0 pts</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getAttestationStatusBadge(attestation)}
                  </td>
                  
                  <td className="px-4 py-3 whitespace-nowrap">
                    {execution && (!attestation || attestation.status !== 'completed') ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCreateIndividualAttestation(execution.id)}
                        disabled={creatingIndividual === execution.id || createAttestationMutation.isPending}
                        className="text-xs"
                      >
                        {creatingIndividual === execution.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Attestation'
                        )}
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}