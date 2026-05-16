import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, Search } from "lucide-react";
import { authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ProjectCard, type ProjectListItem } from "@/components/projects";
import { PROJECT_STATES } from "@shared/constants";
import { projectStateLabel } from "@/components/projects/projectVisuals";
import { useAuth } from "@/contexts/AuthContext";

interface ProjectsResponse {
  projects: ProjectListItem[];
}

type StateFilter = "all" | (typeof PROJECT_STATES)[number];

export default function ProjectsPage() {
  const { isAuthenticated, login } = useAuth();
  const { data, isLoading, error } = useQuery<ProjectsResponse>({
    queryKey: queryKeys.projects.all,
    queryFn: () => authenticatedGet("/api/v2/projects"),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");

  const newProjectButton = (
    <Button
      onClick={isAuthenticated ? undefined : () => login()}
      className="bg-lime-500 hover:bg-lime-600 text-slate-900"
    >
      <Plus className="h-4 w-4 mr-2" />
      New Project
    </Button>
  );

  const createFirstButton = (
    <Button
      onClick={isAuthenticated ? undefined : () => login()}
      className="bg-lime-500 hover:bg-lime-600 text-slate-900"
    >
      <Plus className="h-4 w-4 mr-2" />
      Create the first project
    </Button>
  );

  const filtered = useMemo(() => {
    const all = data?.projects ?? [];
    const q = searchQuery.trim().toLowerCase();
    return all.filter((p) => {
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.description,
        p.creator.displayName,
        p.creator.ipeUsername,
        p.creator.ipePassport,
        ...(p.techStack ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, searchQuery, stateFilter]);

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <Card className="bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-lime-50 rounded-full flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-lime-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
                <p className="text-sm text-gray-600 mt-1">
                  What the Ipê City community is building
                </p>
              </div>
            </div>
            {isAuthenticated ? (
              <Link href="/projects/new">{newProjectButton}</Link>
            ) : (
              newProjectButton
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by title, description, builder, or tech…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={stateFilter === "all"} onClick={() => setStateFilter("all")}>
              All
            </FilterChip>
            {PROJECT_STATES.map((s) => (
              <FilterChip
                key={s}
                active={stateFilter === s}
                onClick={() => setStateFilter(s)}
              >
                {projectStateLabel(s)}
              </FilterChip>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="bg-white shadow-sm">
          <CardContent className="p-12 text-center text-gray-500">
            Loading projects…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="bg-white shadow-sm border-red-100">
          <CardContent className="p-6 text-center text-red-600">
            Failed to load projects. Please try again.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <Card className="bg-white shadow-sm">
          <CardContent className="p-12 text-center space-y-3">
            <Briefcase className="h-10 w-10 text-gray-300 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">
              {data?.projects?.length ? "No projects match your filters" : "No projects yet"}
            </h2>
            <p className="text-sm text-gray-600">
              {data?.projects?.length
                ? "Try a different search or state filter."
                : "Be the first to share what you're building."}
            </p>
            {!data?.projects?.length &&
              (isAuthenticated ? (
                <Link href="/projects/new">{createFirstButton}</Link>
              ) : (
                createFirstButton
              ))}
          </CardContent>
        </Card>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-full"
    >
      <Badge
        variant={active ? "default" : "secondary"}
        className={
          active
            ? "bg-slate-900 text-white px-3 py-1 cursor-pointer"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1 cursor-pointer"
        }
      >
        {children}
      </Badge>
    </button>
  );
}
