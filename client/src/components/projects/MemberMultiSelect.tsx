import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X, Users } from "lucide-react";
import { authenticatedGet } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { defaultAvatarUrl } from "@/lib/avatar";
import { PROJECT_VALIDATION_LIMITS } from "@shared/constants";

interface CommunityMember {
  id: number;
  displayName?: string | null;
  ipeUsername?: string | null;
  ipePassport?: string | null;
  profileImageUrl?: string | null;
}

interface CommunityMembersResponse {
  members: CommunityMember[];
}

interface MemberMultiSelectProps {
  value: number[];
  onChange: (next: number[]) => void;
  excludeMemberId?: number | null;
  disabled?: boolean;
}

export function MemberMultiSelect({
  value,
  onChange,
  excludeMemberId,
  disabled,
}: MemberMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<CommunityMembersResponse>({
    queryKey: queryKeys.members.community(),
    queryFn: () => authenticatedGet("/api/v2/community/members"),
  });

  const members = useMemo(() => data?.members ?? [], [data]);

  const selectableMembers = useMemo(
    () => members.filter((m) => m.id !== excludeMemberId),
    [members, excludeMemberId],
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => value.includes(m.id)),
    [members, value],
  );

  const toggle = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      if (value.length >= PROJECT_VALIDATION_LIMITS.MAX_PARTICIPANTS) return;
      onChange([...value, id]);
    }
  };

  const memberLabel = (m: CommunityMember) =>
    m.displayName || m.ipeUsername || m.ipePassport || `Member ${m.id}`;

  const limitReached = value.length >= PROJECT_VALIDATION_LIMITS.MAX_PARTICIPANTS;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              {value.length === 0
                ? "Search and add participants…"
                : `${value.length} participant${value.length === 1 ? "" : "s"} selected`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command>
            <CommandInput placeholder="Search by name, username, or passport…" />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading members…" : "No matching members."}
              </CommandEmpty>
              <CommandGroup>
                {selectableMembers.map((m) => {
                  const checked = value.includes(m.id);
                  return (
                    <CommandItem
                      key={m.id}
                      value={`${memberLabel(m)} ${m.ipeUsername ?? ""} ${m.ipePassport ?? ""}`}
                      onSelect={() => toggle(m.id)}
                      disabled={!checked && limitReached}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`}
                      />
                      <img
                        src={m.profileImageUrl || defaultAvatarUrl(m.id)}
                        alt=""
                        className="h-6 w-6 rounded-full mr-2 object-cover"
                      />
                      <span className="flex-1 truncate">{memberLabel(m)}</span>
                      {m.ipePassport && (
                        <span className="ml-2 text-xs text-gray-400 truncate">
                          {m.ipePassport}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedMembers.map((m) => (
            <Badge
              key={m.id}
              variant="secondary"
              className="pl-1 pr-1 py-1 text-xs font-medium bg-sky-50 text-slate-900 border border-sky-200"
            >
              <img
                src={m.profileImageUrl || defaultAvatarUrl(m.id)}
                alt=""
                className="h-5 w-5 rounded-full mr-2 object-cover"
              />
              {memberLabel(m)}
              <button
                type="button"
                onClick={() => toggle(m.id)}
                disabled={disabled}
                className="ml-1 rounded-full p-0.5 hover:bg-sky-200 transition-colors"
                aria-label={`Remove ${memberLabel(m)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        {value.length}/{PROJECT_VALIDATION_LIMITS.MAX_PARTICIPANTS} participants · You're added automatically as the builder.
      </p>
    </div>
  );
}
