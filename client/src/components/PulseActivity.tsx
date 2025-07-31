import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, Calendar, TrendingUp, PlayCircle } from "lucide-react";
import { PulseTimingCard } from "./PulseTimingCard";
import { usePulseTimings, Pulse } from "@/hooks/usePulseTimings";
import { authenticatedGet } from "@/lib/api";

interface PulseActivityProps {
  memberId?: number;
  fid?: number;
  showExecutionStatus?: boolean;
  compact?: boolean;
  title?: string;
}

interface ExecutionDetail {
  execution: {
    id: number;
    actions: {
      liked: boolean;
      shared: boolean;
      abstained: boolean;
    };
    executedAt: string;
    points: number;
  } | null;
  pulse: {
    id: number;
    description: string;
    points: number;
    datetimeStart: string;
    interval: number;
  };
  attestation: {
    id: number;
    status: 'pending' | 'completed' | 'failed';
    attestationUid?: string;
  } | null;
}

export function PulseActivity({
  memberId,
  fid,
  showExecutionStatus = false,
  compact = false,
  title = "Pulse Activity"
}: PulseActivityProps) {
  const [activeTab, setActiveTab] = useState("active");

  // Fetch all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    queryFn: () => authenticatedGet("/api/pulses", fid),
    enabled: Boolean(fid),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch member's execution details if memberId is provided
  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: [`/api/executions/${memberId}/details`],
    queryFn: () => authenticatedGet(`/api/executions/${memberId}/details`, fid),
    enabled: Boolean(memberId && fid && showExecutionStatus),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const pulses: Pulse[] = pulsesData?.pulses || [];
  const executions: ExecutionDetail[] = executionsData?.executions || [];

  const { activePulses, futurePulses, endedPulses } = usePulseTimings(pulses, true);

  // Create a map of pulse executions for quick lookup
  const executionMap = new Map(
    executions.map(exec => [exec.pulse.id, exec.execution])
  );

  const getExecutionStatus = (pulseId: number) => {
    const execution = executionMap.get(pulseId);
    if (!execution) {
      return { hasExecution: false };
    }
    
    return {
      hasExecution: true,
      liked: execution.actions.liked,
      shared: execution.actions.shared,
      abstained: execution.actions.abstained,
    };
  };

  if (pulsesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pulses.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Pulses Available
            </h3>
            <p className="text-gray-600">
              There are currently no pulses to display.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderPulsesList = (pulseTimings: any[], emptyMessage: string) => {
    if (!pulseTimings.length) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p>{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {pulseTimings.map(timingInfo => (
          <PulseTimingCard
            key={timingInfo.pulse.id}
            pulseTimingInfo={timingInfo}
            executionStatus={showExecutionStatus ? getExecutionStatus(timingInfo.pulse.id) : undefined}
            showExecutionStatus={showExecutionStatus}
            compact={compact}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>{title}</span>
          </div>
          <div className="flex items-center space-x-2">
            {activePulses.length > 0 && (
              <Badge className="bg-orange-100 text-orange-800">
                {activePulses.length} Active
              </Badge>
            )}
            {futurePulses.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {futurePulses.length} Upcoming
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              Active ({activePulses.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming ({futurePulses.length})
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent ({Math.min(endedPulses.length, 5)})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {renderPulsesList(activePulses, "No active pulses at the moment")}
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            {renderPulsesList(futurePulses, "No upcoming pulses scheduled")}
          </TabsContent>

          <TabsContent value="recent" className="mt-4">
            {renderPulsesList(endedPulses.slice(0, 5), "No recent pulses")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

