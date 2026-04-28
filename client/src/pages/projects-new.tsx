import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedPost } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectForm, type ProjectFormValues } from "@/components/projects";
import type { Project } from "@shared/schema";

export default function ProjectsNewPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { member, memberId } = useAuth();

  const createMutation = useMutation<Project, Error, ProjectFormValues>({
    mutationFn: (data) => authenticatedPost("/api/v2/projects", data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      if (memberId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byMember(memberId) });
      }
      toast({
        title: "Project created",
        description: `${project.title} is now live in the directory.`,
      });
      setLocation(`/projects/${project.id}`);
    },
    onError: (err) => {
      toast({
        title: "Could not create project",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4 md:space-y-6">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-gray-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to projects
        </Link>
      </div>

      <Card className="bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-lime-50 rounded-full flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-lime-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900">New Project</CardTitle>
              <CardDescription>Share what you're building with Ipê City.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectForm
            submitLabel="Create project"
            pendingLabel="Creating…"
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setLocation("/projects")}
            isPending={createMutation.isPending}
            excludeMemberId={memberId ?? null}
            imageFallbackSeed={member?.ipeUsername ?? memberId ?? "project"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
