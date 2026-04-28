import { useForm, Controller, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Loader2 } from "lucide-react";
import { ProjectImageUploader } from "./ProjectImageUploader";
import { MemberMultiSelect } from "./MemberMultiSelect";
import { TechStackInput } from "./TechStackInput";
import { projectStateLabel } from "./projectVisuals";
import { insertProjectSchema } from "@shared/schema";
import { PROJECT_STATES } from "@shared/constants";

export type ProjectFormValues = z.input<typeof insertProjectSchema>;

interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormValues>;
  submitLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
  onCancel?: () => void;
  isPending?: boolean;
  excludeMemberId?: number | null;
  imageFallbackSeed?: string | number | null;
}

const EMPTY_DEFAULTS: ProjectFormValues = {
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
};

export function ProjectForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  onSubmit,
  onCancel,
  isPending = false,
  excludeMemberId,
  imageFallbackSeed,
}: ProjectFormProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      ...EMPTY_DEFAULTS,
      ...defaultValues,
    } as DefaultValues<ProjectFormValues>,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const submitting = isSubmitting || isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <section className="space-y-2">
        <Label className="text-sm font-semibold text-gray-900">Cover image</Label>
        <Controller
          control={control}
          name="imageDataUrl"
          render={({ field }) => (
            <ProjectImageUploader
              value={field.value ?? null}
              onChange={field.onChange}
              disabled={submitting}
              fallbackSeed={imageFallbackSeed ?? "project"}
            />
          )}
        />
        {errors.imageDataUrl && (
          <p className="text-xs text-red-600">{errors.imageDataUrl.message}</p>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold text-gray-900">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input id="title" placeholder="e.g. IpêMint" {...register("title")} disabled={submitting} />
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
            disabled={submitting}
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
                disabled={submitting}
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

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Links</h2>
        <div className="space-y-2">
          <Label htmlFor="liveUrl" className="text-xs text-gray-600">Live app</Label>
          <Input
            id="liveUrl"
            placeholder="https://yourapp.com"
            type="url"
            {...register("liveUrl")}
            disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
          />
          {errors.videoUrl && (
            <p className="text-xs text-red-600">{errors.videoUrl.message}</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="resultsAchieved" className="text-sm font-semibold text-gray-900">
          Results achieved
        </Label>
        <Textarea
          id="resultsAchieved"
          placeholder="What has this project produced so far? Users, milestones, learnings."
          className="min-h-[100px]"
          {...register("resultsAchieved")}
          disabled={submitting}
        />
        {errors.resultsAchieved && (
          <p className="text-xs text-red-600">{errors.resultsAchieved.message}</p>
        )}
      </section>

      <section className="space-y-2">
        <Label htmlFor="grantTitle" className="text-sm font-semibold text-gray-900">
          Grant <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Input
          id="grantTitle"
          placeholder="e.g. Optimism RPGF Round 5"
          {...register("grantTitle")}
          disabled={submitting}
        />
        {errors.grantTitle && (
          <p className="text-xs text-red-600">{errors.grantTitle.message}</p>
        )}
        <p className="text-xs text-gray-500">
          If this project is funded by a specific grant, name it here.
        </p>
      </section>

      <section className="space-y-2">
        <Label className="text-sm font-semibold text-gray-900">Tech stack</Label>
        <Controller
          control={control}
          name="techStack"
          render={({ field }) => (
            <TechStackInput
              value={(field.value ?? []) as string[]}
              onChange={field.onChange}
              disabled={submitting}
            />
          )}
        />
        {errors.techStack && (
          <p className="text-xs text-red-600">{(errors.techStack as { message?: string })?.message}</p>
        )}
      </section>

      <section className="space-y-2">
        <Label className="text-sm font-semibold text-gray-900">Participants</Label>
        <Controller
          control={control}
          name="participantMemberIds"
          render={({ field }) => (
            <MemberMultiSelect
              value={(field.value ?? []) as number[]}
              onChange={field.onChange}
              excludeMemberId={excludeMemberId ?? null}
              disabled={submitting}
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
          disabled={submitting}
          className="bg-lime-500 hover:bg-lime-600 text-slate-900"
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isPending && pendingLabel ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
