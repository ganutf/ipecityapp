import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedPost } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";
import {
  ProjectImageUploader,
  MemberMultiSelect,
  TechStackInput,
} from "@/components/projects";
import { projectStateLabel } from "@/components/projects/projectVisuals";
import { insertProjectSchema, type Project } from "@shared/schema";
import { PROJECT_STATES } from "@shared/constants";

type FormValues = z.input<typeof insertProjectSchema>;

export default function ProjectsNewPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { member, memberId } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      title: "",
      description: "",
      imageDataUrl: null,
      liveUrl: "",
      repoUrl: "",
      videoUrl: "",
      state: "idea",
      resultsAchieved: "",
      grantTitle: "",
      techStack: [],
      participantMemberIds: [],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const createMutation = useMutation<Project, Error, FormValues>({
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

  const onSubmit = (data: FormValues) => createMutation.mutate(data);

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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Image */}
            <section className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">Cover image</Label>
              <Controller
                control={control}
                name="imageDataUrl"
                render={({ field }) => (
                  <ProjectImageUploader
                    value={field.value ?? null}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    fallbackSeed={member?.ipeUsername ?? memberId ?? "project"}
                  />
                )}
              />
              {errors.imageDataUrl && (
                <p className="text-xs text-red-600">{errors.imageDataUrl.message}</p>
              )}
            </section>

            {/* Basics */}
            <section className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-semibold text-gray-900">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input id="title" placeholder="e.g. IpêMint" {...register("title")} disabled={isSubmitting} />
                {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold text-gray-900">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="What problem does it solve? Who is it for?"
                  className="min-h-[120px]"
                  {...register("description")}
                  disabled={isSubmitting}
                />
                {errors.description && (
                  <p className="text-xs text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-900">State</Label>
                <Controller
                  control={control}
                  name="state"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {projectStateLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </section>

            {/* Links */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Links</h2>
              <div className="space-y-2">
                <Label htmlFor="liveUrl" className="text-xs text-gray-600">Live app</Label>
                <Input
                  id="liveUrl"
                  placeholder="https://yourapp.com"
                  type="url"
                  {...register("liveUrl")}
                  disabled={isSubmitting}
                />
                {errors.liveUrl && <p className="text-xs text-red-600">{errors.liveUrl.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="repoUrl" className="text-xs text-gray-600">Repository</Label>
                <Input
                  id="repoUrl"
                  placeholder="https://github.com/you/project"
                  type="url"
                  {...register("repoUrl")}
                  disabled={isSubmitting}
                />
                {errors.repoUrl && <p className="text-xs text-red-600">{errors.repoUrl.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="videoUrl" className="text-xs text-gray-600">Demo video</Label>
                <Input
                  id="videoUrl"
                  placeholder="https://youtube.com/watch?v=…"
                  type="url"
                  {...register("videoUrl")}
                  disabled={isSubmitting}
                />
                {errors.videoUrl && (
                  <p className="text-xs text-red-600">{errors.videoUrl.message}</p>
                )}
              </div>
            </section>

            {/* Results */}
            <section className="space-y-2">
              <Label htmlFor="resultsAchieved" className="text-sm font-semibold text-gray-900">
                Results achieved
              </Label>
              <Textarea
                id="resultsAchieved"
                placeholder="What has this project produced so far? Users, milestones, learnings."
                className="min-h-[100px]"
                {...register("resultsAchieved")}
                disabled={isSubmitting}
              />
              {errors.resultsAchieved && (
                <p className="text-xs text-red-600">{errors.resultsAchieved.message}</p>
              )}
            </section>

            {/* Grant */}
            <section className="space-y-2">
              <Label htmlFor="grantTitle" className="text-sm font-semibold text-gray-900">
                Grant <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="grantTitle"
                placeholder="e.g. Optimism RPGF Round 5"
                {...register("grantTitle")}
                disabled={isSubmitting}
              />
              {errors.grantTitle && (
                <p className="text-xs text-red-600">{errors.grantTitle.message}</p>
              )}
              <p className="text-xs text-gray-500">
                If this project is funded by a specific grant, name it here.
              </p>
            </section>

            {/* Tech stack */}
            <section className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">Tech stack</Label>
              <Controller
                control={control}
                name="techStack"
                render={({ field }) => (
                  <TechStackInput
                    value={(field.value ?? []) as string[]}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
              {errors.techStack && (
                <p className="text-xs text-red-600">{(errors.techStack as { message?: string })?.message}</p>
              )}
            </section>

            {/* Participants */}
            <section className="space-y-2">
              <Label className="text-sm font-semibold text-gray-900">Participants</Label>
              <Controller
                control={control}
                name="participantMemberIds"
                render={({ field }) => (
                  <MemberMultiSelect
                    value={(field.value ?? []) as number[]}
                    onChange={field.onChange}
                    excludeMemberId={memberId ?? null}
                    disabled={isSubmitting}
                  />
                )}
              />
              {errors.participantMemberIds && (
                <p className="text-xs text-red-600">
                  {(errors.participantMemberIds as { message?: string })?.message}
                </p>
              )}
            </section>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || createMutation.isPending}
                className="bg-lime-500 hover:bg-lime-600 text-slate-900"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create project
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setLocation("/projects")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
