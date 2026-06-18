"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

interface ChatHeaderProps {
  title: string;
  projectName: string;
  projectId?: string;
  navOpen?: boolean;
  onToggleNav?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onRenameTitle?: (newName: string) => Promise<void>;
}

export function ChatHeader({
  title,
  projectName,
  projectId,
  navOpen,
  onToggleNav,
  sidebarOpen,
  onToggleSidebar,
  onRenameTitle,
}: ChatHeaderProps) {
  const { profile, user } = useAuth();
  const displayName = profile?.display_name ?? user?.email ?? "";
  const displayColor = (profile?.color as UserColor) ?? "blue";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (!onRenameTitle) return;
    setDraft(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title || saving || !onRenameTitle) { setEditing(false); return; }
    setSaving(true);
    await onRenameTitle(trimmed);
    setSaving(false);
    setEditing(false);
  }

  const projectHref = projectId ? `/project/${projectId}` : "/";

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
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
        href={projectHref}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {projectName}
      </Link>

      <span className="text-border text-sm select-none">/</span>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveEdit(); }
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={saveEdit}
          disabled={saving}
          maxLength={120}
          className="text-sm font-medium text-foreground bg-transparent border-b border-foreground/40 focus:outline-none focus:border-foreground flex-1 min-w-0 disabled:opacity-50"
        />
      ) : (
        <button
          onClick={onRenameTitle ? startEdit : undefined}
          title={onRenameTitle ? "Click to rename" : undefined}
          className={`text-sm font-medium text-foreground flex-1 truncate text-left ${onRenameTitle ? "hover:opacity-70 transition-opacity" : "cursor-default"}`}
        >
          {title}
        </button>
      )}

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

      {displayName && (
        <Link href="/settings" className="shrink-0" title="Settings">
          <Avatar name={displayName} color={displayColor} size="sm" />
        </Link>
      )}
    </header>
  );
}
