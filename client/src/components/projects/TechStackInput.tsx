import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { PROJECT_VALIDATION_LIMITS } from "@shared/constants";

interface TechStackInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function TechStackInput({ value, onChange, disabled }: TechStackInputProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (tag.length > PROJECT_VALIDATION_LIMITS.TECH_TAG_MAX) return;
    if (value.length >= PROJECT_VALIDATION_LIMITS.MAX_TECH_STACK) return;
    if (value.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const limitReached = value.length >= PROJECT_VALIDATION_LIMITS.MAX_TECH_STACK;

  return (
    <div className="space-y-2">
      <Input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(draft)}
        placeholder={limitReached ? "Limit reached" : "Type a tag and press Enter"}
        disabled={disabled || limitReached}
        maxLength={PROJECT_VALIDATION_LIMITS.TECH_TAG_MAX}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag, idx) => (
            <Badge
              key={`${tag}-${idx}`}
              variant="secondary"
              className="pl-3 pr-1 py-1 text-xs font-medium bg-lime-50 text-slate-900 border border-lime-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="ml-1 rounded-full p-0.5 hover:bg-lime-200 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">
        {value.length}/{PROJECT_VALIDATION_LIMITS.MAX_TECH_STACK} tags · Enter or comma to add
      </p>
    </div>
  );
}
