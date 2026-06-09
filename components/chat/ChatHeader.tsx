"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

interface ChatHeaderProps {
  title: string;
  projectName: string;
  navOpen?: boolean;
  onToggleNav?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatHeader({ title, projectName, navOpen, onToggleNav, sidebarOpen, onToggleSidebar }: ChatHeaderProps) {
  const { profile, user } = useAuth();
  const displayName = profile?.display_name ?? user?.email ?? "";
  const displayColor = (profile?.color as UserColor) ?? "blue";

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
      {/* Nav toggle */}
      {onToggleNav && (
        <button
          onClick={onToggleNav}
          aria-label={navOpen ? "Hide navigation" : "Show navigation"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="5.5" y1="1.5" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      )}

      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {projectName}
      </Link>

      <span className="text-border text-sm select-none">/</span>

      <h1 className="text-sm font-medium text-foreground flex-1 truncate">{title}</h1>

      {/* Sidebar toggle */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors shrink-0"
          style={{ color: sidebarOpen ? "var(--color-foreground)" : "var(--color-muted)" }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <rect x="1" y="1.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9.5" y1="1.5" x2="9.5" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
            {sidebarOpen
              ? <path d="M11.5 6.5L12.5 7.5L11.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M12.5 6.5L11.5 7.5L12.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>
      )}

      {/* User avatar — decorative, shows current identity */}
      {displayName && (
        <div className="shrink-0">
          <Avatar name={displayName} color={displayColor} size="sm" />
        </div>
      )}
    </header>
  );
}
