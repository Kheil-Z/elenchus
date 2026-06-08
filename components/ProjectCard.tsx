import { Avatar } from "./Avatar";
import type { UserColor } from "@/lib/types";

interface Member {
  name: string;
  color: UserColor;
}

interface ProjectCardProps {
  emoji: string;
  name: string;
  description?: string;
  members: Member[];
  docCount: number;
  chatCount: number;
  lastActive: string;
}

export function ProjectCard({
  emoji,
  name,
  description,
  members,
  docCount,
  chatCount,
  lastActive,
}: ProjectCardProps) {
  const visibleMembers = members.slice(0, 4);
  const overflow = members.length - 4;

  return (
    <div className="group bg-surface rounded-xl border border-border p-5 cursor-pointer hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] transition-all duration-150">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl leading-none select-none shrink-0">{emoji}</span>
          <h3 className="font-medium text-[14px] text-foreground leading-snug truncate">{name}</h3>
        </div>
        <span className="text-[11px] text-muted shrink-0 ml-2">{lastActive}</span>
      </div>

      {description && (
        <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">{description}</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {visibleMembers.map((m) => (
              <Avatar
                key={m.name}
                name={m.name}
                color={m.color}
                size="sm"
                className="ring-2 ring-surface"
              />
            ))}
            {overflow > 0 && (
              <div className="w-7 h-7 rounded-full bg-background ring-2 ring-surface flex items-center justify-center text-[10px] text-muted font-medium">
                +{overflow}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-50">
              <path d="M2 2h8v7H7l-1 2-1-2H2V2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
            </svg>
            {chatCount}
          </span>
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-50">
              <path d="M2 1h6l2 2v8H2V1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            {docCount}
          </span>
        </div>
      </div>
    </div>
  );
}
