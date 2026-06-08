import { Avatar } from "./Avatar";
import type { UserColor } from "@/lib/types";

interface Participant {
  name: string;
  color: UserColor;
}

interface RecentChatItemProps {
  title: string;
  project: string;
  participants: Participant[];
  preview: string;
  time: string;
}

export function RecentChatItem({
  title,
  project,
  participants,
  preview,
  time,
}: RecentChatItemProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-surface cursor-pointer transition-colors group">
      <div className="flex -space-x-2 shrink-0">
        {participants.slice(0, 3).map((p) => (
          <Avatar
            key={p.name}
            name={p.name}
            color={p.color}
            size="sm"
            className="ring-2 ring-background group-hover:ring-surface transition-all"
          />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground truncate">{title}</span>
          <span className="text-[11px] text-muted shrink-0 border border-border rounded px-1.5 py-0.5">
            {project}
          </span>
        </div>
        <p className="text-xs text-muted truncate">{preview}</p>
      </div>

      <span className="text-xs text-muted shrink-0 tabular-nums">{time}</span>
    </div>
  );
}
