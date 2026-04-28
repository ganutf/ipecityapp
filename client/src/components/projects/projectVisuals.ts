import type { ProjectState } from "@shared/constants";

const GRADIENT_PALETTES = [
  "from-lime-200 via-emerald-200 to-sky-200",
  "from-sky-200 via-indigo-200 to-purple-200",
  "from-amber-200 via-orange-200 to-rose-200",
  "from-purple-200 via-pink-200 to-rose-200",
  "from-emerald-200 via-teal-200 to-cyan-200",
  "from-rose-200 via-amber-200 to-yellow-200",
] as const;

export function projectImageGradient(seed: number | string | null | undefined): string {
  const s = seed == null || seed === "" ? "anon" : String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length];
}

export function projectStateLabel(state: string | null | undefined): string {
  switch (state) {
    case "idea":
      return "Idea";
    case "mockup":
      return "Mockup";
    case "working_prototype":
      return "Working Prototype";
    case "beta":
      return "Beta";
    default:
      return state ?? "Idea";
  }
}

export function projectStateAccent(state: string | null | undefined): string {
  switch (state as ProjectState) {
    case "idea":
      return "border-l-amber-500";
    case "mockup":
      return "border-l-sky-500";
    case "working_prototype":
      return "border-l-lime-500";
    case "beta":
      return "border-l-purple-500";
    default:
      return "border-l-slate-400";
  }
}
