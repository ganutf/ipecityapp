import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ExternalLink,
  Github,
  Globe,
  Play,
  Award,
  Users,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { authenticatedDelete, authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { defaultAvatarUrl } from "@/lib/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  projectImageGradient,
  projectInitials,
  projectStateBadgeColor,
  projectStateLabel,
} from "@/components/projects/projectVisuals";
import type { Project, Member } from "@shared/schema";

interface ProjectDetailResponse {
  project: Project;
  creator: Member;
  participants: Member[];
}

export default function ProjectDetailPage() {
  const [, params] = useRoute<{ id: string }>("/projects/:id");
  const id = params?.id;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { member, memberId } = useAuth();

  const { data, isLoading, error } = useQuery<ProjectDetailResponse>({
    queryKey: id ? queryKeys.projects.detail(id) : queryKeys.projects.detail("missing"),
    queryFn: () => authenticatedGet(`/api/v2/projects/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation<void, Error>({
    mutationFn: () => authenticatedDelete(`/api/v2/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byMember(memberId) });
      }
      toast({
        title: "Project deleted",
        description: "The project has been removed.",
      });
      setLocation("/projects");
    },
    onError: (err) => {
      toast({
        title: "Could not delete project",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <Card className="bg-white shadow-sm">
          <CardContent className="p-12 text-center text-gray-500">
            Loading project…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-gray-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to projects
        </Link>
        <Card className="bg-white shadow-sm border-red-100">
          <CardContent className="p-6 text-center text-red-600">
            Project not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { project, creator, participants } = data;
  const builderName =
    creator.displayName || creator.ipeUsername || creator.ipePassport || `Member ${creator.id}`;
  const gradient = projectImageGradient(project.id);
  const stateBadge = projectStateBadgeColor(project.state);
  const initials = projectInitials(project.title);
  const canManage =
    !!memberId && (memberId === project.createdBy || member?.memberType === "admin");

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-gray-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to projects
        </Link>
        {canManage && (
          <div className="flex items-center gap-2">
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="outline" size="sm" className="border-gray-200">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes <span className="font-semibold">{project.title}</span> and
                    all its participant links. This action can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Card className="bg-white shadow-sm overflow-hidden rounded-2xl border border-gray-100">
        {/* Hero cover */}
        <div className="relative aspect-[21/9] w-full overflow-hidden">
          {project.imageDataUrl ? (
            <img
              src={project.imageDataUrl}
              alt={project.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-7xl sm:text-8xl font-bold text-white/85 tracking-tight drop-shadow-md">
                {initials}
              </span>
            </div>
          )}
          {/* Bottom darken for legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent pointer-events-none" />
          {/* State pill */}
          <span
            className={`absolute top-4 right-4 inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md ${stateBadge}`}
          >
            {projectStateLabel(project.state)}
          </span>
          {/* Creator chip */}
          <Link
            href={`/member/${creator.id}`}
            className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition-colors"
          >
            <img
              src={creator.profileImageUrl || defaultAvatarUrl(creator.id)}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="text-xs font-semibold text-slate-900">by {builderName}</span>
          </Link>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
              {project.title}
            </h1>
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed whitespace-pre-line mt-3">
              {project.description}
            </p>
          </div>

          {(project.liveUrl || project.repoUrl || project.videoUrl) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {project.liveUrl && (
                <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="mt-4">
                  <Button className="bg-lime-500 hover:bg-lime-600 text-slate-900 font-semibold shadow-sm">
                    <Globe className="h-4 w-4 mr-2" />
                    View live
                    <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </a>
              )}
              {project.repoUrl && (
                <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="mt-4">
                  <Button variant="outline" className="border-gray-200 hover:bg-gray-50">
                    <Github className="h-4 w-4 mr-2" />
                    Repository
                  </Button>
                </a>
              )}
              {project.videoUrl && (
                <a href={project.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-4">
                  <Button variant="outline" className="border-gray-200 hover:bg-gray-50">
                    <Play className="h-4 w-4 mr-2" />
                    Demo video
                  </Button>
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {project.resultsAchieved && (
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Results achieved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">
              {project.resultsAchieved}
            </p>
          </CardContent>
        </Card>
      )}

      {project.grantTitle && (
        <Card className="bg-white shadow-sm border-l-4 border-l-amber-500">
          <CardContent className="p-6 flex items-center gap-3">
            <Award className="h-6 w-6 text-amber-500" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Grant</p>
              <p className="text-base font-semibold text-gray-900">{project.grantTitle}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {project.techStack && project.techStack.length > 0 && (
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Tech stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {project.techStack.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-lime-50 text-slate-900 border border-lime-200 px-3 py-1"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            Participants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-gray-500">No participants listed.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participants.map((p) => {
                const name = p.displayName || p.ipeUsername || p.ipePassport || `Member ${p.id}`;
                return (
                  <Link
                    key={p.id}
                    href={`/member/${p.id}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <img
                      src={p.profileImageUrl || defaultAvatarUrl(p.id)}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {p.ipePassport && (
                        <p className="text-xs text-gray-500 truncate">{p.ipePassport}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
