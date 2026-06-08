"use client";

import { useState } from "react";
import Link from "next/link";
import { LeftNav } from "@/components/LeftNav";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectMember {
  name: string;
  color: UserColor;
}

interface Project {
  id: string;
  name: string;
  emoji: string;
  description: string;
  members: ProjectMember[];
  docCount: number;
  chatCount: number;
  lastActive: string;
}

interface RecentChat {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  participants: ProjectMember[];
  lastAuthor: string;
  lastMessage: string;
  time: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const CURRENT_USER = { name: "Alex Kim", color: "blue" as UserColor, email: "alex.kim@example.com" };

const MY_PROJECTS: Project[] = [
  {
    id: "test",
    name: "Product Redesign",
    emoji: "🎨",
    description: "Onboarding flow and navigation redesign for Q3 launch.",
    members: [
      { name: "Alex Kim",   color: "blue"   },
      { name: "Ben Clarke", color: "green"  },
      { name: "Clara Ng",   color: "purple" },
    ],
    docCount: 4,
    chatCount: 5,
    lastActive: "2h ago",
  },
  {
    id: "p2",
    name: "API Documentation",
    emoji: "📝",
    description: "Developer-facing docs for the v2 public API release.",
    members: [
      { name: "Alex Kim",   color: "blue"  },
      { name: "Ben Clarke", color: "green" },
    ],
    docCount: 11,
    chatCount: 8,
    lastActive: "Yesterday",
  },
];

const JOINED_PROJECTS: Project[] = [
  {
    id: "p3",
    name: "Q4 Planning",
    emoji: "📊",
    description: "Roadmap alignment and resourcing for the Q4 cycle.",
    members: [
      { name: "Clara Ng",   color: "purple" },
      { name: "Ben Clarke", color: "green"  },
      { name: "Alex Kim",   color: "blue"   },
      { name: "Dana Yoon",  color: "coral"  },
    ],
    docCount: 7,
    chatCount: 12,
    lastActive: "3 days ago",
  },
];

const RECENT_CHATS: RecentChat[] = [
  {
    id: "onboarding",
    projectId: "test",
    projectName: "Product Redesign",
    name: "Onboarding Flow Redesign",
    participants: [
      { name: "Alex Kim",   color: "blue"   },
      { name: "Ben Clarke", color: "green"  },
      { name: "Clara Ng",   color: "purple" },
    ],
    lastAuthor: "Claude",
    lastMessage: "Step 4 moves model settings here — after the product has been experienced, not before.",
    time: "2h ago",
  },
  {
    id: "nav",
    projectId: "test",
    projectName: "Product Redesign",
    name: "Navigation Architecture",
    participants: [
      { name: "Alex Kim", color: "blue"   },
      { name: "Clara Ng", color: "purple" },
    ],
    lastAuthor: "Clara Ng",
    lastMessage: "The sidebar-first layout tested better with power users but confused new ones — we might need two modes.",
    time: "Yesterday",
  },
  {
    id: "api-auth",
    projectId: "p2",
    projectName: "API Documentation",
    name: "Auth Flow Docs",
    participants: [
      { name: "Alex Kim",   color: "blue"  },
      { name: "Ben Clarke", color: "green" },
    ],
    lastAuthor: "Ben Clarke",
    lastMessage: "OAuth section is done — JWT refresh token flow still needs a sequence diagram.",
    time: "Yesterday",
  },
  {
    id: "q4-roadmap",
    projectId: "p3",
    projectName: "Q4 Planning",
    name: "Roadmap Prioritisation",
    participants: [
      { name: "Clara Ng",  color: "purple" },
      { name: "Dana Yoon", color: "coral"  },
      { name: "Alex Kim",  color: "blue"   },
    ],
    lastAuthor: "Claude",
    lastMessage: "Pushing the analytics milestone to week 6 lets us ship the core loop two weeks earlier.",
    time: "3 days ago",
  },
  {
    id: "q4-hiring",
    projectId: "p3",
    projectName: "Q4 Planning",
    name: "Hiring & Resourcing",
    participants: [
      { name: "Clara Ng", color: "purple" },
      { name: "Alex Kim", color: "blue"   },
    ],
    lastAuthor: "Clara Ng",
    lastMessage: "Two senior IC offers went out — waiting on responses by end of week.",
    time: "4 days ago",
  },
];

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-foreground/15 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0">{project.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm leading-snug truncate">{project.name}</p>
          <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{project.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Member stack */}
        <div className="flex -space-x-1.5">
          {project.members.slice(0, 4).map((m) => (
            <Avatar key={m.name} name={m.name} color={m.color} size="xs" />
          ))}
          {project.members.length > 4 && (
            <span
              className="w-5 h-5 rounded-full border border-border text-[9px] font-medium flex items-center justify-center"
              style={{ backgroundColor: "var(--color-background)", color: "var(--color-muted)" }}
            >
              +{project.members.length - 4}
            </span>
          )}
        </div>

        {/* Counts + last active */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
              <line x1="3" y1="4" x2="8" y2="4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <line x1="3" y1="6.5" x2="6" y2="6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            {project.docCount}
          </span>
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 2.5C1 1.7 1.7 1 2.5 1h6C9.3 1 10 1.7 10 2.5v4C10 7.3 9.3 8 8.5 8H6L3.5 10V8H2.5C1.7 8 1 7.3 1 6.5v-4Z" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            {project.chatCount}
          </span>
          <span style={{ color: "var(--color-muted)", opacity: 0.6 }}>{project.lastActive}</span>
        </div>
      </div>
    </Link>
  );
}

// ── Recent chat row ───────────────────────────────────────────────────────────

function RecentChatRow({ chat }: { chat: RecentChat }) {
  return (
    <Link
      href={`/chat/${chat.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-background transition-colors group"
    >
      {/* Avatars */}
      <div className="flex -space-x-1.5 shrink-0">
        {chat.participants.slice(0, 3).map((p) => (
          <Avatar key={p.name} name={p.name} color={p.color} size="xs" />
        ))}
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{chat.name}</span>
          <span className="text-xs shrink-0" style={{ color: "var(--color-muted)", opacity: 0.6 }}>
            {chat.projectName}
          </span>
        </div>
        <p className="text-xs text-muted truncate mt-0.5">
          <span className="font-medium">
            {chat.lastAuthor === "Claude" ? "Claude" : chat.lastAuthor.split(" ")[0]}
          </span>
          {" · "}
          {chat.lastMessage}
        </p>
      </div>

      {/* Time */}
      <span className="text-xs shrink-0" style={{ color: "var(--color-muted)", opacity: 0.6 }}>
        {chat.time}
      </span>
    </Link>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs text-muted">
      <span className="font-semibold text-foreground">{value}</span>{" "}{label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [navOpen, setNavOpen] = useState(true);

  const totalChats =
    [...MY_PROJECTS, ...JOINED_PROJECTS].reduce((s, p) => s + p.chatCount, 0);
  const totalDocs =
    [...MY_PROJECTS, ...JOINED_PROJECTS].reduce((s, p) => s + p.docCount, 0);
  const totalMembers = new Set(
    [...MY_PROJECTS, ...JOINED_PROJECTS].flatMap((p) => p.members.map((m) => m.name))
  ).size;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left nav */}
      {navOpen && <LeftNav />}

      {/* Main column */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Header */}
          <header className="h-14 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
            <button
              onClick={() => setNavOpen((o) => !o)}
              aria-label={navOpen ? "Hide navigation" : "Show navigation"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="1.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.5" y1="1.5" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>

            <h1 className="font-serif text-xl text-foreground tracking-tight flex-1">Projects</h1>

            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New project
            </button>
          </header>

          {/* Stats strip */}
          <div className="border-b border-border px-8 py-2.5 flex items-center gap-5 shrink-0 bg-surface">
            <Stat value={MY_PROJECTS.length + JOINED_PROJECTS.length} label="projects" />
            <div className="w-px h-3.5 bg-border" />
            <Stat value={totalChats} label="conversations" />
            <div className="w-px h-3.5 bg-border" />
            <Stat value={totalDocs} label="documents" />
            <div className="w-px h-3.5 bg-border" />
            <Stat value={totalMembers} label="collaborators" />
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-8 max-w-3xl mx-auto space-y-10">

              {/* My projects */}
              <section>
                <p className="text-sm font-semibold text-foreground mb-4">My projects</p>
                <div className="grid grid-cols-2 gap-4">
                  {MY_PROJECTS.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                  {/* New project slot */}
                  <button className="border border-dashed border-border rounded-xl p-5 flex items-center justify-center gap-2 text-sm text-muted hover:border-foreground/20 hover:text-foreground transition-colors">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    New project
                  </button>
                </div>
              </section>

              {/* Projects I'm in */}
              <section>
                <p className="text-sm font-semibold text-foreground mb-4">Projects I'm in</p>
                <div className="grid grid-cols-2 gap-4">
                  {JOINED_PROJECTS.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              </section>

              {/* Recent conversations */}
              <section>
                <p className="text-sm font-semibold text-foreground mb-3">Recent conversations</p>
                <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {RECENT_CHATS.map((chat) => (
                    <RecentChatRow key={chat.id} chat={chat} />
                  ))}
                </div>
              </section>

            </div>
          </div>
        </div>

        {/* Right sidebar: account */}
        <aside className="w-56 border-l border-border bg-surface flex flex-col shrink-0">
          <div className="h-14 border-b border-border flex items-center px-5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted" style={{ opacity: 0.5 }}>
              Account
            </span>
          </div>

          <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-y-auto">
            {/* Profile */}
            <div className="flex items-center gap-3">
              <Avatar name={CURRENT_USER.name} color={CURRENT_USER.color} size="md" showOnline />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{CURRENT_USER.name}</p>
                <p className="text-xs text-muted truncate">{CURRENT_USER.email}</p>
              </div>
            </div>

            {/* API key status */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
              style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-muted flex-1 truncate">API key set</span>
              <button className="text-muted hover:text-foreground transition-colors shrink-0 font-medium">
                Edit
              </button>
            </div>

            {/* Usage summary */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2" style={{ opacity: 0.5 }}>
                This month
              </p>
              <div className="space-y-2">
                <UsageLine label="Input tokens" value="1.2M" pct={62} />
                <UsageLine label="Output tokens" value="340K" pct={34} />
              </div>
            </div>
          </div>

          {/* Footer: settings + sign out */}
          <div className="px-3 py-3 border-t border-border flex flex-col gap-0.5">
            <SidebarButton
              label="Settings"
              icon={
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M11.2 8.8a1 1 0 0 0 .2 1.1l.03.03a1.1 1.1 0 0 1-1.56 1.56l-.03-.04A1 1 0 0 0 8.7 11.2a1 1 0 0 0-.5.87V12.3a1.1 1.1 0 0 1-2.2 0v-.05a1 1 0 0 0-.65-.92 1 1 0 0 0-1.1.2l-.04.04a1.1 1.1 0 0 1-1.56-1.56l.04-.04A1 1 0 0 0 2.9 8.8a1 1 0 0 0-.87-.5H1.8a1.1 1.1 0 0 1 0-2.2h.06a1 1 0 0 0 .91-.65 1 1 0 0 0-.2-1.1l-.04-.04A1.1 1.1 0 0 1 4.09 2.75l.04.04A1 1 0 0 0 5.2 3a1 1 0 0 0 .5-.87V1.8a1.1 1.1 0 0 1 2.2 0v.06a1 1 0 0 0 .6.91 1 1 0 0 0 1.1-.2l.04-.04a1.1 1.1 0 0 1 1.56 1.56l-.04.04A1 1 0 0 0 10.95 5.2v.05a1 1 0 0 0 .87.5h.18a1.1 1.1 0 0 1 0 2.2h-.06a1 1 0 0 0-.74.85Z" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              }
            />
            <SidebarButton
              label="Sign out"
              icon={
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M5 2H2.5A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M9 4.5l3 2L9 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="6.5" x2="5" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function UsageLine({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-1">
        <span>{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-background)" }}>
        <div className="h-full rounded-full bg-foreground/20" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SidebarButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-background transition-colors w-full text-left">
      {icon}
      {label}
    </button>
  );
}
