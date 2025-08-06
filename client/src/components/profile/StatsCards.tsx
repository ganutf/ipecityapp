import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, Calendar } from "lucide-react";

interface StatsCardsProps {
  totalPoints?: number;
  pulseStreak?: number;
  createdAt?: string;
}

export function StatsCards({ totalPoints = 0, pulseStreak = 0, createdAt }: StatsCardsProps) {
  // Format join date
  const joinDate = createdAt ? new Date(createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    year: "numeric"
  }) : 'Unknown';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
              <p className="text-sm text-gray-600">Total Points</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Target className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pulseStreak}</p>
              <p className="text-sm text-gray-600">Pulse Streak</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{joinDate}</p>
              <p className="text-sm text-gray-600">Member Since</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}