import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ExternalLink, ImageIcon } from "lucide-react";
import { defaultAvatarUrl } from "@/lib/avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  projectImageGradient,
  projectInitials,
  projectStateBadgeColor,
  projectStateLabel,
} from "./projectVisuals";
import type { Project } from "@shared/schema";

interface ProjectClickWrapperProps {
  projectId: number;
  className: string;
  children: React.ReactNode;
}

function ProjectClickWrapper({ projectId, className, children }: ProjectClickWrapperProps) {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return (
      <Link href={`/projects/${projectId}`} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => login()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          login();
        }
      }}
      className={`${className} cursor-pointer`}
    >
      {children}
    </div>
  );
}

export interface ProjectListItem extends Project {
  creator: {
    id: number;
    displayName?: string | null;
    ipeUsername?: string | null;
    ipePassport?: string | null;
    profileImageUrl?: string | null;
    farcasterFid?: number | null;
  };
}

interface ProjectCardProps {
  project: ProjectListItem;
  variant?: "full" | "compact";
}

export function ProjectCard({ project, variant = "full" }: ProjectCardProps) {
  if (variant === "compact") return <CompactProjectCard project={project} />;
  return <FullProjectCard project={project} />;
}

function FullProjectCard({ project }: { project: ProjectListItem }) {
  const builderName =
    project.creator.displayName ||
    project.creator.ipeUsername ||
    project.creator.ipePassport ||
    `Member ${project.creator.id}`;

  const gradient = projectImageGradient(project.id);
  const stateBadge = projectStateBadgeColor(project.state);
  const initials = projectInitials(project.title);
  const techPreview = (project.techStack ?? []).slice(0, 3);
  const techExtra = (project.techStack?.length ?? 0) - techPreview.length;

  return (
    <Card className="group bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden rounded-xl border border-gray-100">
      <ProjectClickWrapper
        projectId={project.id}
        className="block focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-xl"
      >
        {/* Cover */}
        <div className="relative aspect-[5/3] overflow-hidden bg-gray-100">
          {project.imageDataUrl ? (
            <img
              src={project.imageDataUrl}
              alt={project.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center relative`}>
              <span className="text-5xl font-bold text-white/80 tracking-tight drop-shadow-sm">
                {initials}
              </span>
              <ImageIcon className="absolute bottom-3 right-3 h-4 w-4 text-white/50" />
            </div>
          )}
          {/* Bottom gradient for legibility if any future overlay text */}
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />
          {/* State pill */}
          <span
            className={`absolute top-3 right-3 inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm ${stateBadge}`}
          >
            {projectStateLabel(project.state)}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <div>
            <h3
              className="text-lg font-semibold text-gray-900 leading-snug line-clamp-1 group-hover:text-slate-700 transition-colors"
              title={project.title}
            >
              {project.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2 mt-1.5 leading-relaxed">
              {project.description}
            </p>
          </div>

          {techPreview.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {techPreview.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md"
                >
                  {tag}
                </span>
              ))}
              {techExtra > 0 && (
                <span className="inline-flex items-center text-[11px] font-medium text-slate-500 px-1">
                  +{techExtra}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={project.creator.profileImageUrl || defaultAvatarUrl(project.creator.id)}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 leading-none">
                  Builder
                </p>
                <p className="text-sm font-medium text-gray-900 truncate leading-tight mt-0.5">
                  {builderName}
                </p>
              </div>
            </div>
            {project.liveUrl ? (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap px-2 py-1 rounded-md hover:bg-sky-50 transition-colors flex-shrink-0"
              >
                Live
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                In progress
              </span>
            )}
          </div>
        </div>
      </ProjectClickWrapper>
    </Card>
  );
}

function CompactProjectCard({ project }: { project: ProjectListItem }) {
  const builderName =
    project.creator.displayName ||
    project.creator.ipeUsername ||
    project.creator.ipePassport ||
    `Member ${project.creator.id}`;

  const gradient = projectImageGradient(project.id);
  const stateBadge = projectStateBadgeColor(project.state);
  const initials = projectInitials(project.title);

  return (
    <Card className="group bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden rounded-lg border border-gray-100">
      <ProjectClickWrapper
        projectId={project.id}
        className="flex items-center gap-3 p-3 focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-lg"
      >
        <div className="relative h-14 w-14 rounded-md overflow-hidden flex-shrink-0">
          {project.imageDataUrl ? (
            <img src={project.imageDataUrl} alt={project.title} className="h-full w-full object-cover" />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-base font-bold text-white/85">{initials}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{project.title}</h3>
            <span
              className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${stateBadge}`}
            >
              {projectStateLabel(project.state)}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">{project.description}</p>
          <p className="text-[11px] text-gray-500 mt-1 truncate">by {builderName}</p>
        </div>
      </ProjectClickWrapper>
    </Card>
  );
}
