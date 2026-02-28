import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Target, Coins } from "lucide-react";

interface StatsCardsProps {
  totalPoints?: number;
  pulseStreak?: number;
  createdAt?: string;
  ipeBalance?: string;
}

export function StatsCards({ totalPoints = 0, pulseStreak = 0, createdAt, ipeBalance = '0' }: StatsCardsProps) {

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* IPE Balance - First */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-lime-100 rounded-full flex items-center justify-center">
              <Coins className="h-5 w-5 text-lime-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {ipeBalance}
              </p>
              <p className="text-sm text-gray-600">IPE Balance</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Points - Second */}
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

      {/* Pulse Streak - Third */}
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
    </div>
  );
}
