import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@farcaster/auth-kit";
import type { Pulse, PulseExecution } from "@shared/schema";

export default function PulseListPage() {
  const { isAuthenticated, profile } = useProfile();
  const viewerFid = profile?.fid;

  // Fetch all pulses
  const { data: pulsesData, isLoading: pulsesLoading } = useQuery({
    queryKey: ["/api/pulses"],
    enabled: isAuthenticated,
  });

  // Fetch user's executions
  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: [`/api/executions/${viewerFid}`],
    enabled: isAuthenticated && !!viewerFid,
  });

  const getUserExecutionStatus = (pulseId: number) => {
    if (!executionsData?.executions) return { liked: false, recasted: false };
    
    const executions = executionsData.executions.filter(
      (exec: PulseExecution) => exec.pulseId === pulseId
    );
    
    return {
      liked: executions.some((exec: PulseExecution) => exec.actionType === 'like'),
      recasted: executions.some((exec: PulseExecution) => exec.actionType === 'recast'),
    };
  };

  const isPastDate = (date: string) => new Date(date) < new Date();
  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Please sign in to view pulses.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Community Pulses</h1>
          <p className="text-gray-600">Track your engagement with community activities</p>
        </header>

        {pulsesLoading || executionsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {pulsesData?.pulses?.map((pulse: Pulse) => {
              const executionStatus = getUserExecutionStatus(pulse.id);
              const past = isPastDate(pulse.date);
              const today = isToday(pulse.date);
              
              return (
                <div 
                  key={pulse.id} 
                  className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                    today ? 'border-l-green-500' : 
                    past ? 'border-l-gray-400' : 
                    'border-l-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-1">{pulse.description}</h3>
                      <p className="text-sm text-gray-600">
                        Date: {new Date(pulse.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        today ? 'bg-green-100 text-green-800' :
                        past ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {today ? 'Active Today' : past ? 'Completed' : 'Upcoming'}
                      </span>
                    </div>
                  </div>

                  {/* Farcaster URL */}
                  <div className="mb-4">
                    <a 
                      href={pulse.farcasterUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all"
                    >
                      {pulse.farcasterUrl}
                    </a>
                  </div>

                  {/* Execution Status */}
                  {past && (
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <span className={`w-3 h-3 rounded-full ${
                          executionStatus.liked ? 'bg-red-500' : 'bg-gray-300'
                        }`}></span>
                        <span className={executionStatus.liked ? 'text-green-600' : 'text-gray-500'}>
                          {executionStatus.liked ? 'Liked' : 'Not liked'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`w-3 h-3 rounded-full ${
                          executionStatus.recasted ? 'bg-green-500' : 'bg-gray-300'
                        }`}></span>
                        <span className={executionStatus.recasted ? 'text-green-600' : 'text-gray-500'}>
                          {executionStatus.recasted ? 'Recasted' : 'Not recasted'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Current Pulse Action */}
                  {today && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 mb-2">
                        This is today's active pulse! Visit the main page to interact with this post.
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <span className={`w-3 h-3 rounded-full ${
                            executionStatus.liked ? 'bg-red-500' : 'bg-gray-300'
                          }`}></span>
                          <span className={executionStatus.liked ? 'text-green-600' : 'text-gray-500'}>
                            {executionStatus.liked ? 'Liked ✓' : 'Like pending'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className={`w-3 h-3 rounded-full ${
                            executionStatus.recasted ? 'bg-green-500' : 'bg-gray-300'
                          }`}></span>
                          <span className={executionStatus.recasted ? 'text-green-600' : 'text-gray-500'}>
                            {executionStatus.recasted ? 'Recasted ✓' : 'Recast pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Future Pulse */}
                  {!past && !today && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        This pulse will be available on {new Date(pulse.date).toLocaleDateString()}.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {pulsesData?.pulses?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-2">No pulses available yet</p>
                <p className="text-gray-400">Check back soon for community engagement activities!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}