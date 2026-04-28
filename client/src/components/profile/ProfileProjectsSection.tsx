import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, Plus } from "lucide-react";
import { authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
  projectImageGradient,
  projectStateAccent,
  projectStateLabel,
} from "@/components/projects/projectVisuals";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";
import type { Project } from "@shared/schema";

interface ProfileProjectsSectionProps {
  memberId: number | null | undefined;
  isOwnProfile?: boolean;
}

interface ProjectsByMemberResponse {
  projects: Project[];
}

export function ProfileProjectsSection({
  memberId,
  isOwnProfile = true,
}: ProfileProjectsSectionProps) {
  const { data, isLoading } = useQuery<ProjectsByMemberResponse>({
    queryKey: memberId
      ? queryKeys.projects.byMember(memberId)
      : queryKeys.projects.byMember("none"),
    queryFn: () => authenticatedGet(`/api/v2/projects/by-member/${memberId}`),
    enabled: !!memberId,
  });

  const projects = data?.projects ?? [];

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-lime-600" />
            Projects
          </CardTitle>
          {isOwnProfile && (
            <Link href="/projects/new">
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </Link>
          )}
        </div>
        <p className="text-sm text-gray-500">Built or contributed</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-gray-600">
              {isOwnProfile
                ? "You haven't published any projects yet."
                : "No projects yet."}
            </p>
            {isOwnProfile && (
              <Link href="/projects/new">
                <Button
                  size="sm"
                  className="bg-lime-500 hover:bg-lime-600 text-slate-900"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add your first project
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((project) => {
              const accent = projectStateAccent(project.state);
              const gradient = projectImageGradient(project.id);
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`flex items-center gap-3 p-3 rounded-md border-l-4 bg-gray-50 hover:bg-white hover:shadow-sm transition-all ${accent}`}
                >
                  <div className="h-12 w-12 rounded-md overflow-hidden flex-shrink-0 ring-1 ring-gray-100">
                    {project.imageDataUrl ? (
                      <img
                        src={project.imageDataUrl}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                        <ImageIcon className="h-4 w-4 text-white/70" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {project.title}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {project.description}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs whitespace-nowrap bg-gray-100 text-gray-700"
                  >
                    {projectStateLabel(project.state)}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
