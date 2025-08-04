import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  ExternalLink, 
  Target, 
  ArrowRight,
  CheckCircle,
  XCircle,
  Edit,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPulseDate, getPulseDurationText, getContextualTimingInfo } from "@/lib/dateUtils";
import { useLocation } from "wouter";
import type { Pulse } from "@shared/schema";

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

export function PulseCard({
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
  
  const startTime = new Date(pulse.datetimeStart);
  const endTime = new Date(startTime.getTime() + (pulse.interval * 60 * 60 * 1000));
  const timingInfo = getContextualTimingInfo(startTime, endTime);
  
  const hasExecution = executionStatus?.hasExecution || 
    (executionStatus?.liked || executionStatus?.shared || executionStatus?.abstained);
  
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
      handleCardClick(e as any);
    }
  };
  
  const getStatusBadge = () => {
    const baseClasses = "px-2 py-1 text-xs font-medium rounded-full";
    
    switch (timingInfo.status) {
      case 'active':
        return (
          <Badge className={cn(baseClasses, "bg-orange-100 text-orange-800 border-orange-300")}>
            Active
          </Badge>
        );
      case 'future':
        return (
          <Badge className={cn(baseClasses, "bg-blue-100 text-blue-800 border-blue-300")}>
            Scheduled
          </Badge>
        );
      case 'ended':
        return (
          <Badge className={cn(baseClasses, "bg-gray-100 text-gray-800 border-gray-300")}>
            Ended
          </Badge>
        );
      default:
        return null;
    }
  };
  
  const getExecutionDisplay = () => {
    if (!showExecutionStatus || !executionStatus) return null;
    
    if (!hasExecution) {
      return (
        <div className="flex items-center space-x-2 text-sm">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-600 font-medium">Non-executed</span>
        </div>
      );
    }
    
    const actions = [];
    if (executionStatus.liked) actions.push("Liked");
    if (executionStatus.shared) actions.push("Shared");
    if (executionStatus.abstained) actions.push("Abstained");
    
    return (
      <div className="flex items-center space-x-2 text-sm">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span className="text-green-600 font-medium">
          Executed - {actions.join("/") || "No actions"}
        </span>
      </div>
    );
  };

  return (
    <Card 
      className={cn(
        "relative transition-all duration-200",
        hasExecution ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200",
        clickable && "cursor-pointer hover:border-blue-300 hover:shadow-md",
        className
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={clickable ? 0 : -1}
      role={clickable ? "button" : undefined}
      aria-label={clickable ? `View details for Pulse #${pulse.id}` : undefined}
    >
      <CardContent className="p-4">
        {/* Header with Title and Actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900">
              PULSE #{pulse.id}
            </h3>
            {getStatusBadge()}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Admin Actions */}
            {showAdminActions && (
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(pulse);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(pulse);
                  }}
                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            
            {/* View Details Indicator */}
            {clickable && (
              <div className="text-gray-400">
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
        
        {/* Description */}
        <p className="text-gray-600 text-sm mb-3">{pulse.description}</p>
        
        {/* Date and Time Info */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>{formatPulseDate(startTime)}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Duration: {getPulseDurationText(pulse.interval)}</span>
          </div>
          
          {pulse.urlEmbed && (
            <div className="flex items-center space-x-2 text-sm">
              <ExternalLink className="h-4 w-4 text-blue-500" />
              <a 
                href={pulse.urlEmbed}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 truncate"
                onClick={(e) => e.stopPropagation()}
              >
                Link post
              </a>
            </div>
          )}
        </div>
        
        {/* Points */}
        <div className="flex items-center space-x-2 text-sm mb-3">
          <Target className="h-4 w-4 text-purple-500" />
          <span className="text-purple-600 font-medium">Points: {pulse.points}</span>
        </div>
        
        {/* Execution Status */}
        {getExecutionDisplay()}
        
        {/* Contextual Timing for Upcoming Pulses */}
        {timingInfo.status === 'future' && (
          <div className="mt-3 p-2 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">
              {timingInfo.contextText}
            </p>
          </div>
        )}
        
        {/* Active/Ended Context */}
        {(timingInfo.status === 'active' || timingInfo.status === 'ended') && (
          <div className={cn(
            "mt-3 p-2 rounded-lg text-sm font-medium",
            timingInfo.status === 'active' 
              ? "bg-orange-100 text-orange-700"
              : "bg-gray-100 text-gray-700"
          )}>
            {timingInfo.contextText}
          </div>
        )}
      </CardContent>
    </Card>
  );
}