/**
 * PostTool — renders the active pulse card with Farcaster cast interactions.
 * State and logic live in usePostToolLogic; cast rendering in CastDisplay.
 */

import { ArrowRight, CheckCircle, XCircle, Target } from "lucide-react";
import type { Pulse, Member } from "@shared/schema";
import { getActivePulseTimingInfo } from "@/lib/pulseUtils";
import { usePostToolLogic } from "./usePostToolLogic";
import { CastDisplay } from "./CastDisplay";

interface PostToolProps {
  pulse: Pulse;
  member: Member;
  signerUuid: string | null;
}

export function PostTool({ pulse, member, signerUuid }: PostToolProps) {
  const {
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
  } = usePostToolLogic({ pulse, member, signerUuid });

  // Show authentication error if present
  if (componentExecutionsError && (componentExecutionsError as Error).message.includes('401')) {
    return (
      <div className="w-full max-w-lg bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700 text-sm">
          Authentication required. Please refresh the page and sign in again.
        </p>
      </div>
    );
  }

  const getExecutionDisplay = () => {
    if (!hasExecution) {
      return (
        <div className="flex items-center justify-center py-2 px-4 bg-red-50 border border-red-200 rounded-lg mt-4">
          <XCircle className="h-4 w-4 text-red-500 mr-2" />
          <span className="text-red-700 font-medium text-sm">Not Executed</span>
        </div>
      );
    }

    const actions = [];
    if (executionStatus.liked) actions.push("Liked");
    if (executionStatus.shared) actions.push("Shared");
    if (executionStatus.abstained) actions.push("Abstained");

    return (
      <div className="flex items-center justify-between py-2 px-4 bg-green-50 border border-green-200 rounded-lg mt-4">
        <div className="flex items-center">
          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
          <span className="text-green-700 font-medium text-sm">
            Executed - {actions.join("/") || "Completed"}
          </span>
        </div>
        <div className="flex items-center text-purple-600">
          <Target className="h-4 w-4 mr-2" />
          <span className="font-semibold">{pulse.points} points</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`w-full max-w-lg bg-white border border-gray-200 shadow rounded-xl border-l-4 ${containerBorderColor}`}>
      <div
        className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl cursor-pointer hover:bg-gray-100 transition-colors duration-200"
        onClick={handleHeaderClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View details for Pulse #${pulse.id}`}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center justify-between">
          <span className="flex items-center">
            🎯 PULSE #{pulse.id} - Active Now
          </span>
          <ArrowRight className="h-5 w-5 text-gray-400" />
        </h2>
        <p className="text-gray-700 text-sm mb-2">{pulse.description}</p>
        <p className="text-sm font-medium text-gray-600 mb-2">
          {getActivePulseTimingInfo(pulse)}
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex justify-between items-start">
              <p className="text-sm text-red-700 flex-1">{error}</p>
              {isCircuitOpen ? (
                <div className="ml-2 text-xs text-red-500">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Retry in {countdown}s</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setError(null);
                    handleCheck();
                  }}
                  className="ml-2 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-lime-50 border border-lime-200 rounded-lg">
            <p className="text-sm text-lime-700">{successMessage}</p>
          </div>
        )}

        {checking && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-blue-700">Loading post...</p>
          </div>
        )}

        <CastDisplay
          castData={castData}
          stats={stats}
          executionStatus={executionStatus}
          actionLoading={actionLoading}
          onReaction={handleReaction}
          onPulseAction={handlePulseAction}
        />

        {/* Execution Status Display */}
        {getExecutionDisplay()}
      </div>
    </div>
  );
}
