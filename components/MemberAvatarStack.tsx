import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";
import type { MemberPreview } from "@/lib/db";

interface MemberAvatarStackProps {
  members: MemberPreview[];
  max?: number;
  size?: "xs" | "sm";
}

export function MemberAvatarStack({ members, max = 4, size = "xs" }: MemberAvatarStackProps) {
  if (members.length === 0) return null;
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center">
        {visible.map((m, i) => (
          <div
            key={m.userId}
            className="rounded-full ring-2 ring-surface"
            style={{ marginLeft: i === 0 ? 0 : "-6px", zIndex: visible.length - i }}
            title={m.name}
          >
            <Avatar name={m.name} color={(m.color as UserColor) ?? "blue"} size={size} />
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <span className="text-[10px] text-muted whitespace-nowrap">+{overflow} others</span>
      )}
    </div>
  );
}
