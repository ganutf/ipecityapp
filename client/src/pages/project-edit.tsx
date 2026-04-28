import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedGet, authenticatedPatch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectForm, type ProjectFormValues } from "@/components/projects";
import type { Member, Project } from "@shared/schema";

interface ProjectDetailResponse {
  project: Project;
  creator: Member;
  participants: Member[];
}

export default function ProjectEditPage() {
  const [, params] = useRoute<{ id: string }>("/projects/:id/edit");
  const id = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { member, memberId } = useAuth();

  const { data, isLoading, error } = useQuery<ProjectDetailResponse>({
    queryKey: id ? queryKeys.projects.detail(id) : queryKeys.projects.detail("missing"),
    queryFn: () => authenticatedGet(`/api/v2/projects/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation<Project, Error, ProjectFormValues>({
    mutationFn: (input) => authenticatedPatch(`/api/v2/projects/${id}`, input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byMember(memberId) });
      }
      toast({
        title: "Project updated",
        description: `${project.title} has been saved.`,
      });
      setLocation(`/projects/${project.id}`);
    },
    onError: (err) => {
      toast({
        title: "Could not update project",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto">
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
      <div className="w-full max-w-3xl mx-auto space-y-4">
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

  // Permission gate
  const canEdit = !!memberId && (memberId === project.createdBy || member?.memberType === "admin");
  if (!canEdit) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to project
        </Link>
        <Card className="bg-white shadow-sm">
          <CardContent className="p-6 text-center text-gray-700">
            You don't have permission to edit this project.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Strip the creator out of the participants list — service auto-adds them
  const initialParticipants = participants
    .map((p) => p.id)
    .filter((mid) => mid !== project.createdBy);

  const defaults: Partial<ProjectFormValues> = {
    title: project.title,
    description: project.description,
    imageDataUrl: project.imageDataUrl ?? null,
    liveUrl: project.liveUrl ?? "",
    repoUrl: project.repoUrl ?? "",
    videoUrl: project.videoUrl ?? "",
    state: project.state as ProjectFormValues["state"],
    resultsAchieved: project.resultsAchieved ?? "",
    grantTitle: project.grantTitle ?? "",
    techStack: project.techStack ?? [],
    participantMemberIds: initialParticipants,
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 md:space-y-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to project
        </Link>
      </div>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-lime-50 rounded-full flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-lime-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">Edit Project</CardTitle>
              <CardDescription>Update the details for {project.title}.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectForm
            defaultValues={defaults}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            onSubmit={(data) => updateMutation.mutate(data)}
            onCancel={() => setLocation(`/projects/${project.id}`)}
            isPending={updateMutation.isPending}
            excludeMemberId={creator.id}
            imageFallbackSeed={creator.ipeUsername ?? creator.id ?? "project"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
