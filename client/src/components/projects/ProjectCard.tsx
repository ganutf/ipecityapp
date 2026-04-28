import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ImageIcon } from "lucide-react";
import { defaultAvatarUrl } from "@/lib/avatar";
import { projectImageGradient, projectStateAccent, projectStateLabel } from "./projectVisuals";
import type { Project } from "@shared/schema";

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
  const builderName =
    project.creator.displayName ||
    project.creator.ipeUsername ||
    project.creator.ipePassport ||
    `Member ${project.creator.id}`;

  const gradient = projectImageGradient(project.id);
  const accent = projectStateAccent(project.state);
  const compact = variant === "compact";

  return (
    <Card
      className={`border-l-4 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${accent}`}
    >
      <Link
        href={`/projects/${project.id}`}
        className="block focus:outline-none focus:ring-2 focus:ring-lime-500 rounded-r-lg"
      >
        <div className={`flex ${compact ? "flex-row items-center gap-3 p-3" : "flex-col sm:flex-row gap-4 p-4"}`}>
          <div
            className={`relative ${compact ? "h-16 w-16" : "h-24 w-24 sm:h-32 sm:w-32"} rounded-md overflow-hidden flex-shrink-0 ring-1 ring-gray-100`}
          >
            {project.imageDataUrl ? (
              <img
                src={project.imageDataUrl}
                alt={project.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                <ImageIcon className={`${compact ? "h-5 w-5" : "h-8 w-8"} text-white/70`} />
              </div>
            )}
          </div>

          <CardContent className="flex-1 p-0 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`${compact ? "text-base" : "text-lg"} font-semibold text-gray-900 truncate`}>
                {project.title}
              </h3>
              <Badge variant="secondary" className="text-xs whitespace-nowrap bg-gray-100 text-gray-700">
                {projectStateLabel(project.state)}
              </Badge>
            </div>
            <p className={`${compact ? "text-xs line-clamp-1" : "text-sm line-clamp-2"} text-gray-600 mt-1`}>
              {project.description}
            </p>
            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={project.creator.profileImageUrl || defaultAvatarUrl(project.creator.id)}
                  alt=""
                  className={`${compact ? "h-5 w-5" : "h-6 w-6"} rounded-full object-cover flex-shrink-0`}
                />
                <span className="text-xs text-gray-600 truncate">by {builderName}</span>
              </div>
              {project.liveUrl && (
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-xs font-medium text-sky-600 hover:text-sky-700 whitespace-nowrap"
                >
                  View live
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              )}
            </div>
          </CardContent>
        </div>
      </Link>
    </Card>
  );
}
