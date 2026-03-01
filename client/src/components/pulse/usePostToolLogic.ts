/**
 * Custom hook encapsulating all PostTool state, effects, mutations, and handlers.
 * Extracted from pulse-dashboard.tsx for maintainability.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Pulse, Member } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  extractExecutionStatus,
  hasUserExecuted,
  getCardAccentColor,
  getPulseTimingInfo,
} from "@/lib/pulseUtils";

export interface PostToolProps {
  pulse: Pulse;
  member: Member;
  signerUuid: string | null;
}

interface FarcasterStats {
  liked: boolean;
  recasted: boolean;
  quotedRecast: boolean;
  regularRecast: boolean;
}

const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds

export function usePostToolLogic({ pulse, member, signerUuid }: PostToolProps) {
  const { memberId } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Get user's executions
  const { data: executionsData, error: componentExecutionsError } = useQuery({
    queryKey: queryKeys.executions.byMember(memberId),
    queryFn: () => authenticatedGet(`/api/v2/executions/${memberId}`),
    enabled: Boolean(memberId),
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Derive execution status from query data — single source of truth
  const executionStatus = useMemo(
    () => extractExecutionStatus(executionsData, pulse.id),
    [executionsData, pulse.id],
  );

  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<FarcasterStats | null>(null);
  const [castData, setCastData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{
    like: boolean;
    recast: boolean;
    abstain: boolean;
  }>({ like: false, recast: false, abstain: false });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Circuit breaker state
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<number | null>(null);
  const [isCircuitOpen, setIsCircuitOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Update countdown timer when circuit breaker is open
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCircuitOpen && lastFailureTime) {
      interval = setInterval(() => {
        const timeLeft = Math.ceil((CIRCUIT_BREAKER_TIMEOUT - (Date.now() - lastFailureTime)) / 1000);
        setCountdown(Math.max(0, timeLeft));

        if (timeLeft <= 0) {
          setIsCircuitOpen(false);
          setRetryCount(0);
          setLastFailureTime(null);
          setCountdown(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCircuitOpen, lastFailureTime]);

  // Record pulse execution mutation with optimistic updates
  const recordExecutionMutation = useMutation({
    mutationFn: async ({ actions }: { actions: { liked: boolean; shared: boolean; abstained: boolean } }) => {
      if (!memberId) {
        throw new Error("User not authenticated");
      }

      const { authenticatedPost } = await import("@/lib/api");
      return authenticatedPost("/api/v2/executions", {
        pulseId: pulse.id,
        actions,
      });
    },
    onMutate: async ({ actions }) => {
      const queryKey = queryKeys.executions.byMember(memberId);
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.executions) return old;
        const exists = old.executions.some((e: any) => e.pulseId === pulse.id);
        if (exists) {
          return {
            ...old,
            executions: old.executions.map((e: any) =>
              e.pulseId === pulse.id ? { ...e, actions } : e,
            ),
          };
        }
        return {
          ...old,
          executions: [...old.executions, { pulseId: pulse.id, actions }],
        };
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.executions.byMember(memberId),
          context.previousData,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.executions.details(member?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.executions.byMember(memberId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pulses.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pulses.executions(pulse.id) });
    },
  });

  // Handle pulse-specific actions (separate from Farcaster interactions)
  async function handlePulseAction(action: 'like' | 'share' | 'abstain') {
    if (!pulse) return;

    setActionLoading(prev => ({ ...prev, [action === 'share' ? 'recast' : action]: true }));

    try {
      let newActions = { ...executionStatus };

      if (action === 'abstain') {
        if (executionStatus.abstained) {
          newActions = { liked: false, shared: false, abstained: false };
        } else {
          newActions = { liked: false, shared: false, abstained: true };
        }
      } else {
        newActions = {
          ...executionStatus,
          abstained: false,
          [action === 'share' ? 'shared' : 'liked']: !executionStatus[action === 'share' ? 'shared' : 'liked']
        };
      }

      await recordExecutionMutation.mutateAsync({ actions: newActions });

      const actionName = action === 'share' ? 'shared' : action === 'like' ? 'liked' : 'abstained';
      setSuccessMessage(`Pulse ${actionName} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error) {
      setError(
        `Failed to record pulse ${action}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading(prev => ({ ...prev, [action === 'share' ? 'recast' : action]: false }));
    }
  }

  async function checkQuoteRecast(
    castHash: string,
    memberIdParam: number,
  ): Promise<boolean> {
    try {
      const quoteRes = await fetch(
        `/api/v2/farcaster/cast/${castHash}/quotes`,
      );
      if (quoteRes.ok) {
        const { hasQuoted } = await quoteRes.json();
        return hasQuoted;
      }
    } catch {
      // Silently fail - quote check is non-critical
    }
    return false;
  }

  const checkCircuitBreaker = () => {
    const now = Date.now();

    if (isCircuitOpen && lastFailureTime) {
      if (now - lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
        setIsCircuitOpen(false);
        setRetryCount(0);
        setLastFailureTime(null);
        return false;
      }
      return true;
    }

    return false;
  };

  // Sync execution status with Farcaster reality
  async function syncExecutionWithFarcaster(farcasterLiked: boolean, farcasterShared: boolean) {
    const timingInfo = getPulseTimingInfo(pulse.datetimeStart, pulse.interval);
    if (!timingInfo.isActive) {
      return;
    }

    const dbLiked = executionStatus.liked;
    const dbShared = executionStatus.shared;
    const dbAbstained = executionStatus.abstained;

    const shouldHaveExecution = farcasterLiked || farcasterShared;
    const hasExecution = dbLiked || dbShared || dbAbstained;

    let targetActions = null;

    if (shouldHaveExecution) {
      targetActions = {
        liked: farcasterLiked,
        shared: farcasterShared,
        abstained: false
      };
    } else if (hasExecution && !dbAbstained) {
      targetActions = {
        liked: false,
        shared: false,
        abstained: false
      };
    }

    const needsUpdate = targetActions &&
        (targetActions.liked !== dbLiked ||
         targetActions.shared !== dbShared ||
         targetActions.abstained !== dbAbstained);

    if (needsUpdate && targetActions) {
      try {
        await recordExecutionMutation.mutateAsync({ actions: targetActions });

        const hasAnyAction = targetActions.liked || targetActions.shared || targetActions.abstained;
        if (hasAnyAction) {
          setSuccessMessage("Pulse status synchronized with Farcaster");
        } else {
          setSuccessMessage("Pulse execution removed (no Farcaster actions found)");
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch {
        // Fail silently, don't disrupt user experience
      }
    }
  }

  async function handleCheck() {
    if (!pulse.urlEmbed || !memberId) return;

    if (checkCircuitBreaker()) {
      setError(`Cast checking temporarily disabled due to repeated failures. Will retry in ${Math.ceil((CIRCUIT_BREAKER_TIMEOUT - (Date.now() - (lastFailureTime || 0))) / 1000)} seconds.`);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v2/farcaster/cast/${encodeURIComponent(pulse.urlEmbed)}?type=url`,
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${res.status}`);
      }

      const { cast } = await res.json();
      setCastData(cast);

      const regularRecast = !!cast.viewer_context?.recasted;
      const liked = !!cast.viewer_context?.liked;
      const quotedRecast = cast.hash
        ? await checkQuoteRecast(cast.hash, memberId!)
        : false;

      setStats({
        liked: liked,
        recasted: regularRecast || quotedRecast,
        regularRecast: regularRecast,
        quotedRecast: quotedRecast,
      });

      await syncExecutionWithFarcaster(liked, regularRecast || quotedRecast);

      setRetryCount(0);
      setLastFailureTime(null);
      setIsCircuitOpen(false);
    } catch (error) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setLastFailureTime(Date.now());

      if (newRetryCount >= MAX_RETRIES) {
        setIsCircuitOpen(true);
        setError(
          `Failed to load cast data after ${MAX_RETRIES} attempts. Please check your connection and try again later.`
        );
      } else {
        setError(
          `Failed to fetch cast (attempt ${newRetryCount}/${MAX_RETRIES}): ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleReaction(type: "like" | "recast") {
    if (!castData || !memberId || !signerUuid) return;

    setActionLoading((prev) => ({ ...prev, [type]: true }));
    setError(null);

    try {
      const signer_uuid = signerUuid;

      if (type === "like") {
        const { authenticatedPost: authPost } = await import("@/lib/api");
        await authPost("/api/v2/farcaster/reaction", {
          signer_uuid: signer_uuid,
          reaction_type: "like",
          target: castData.hash,
        });
      } else if (type === "recast") {
        const { authenticatedPost: authPost } = await import("@/lib/api");
        await authPost("/api/v2/farcaster/cast", {
          signer_uuid: signer_uuid,
          text: "",
          embeds: [
            {
              cast_id: {
                hash: castData.hash,
                fid: castData.author.fid,
              },
            },
          ],
        });
      }

      if (type === "like") {
        setStats((prev) =>
          prev
            ? {
              ...prev,
              liked: !prev.liked,
            }
            : null,
        );
        if (pulse) {
          await handlePulseAction('like');
        }
      } else if (type === "recast") {
        setStats((prev) =>
          prev
            ? {
              ...prev,
              recasted: true,
              regularRecast: true,
              quotedRecast: prev.quotedRecast,
            }
            : null,
        );
        if (pulse) {
          await handlePulseAction('share');
        }
      }

      setSuccessMessage(`Post ${type}d successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

      if (!isCircuitOpen && retryCount === 0) {
        setTimeout(() => handleCheck(), 2000);
      }
    } catch (error) {
      setError(
        `Failed to ${type} post: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [type]: false }));
    }
  }

  // Auto-load the current pulse
  useEffect(() => {
    if (pulse.urlEmbed && memberId && !isCircuitOpen) {
      const timeoutId = setTimeout(() => {
        handleCheck();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [pulse.urlEmbed, memberId]);

  const handleHeaderClick = () => {
    setLocation(`/pulse/${pulse.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleHeaderClick();
    }
  };

  const hasExecution = hasUserExecuted(executionStatus);
  const containerBorderColor = getCardAccentColor(executionStatus, pulse.datetimeStart, pulse.interval);

  return {
    componentExecutionsError,
    checking,
    stats,
    castData,
    error,
    setError,
    actionLoading,
    successMessage,
    isCircuitOpen,
    countdown,
    executionStatus,
    hasExecution,
    containerBorderColor,
    handlePulseAction,
    handleReaction,
    handleCheck,
    handleHeaderClick,
    handleKeyDown,
  };
}
