import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { authenticatedPost } from "@/lib/api";
import { getEasScanUrl } from "@/lib/easUtils";
import { CheckCircle, XCircle, Clock, ExternalLink, Loader2 } from "lucide-react";
import { usePulseTimings } from "@/hooks/usePulseTimings";
import { cn } from "@/lib/utils";

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
  isAdmin?: boolean;
}

// Reusable error handling for attestation operations
const useAttestationErrorHandler = (retryCallback: () => void) => {
  const { toast } = useToast();

  const handleError = (error: Error, context?: string) => {
    console.error(`[ERROR_HANDLER] ${context}:`, error);

    let description = error.message;
    let retryable = true;

    // Parse specific error types
    if (error.message.includes('timed out')) {
      description = `${context || 'Operation'} timed out. This may indicate network issues or high blockchain congestion.`;
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
      description,
      variant: "destructive",
      action: retryable ? (
        <button
          onClick={retryCallback}
          className="text-sm font-medium text-red-600 hover:text-red-800"
        >
          Retry
        </button>
      ) : undefined
    });
  };
  
  const shouldRetry = (failureCount: number, error: Error) => {
    // Don't retry for validation errors, rate limits, or completed operations
    const nonRetryableErrors = [
      'Cannot create attestations',
      'Too many requests',
      'Invalid pulse ID',
      'Invalid execution ID',
      'Member is not eligible',
      'already completed'
    ];
    
    if (nonRetryableErrors.some(pattern => error.message.includes(pattern))) {
      return false;
    }
    return failureCount < 2; // Retry up to 2 times for other errors
  };

  return { handleError, shouldRetry };
};

export function PulseExecutionsTable({ pulse, executions, profile, onRefresh, isAdmin = false }: PulseExecutionsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [creatingAll, setCreatingAll] = useState(false);
  const [creatingIndividual, setCreatingIndividual] = useState<number | null>(null);

  // Use the reusable pulse timing hook
  const { pulseTimings } = usePulseTimings([pulse], true);
  const pulseTimingInfo = pulseTimings[0];
  
  const isPulseEnded = () => pulseTimingInfo?.isEnded ?? false;
  const isPulseFuture = () => pulseTimingInfo?.isFuture ?? false;
  const getTimeUntilEnd = () => pulseTimingInfo?.timeUntilEnd;
  const getTimeUntilStart = () => pulseTimingInfo?.timeUntilStart;
  const getPulseEndTime = () => pulseTimingInfo?.endTime;

  // Error handlers
  const bulkErrorHandler = useAttestationErrorHandler(() => createAllAttestationsMutation.mutate());

  // Mutation for creating all attestations for this pulse
  const createAllAttestationsMutation = useMutation({
    mutationFn: async () => {
      try {
        const result = await authenticatedPost(`/api/v2/attestations/pulse/${pulse.id}/create-all`, {});
        return result;
      } catch (error) {
        console.error(`[FRONTEND] Bulk attestation error:`, error);
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `${data.message}. Successful: ${data.successful}, Failed: ${data.failed}`
      });
      onRefresh();
    },
    onError: (error: Error) => {
      bulkErrorHandler.handleError(error, "Bulk attestation creation");
    },
    retry: bulkErrorHandler.shouldRetry,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  // Mutation for creating individual attestation
  const createAttestationMutation = useMutation({
    mutationFn: async (executionId: number) => {
      return authenticatedPost(`/api/v2/attestations/${executionId}`, {});
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: data.message });
      onRefresh();
    },
    onError: (error: Error, executionId) => {
      const individualErrorHandler = useAttestationErrorHandler(() => createAttestationMutation.mutate(executionId));
      individualErrorHandler.handleError(error, "Individual attestation creation");
    },
    retry: (failureCount, error) => {
      // Use the same retry logic as the bulk handler
      return bulkErrorHandler.shouldRetry(failureCount, error);
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
    // Validate executionId is a valid number
    if (!executionId || isNaN(executionId) || executionId <= 0) {
      toast({ 
        title: "Error", 
        description: "Invalid execution ID. Please refresh the page and try again.",
        variant: "destructive" 
      });
      return;
    }
    
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

  // Mobile card component for individual execution
  const ExecutionMobileCard = ({ member, execution, attestation }: { member: Member; execution: Execution | null; attestation: Attestation | null }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Member Info */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {member.ipeUsername || member.ipePassport}
          </div>
          <div className="text-xs text-gray-500">
            FID: {member.farcasterFid}
          </div>
        </div>
        <div className="text-right">
          {execution ? (
            <span className="text-sm font-medium text-green-600">
              {pulse.points} pts
            </span>
          ) : (
            <span className="text-sm text-gray-400">0 pts</span>
          )}
        </div>
      </div>

      {/* Execution Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase">Status</span>
        {getExecutionStatusBadge(execution)}
      </div>

      {/* Actions */}
      {execution && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-gray-500 uppercase block">Actions</span>
          <div className="flex flex-wrap gap-1">
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
        </div>
      )}

      {/* Attestation Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase">Attestation</span>
        {getAttestationStatusBadge(attestation)}
      </div>

      {/* Admin Action */}
      {isAdmin && execution && (!attestation || attestation.status !== 'completed') && (
        <div className="pt-2 border-t border-gray-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateIndividualAttestation(execution.id)}
                  disabled={creatingIndividual === execution.id || createAttestationMutation.isPending || !isPulseEnded()}
                  className="text-xs disabled:bg-gray-100 w-full"
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
              </TooltipTrigger>
              <TooltipContent>
                {isPulseEnded() ? (
                  <p>Create attestation for this execution</p>
                ) : isPulseFuture() ? (
                  <p>Pulse scheduled. Attestations available after pulse ends in {getTimeUntilStart()}</p>
                ) : (
                  <p>Pulse is still active. Attestations available in {getTimeUntilEnd()}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 min-w-0">
      {/* Header with bulk action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <h3 className="text-lg font-semibold break-words">Pulse Executions & Attestations</h3>
            <Badge 
              variant={isPulseEnded() ? "default" : "secondary"}
              className={cn(
                "w-fit text-xs",
                isPulseEnded() 
                  ? "bg-gray-500 text-white" 
                  : isPulseFuture() 
                    ? "bg-blue-500 text-white"
                    : "bg-orange-500 text-white"
              )}
            >
              {isPulseEnded() 
                ? "Ended" 
                : isPulseFuture() 
                  ? `Scheduled • ${getTimeUntilStart() || "starting soon"} until start`
                  : `Active • ${getTimeUntilEnd() || "ending soon"} remaining`
              }
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            {executions.filter(e => e.execution).length} of {executions.length} members executed this pulse
          </p>
          <p className="text-xs text-gray-500 break-words">
            Pulse ends at {getPulseEndTime()?.toLocaleString()}
          </p>
        </div>
        {isAdmin && eligibleExecutions.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCreateAllAttestations}
                  disabled={creatingAll || createAllAttestationsMutation.isPending || !isPulseEnded()}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-xs sm:text-sm w-full sm:w-auto"
                  size="sm"
                >
                  {creatingAll || createAllAttestationsMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Creating Attestations...</span>
                      <span className="sm:hidden">Creating...</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">Create {eligibleExecutions.length} Attestations</span>
                      <span className="sm:hidden">Create {eligibleExecutions.length}</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isPulseEnded() ? (
                  <p>Create attestations for all eligible executions</p>
                ) : isPulseFuture() ? (
                  <p>Pulse scheduled. Attestations available after pulse ends in {getTimeUntilStart()}</p>
                ) : (
                  <p>Pulse is still active. Attestations available in {getTimeUntilEnd()}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto min-w-0">
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
      </div>

      {/* Mobile Cards View */}
      <div className="block sm:hidden space-y-3">
        {executions.map(({ member, execution, attestation }) => (
          <ExecutionMobileCard 
            key={member.id} 
            member={member} 
            execution={execution} 
            attestation={attestation} 
          />
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
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
                {isAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {executions.map(({ member, execution, attestation }) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 break-words">
                        {member.ipeUsername || member.ipePassport}
                      </div>
                      <div className="text-sm text-gray-500 break-words">
                        FID: {member.farcasterFid}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    {getExecutionStatusBadge(execution)}
                  </td>
                  
                  <td className="px-4 py-3">
                    {execution ? (
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
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
                  
                  <td className="px-4 py-3">
                    {execution ? (
                      <span className="text-sm font-medium text-green-600">
                        {pulse.points} pts
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0 pts</span>
                    )}
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      {getAttestationStatusBadge(attestation)}
                    </div>
                  </td>
                  
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {execution && (!attestation || attestation.status !== 'completed') ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateIndividualAttestation(execution.id)}
                                disabled={creatingIndividual === execution.id || createAttestationMutation.isPending || !isPulseEnded()}
                                className="text-xs disabled:bg-gray-100 max-w-[120px]"
                              >
                                {creatingIndividual === execution.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 mr-1 animate-spin flex-shrink-0" />
                                    <span className="truncate">Creating...</span>
                                  </>
                                ) : (
                                  <span className="truncate">Create Attestation</span>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isPulseEnded() ? (
                                <p>Create attestation for this execution</p>
                              ) : isPulseFuture() ? (
                                <p>Pulse scheduled. Attestations available after pulse ends in {getTimeUntilStart()}</p>
                              ) : (
                                <p>Pulse is still active. Attestations available in {getTimeUntilEnd()}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}