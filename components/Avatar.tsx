import type { UserColor } from "@/lib/types";

const colorMap: Record<UserColor, { bg: string; text: string }> = {
  blue:   { bg: "#DBEAFE", text: "#1D4ED8" },
  green:  { bg: "#DCFCE7", text: "#15803D" },
  purple: { bg: "#F3E8FF", text: "#7E22CE" },
  coral:  { bg: "#FEE2E2", text: "#B91C1C" },
  amber:  { bg: "#FEF3C7", text: "#92400E" },
};

const sizeClasses = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-11 h-11 text-sm",
};

interface AvatarProps {
  name: string;
  color: UserColor;
  size?: keyof typeof sizeClasses;
  className?: string;
  showOnline?: boolean;
}

export function Avatar({ name, color, size = "md", className = "", showOnline }: AvatarProps) {
  const { bg, text } = colorMap[color];
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold`}
        style={{ backgroundColor: bg, color: text }}
      >
        {initials}
      </div>
      {showOnline && (
        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 ring-2 ring-surface" />
      )}
    </div>
  );
}
