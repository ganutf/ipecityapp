import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, CheckCircle, Calendar } from "lucide-react";
import { PulseTimingInfo } from "@/hooks/usePulseTimings";

interface PulseTimingCardProps {
  pulseTimingInfo: PulseTimingInfo;
  executionStatus?: {
    hasExecution: boolean;
    liked?: boolean;
    shared?: boolean;
    abstained?: boolean;
  };
  showExecutionStatus?: boolean;
  compact?: boolean;
}

export function PulseTimingCard({
  pulseTimingInfo,
  executionStatus,
  showExecutionStatus = false,
  compact = false
}: PulseTimingCardProps) {
  const { pulse, status, startTime, endTime, timeUntilStart, timeUntilEnd } = pulseTimingInfo;

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            <PlayCircle className="h-3 w-3 mr-1" />
            Active • {timeUntilEnd} remaining
          </Badge>
        );
      case 'future':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
            <Calendar className="h-3 w-3 mr-1" />
            Starts in {timeUntilStart}
          </Badge>
        );
      case 'ended':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ended
          </Badge>
        );
    }
  };

  const getExecutionBadge = () => {
    if (!showExecutionStatus || !executionStatus) return null;

    if (!executionStatus.hasExecution) {
      return (
        <Badge variant="outline" className="text-gray-600">
          Not Executed
        </Badge>
      );
    }

    const { liked, shared, abstained } = executionStatus;
    
    if (abstained) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700">
          Abstained
        </Badge>
      );
    }

    if (liked && shared) {
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200">
          Full Execution
        </Badge>
      );
    }
    
    if (liked || shared) {
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
          Partial Execution
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        No Actions
      </Badge>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {pulse.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge()}
            {getExecutionBadge()}
          </div>
        </div>
        <div className="ml-3 text-right">
          <p className="text-sm font-semibold text-purple-600">
            {pulse.points} pts
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-medium text-gray-900 mb-2">
              {pulse.description}
            </h4>

            <div className="space-y-1 text-sm text-gray-600 mb-3">
              {status === 'active' && (
                <div className="text-sm text-gray-600">
                  Started {startTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} • {timeUntilEnd} remaining
                </div>
              )}
              
              {status === 'future' && (
                <div className="text-sm text-gray-600">
                  Starts {startTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                </div>
              )}
              
              {status === 'ended' && (
                <div className="text-sm text-gray-600">
                  Ended {endTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {getExecutionBadge()}
            </div>
          </div>
          
          <div className="ml-4 text-right">
            <div className="text-lg font-bold text-purple-600">
              {pulse.points}
            </div>
            <div className="text-xs text-gray-500">
              points
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}