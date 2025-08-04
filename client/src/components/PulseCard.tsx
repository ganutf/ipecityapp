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
    const baseClasses = "px-3 py-1.5 text-sm font-semibold rounded-full";
    
    switch (timingInfo.status) {
      case 'active':
        return (
          <Badge className={cn(baseClasses, "bg-orange-500 text-white")}>
            Active
          </Badge>
        );
      case 'future':
        return (
          <Badge className={cn(baseClasses, "bg-blue-500 text-white")}>
            Scheduled
          </Badge>
        );
      case 'ended':
        return (
          <Badge className={cn(baseClasses, "bg-gray-500 text-white")}>
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
        <div className="flex items-center justify-center py-2 px-4 bg-red-50 border border-red-200 rounded-lg">
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
      <div className="flex items-center justify-center py-2 px-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
        <span className="text-green-700 font-medium text-sm">
          Executed - {actions.join("/") || "Completed"}
        </span>
      </div>
    );
  };

  const getCardAccentColor = () => {
    if (hasExecution) return "border-l-green-500";
    switch (timingInfo.status) {
      case 'active': return "border-l-orange-500";
      case 'future': return "border-l-blue-500";
      case 'ended': return "border-l-gray-400";
      default: return "border-l-gray-300";
    }
  };

  return (
    <Card 
      className={cn(
        "relative transition-all duration-200 border-l-4 bg-white shadow-sm hover:shadow-md",
        getCardAccentColor(),
        clickable && "cursor-pointer hover:shadow-lg",
        className
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      tabIndex={clickable ? 0 : -1}
      role={clickable ? "button" : undefined}  
      aria-label={clickable ? `View details for Pulse #${pulse.id}` : undefined}
    >
      <CardContent className="p-6">
        {/* Header with Title, Status, and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-900">
              PULSE #{pulse.id}
            </h2>
            {getStatusBadge()}
          </div>
          
          {/* Admin Actions */}
          {showAdminActions && (
            <div className="flex items-center space-x-1">
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
            <ArrowRight className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        {/* Description */}
        <p className="text-gray-700 text-base mb-6 leading-relaxed">
          {pulse.description}
        </p>
        
        {/* Key Information */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-3 text-gray-400" />
            <span className="font-medium">{formatPulseDate(startTime)}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-600">
              <Clock className="h-4 w-4 mr-3 text-gray-400" />
              <span>Duration: <span className="font-medium">{getPulseDurationText(pulse.interval)}</span></span>
            </div>
            <div className="flex items-center text-purple-600">
              <Target className="h-4 w-4 mr-2" />
              <span className="font-semibold">{pulse.points} points</span>
            </div>
          </div>
        </div>
        
        {/* Execution Status */}
        {getExecutionDisplay()}
      </CardContent>
    </Card>
  );
}