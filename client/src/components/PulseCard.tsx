import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  Target, 
  ArrowRight,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPulseDate, getPulseDurationText, getContextualTimingInfo } from "@/lib/dateUtils";
import { useLocation } from "wouter";
import { useTimezone } from "@/contexts/TimezoneContext";
import type { Pulse } from "@shared/schema";
import { getCardAccentColor, getStatusBadge, hasUserExecuted, getPulseTimingInfo } from "@/lib/pulseUtils";

interface ExecutionStatus {
  liked: boolean;
  shared: boolean;
  abstained: boolean;
  hasExecution?: boolean;
}

interface PulseCardProps {
  pulse: Pulse;
  executionStatus?: ExecutionStatus;
  showExecutionStatus?: boolean;
  showAdminActions?: boolean;
  onEdit?: (pulse: Pulse) => void;
  onDelete?: (pulse: Pulse) => void;
  onViewDetails?: (pulse: Pulse) => void;
  clickable?: boolean;
  className?: string;
  isAdmin?: boolean;
}

export const PulseCard = memo(function PulseCard({
  pulse,
  executionStatus,
  showExecutionStatus = false,
  showAdminActions = false,
  onEdit,
  onDelete,
  onViewDetails,
  clickable = true,
  className,
  isAdmin = false
}: PulseCardProps) {
  const [, setLocation] = useLocation();
  const { timezoneInfo } = useTimezone();
  
  // Use UTC for calculations, convert for display
  const timingInfo = getContextualTimingInfo(
    pulse.datetimeStart, // UTC from server
    pulse.datetimeStart, // Calculate end time from UTC start + interval
    new Date(), // Current UTC time
    timezoneInfo.timeZone
  );
  
  const hasExecution = hasUserExecuted(executionStatus);
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on action buttons
    if ((e.target as Element).closest('button')) {
      return;
    }
    
    if (!clickable) return;
    
    // All users now navigate to the same universal route
    setLocation(`/pulse/${pulse.id}`);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(e as unknown as React.MouseEvent);
    }
  };
  
  const getStatusBadgeConfig = () => {
    return getStatusBadge(executionStatus, pulse.datetimeStart, pulse.interval, new Date());
  };
  
  const getExecutionDisplay = () => {
    if (!showExecutionStatus || !executionStatus) return null;
    
    if (!hasExecution) {
      return (
        <div className="flex items-center justify-center py-2 px-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
          <span className="text-red-700 font-medium text-sm text-center">Not Executed</span>
        </div>
      );
    }
    
    const actions = [];
    if (executionStatus.liked) actions.push("Liked");
    if (executionStatus.shared) actions.push("Shared");
    if (executionStatus.abstained) actions.push("Abstained");
    
    return (
      <div className="flex items-center justify-center py-2 px-3 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
        <span className="text-green-700 font-medium text-sm text-center break-words">
          Executed - {actions.join("/") || "Completed"}
        </span>
      </div>
    );
  };

  const getCardAccentColorConfig = () => {
    return getCardAccentColor(executionStatus, pulse.datetimeStart, pulse.interval, new Date());
  };

  return (
    <Card 
      className={cn(
        "relative transition-all duration-200 border-l-4 bg-white shadow-sm hover:shadow-md overflow-hidden",
        getCardAccentColorConfig(),
        clickable && "cursor-pointer hover:shadow-lg",
        className
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={clickable ? 0 : -1}
      role={clickable ? "button" : undefined}  
      aria-label={clickable ? `View details for Pulse #${pulse.id}` : undefined}
    >
      <CardContent className="p-4 sm:p-6 min-w-0">
        {/* Header with Title, Status, and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              PULSE #{pulse.id}
            </h2>
            {(() => {
              const badgeConfig = getStatusBadgeConfig();
              return badgeConfig ? (
                <Badge className={cn(badgeConfig.className, "w-fit")}>
                  {badgeConfig.text}
                </Badge>
              ) : null;
            })()}
          </div>
          
          {/* Admin Actions */}
          {showAdminActions && (
            <div className="flex items-center space-x-1 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(pulse);
                }}
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(pulse);
                }}
                className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* View Details Indicator */}
          {clickable && !showAdminActions && (
            <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
        </div>
        
        {/* Description */}
        <p className="text-gray-700 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed break-words">
          {pulse.description}
        </p>
        
        {/* Key Information */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" />
            <span className="font-medium break-words">{formatPulseDate(pulse.datetimeStart, timezoneInfo.timeZone, true)}</span>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-sm">
            <div className="flex items-center text-gray-600">
              <Clock className="h-4 w-4 mr-3 flex-shrink-0 text-gray-400" />
              <span>Duration: <span className="font-medium">{getPulseDurationText(pulse.interval)}</span></span>
            </div>
            <div className="flex items-center text-purple-600">
              <Target className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="font-semibold">{pulse.points} points</span>
            </div>
          </div>
        </div>
        
        {/* Execution Status */}
        {getExecutionDisplay()}
      </CardContent>
    </Card>
  );
});