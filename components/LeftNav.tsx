"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

const MY_PROJECTS = [
  { id: "test", name: "Product Redesign",  emoji: "🎨" },
  { id: "p2",   name: "API Documentation", emoji: "📝" },
];

const JOINED_PROJECTS = [
  { id: "p3", name: "Q4 Planning",      emoji: "📊" },
  { id: "p4", name: "Brand Guidelines", emoji: "🎯" },
];

export function LeftNav({ activeProjectId }: { activeProjectId?: string }) {
  const { profile, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/auth/login");
  }

  return (
    <nav className="w-52 border-r border-border bg-surface flex flex-col shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <Link
          href="/"
          className="font-serif text-xl text-foreground tracking-tight hover:opacity-80 transition-opacity"
        >
          Elenchus
        </Link>
      </div>

      {/* New project */}
      <div className="px-3 pt-4 pb-2">
        <button className="w-full flex items-center gap-2 text-xs font-medium text-foreground bg-background border border-border rounded-lg px-3 py-2 hover:border-foreground/20 transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New project
        </button>
      </div>

      {/* My projects */}
      <div className="px-3 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/50 px-2 mb-1.5">
          My projects
        </p>
        {MY_PROJECTS.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
            style={
              p.id === activeProjectId
                ? { backgroundColor: "var(--color-background)", color: "var(--color-foreground)", fontWeight: 500 }
                : { color: "var(--color-muted)" }
            }
          >
            <span className="text-base leading-none shrink-0">{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>

      {/* Projects I'm in */}
      <div className="px-3 pt-4 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/50 px-2 mb-1.5">
          Projects I&apos;m in
        </p>
        {JOINED_PROJECTS.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors"
            style={
              p.id === activeProjectId
                ? { backgroundColor: "var(--color-background)", color: "var(--color-foreground)", fontWeight: 500 }
                : { color: "var(--color-muted)" }
            }
          >
            <span className="text-base leading-none shrink-0">{p.emoji}</span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>

      {/* Bottom: user identity + settings */}
      <div className="px-3 py-3 border-t border-border shrink-0 flex flex-col gap-0.5">
        {profile && (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <Avatar
              name={profile.display_name}
              color={(profile.color as UserColor) ?? "blue"}
              size="xs"
            />
            <span className="text-sm text-foreground truncate flex-1">{profile.display_name}</span>
          </div>
        )}
        <Link
          href="/settings"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-background transition-colors w-full"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13v-2a1 1 0 0 0-1-1h-.757l-.707-1.707.535-.536a1 1 0 0 0 0-1.414l-1.414-1.414a1 1 0 0 0-1.414 0l-.536.535L14 4.757V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v.757l-1.707.707-.536-.535a1 1 0 0 0-1.414 0L4.929 6.343a1 1 0 0 0 0 1.414l.536.536L4.757 10H4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h.757l.707 1.707-.535.536a1 1 0 0 0 0 1.414l1.414 1.414a1 1 0 0 0 1.414 0l.536-.535 1.707.707V20a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-.757l1.707-.708.536.536a1 1 0 0 0 1.414 0l1.414-1.414a1 1 0 0 0 0-1.414l-.535-.536.707-1.707H20a1 1 0 0 0 1-1Z"/>
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
          </svg>
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-background transition-colors w-full text-left"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M4 2H2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            <path d="M7.5 3.5l2.5 2-2.5 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="10" y1="5.5" x2="4.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}
