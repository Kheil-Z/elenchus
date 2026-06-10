"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LeftNav } from "@/components/LeftNav";
import { Avatar } from "@/components/Avatar";
import { NewProjectModal } from "@/components/NewProjectModal";
import { useAuth } from "@/lib/auth-context";
import { getApiKeyStatus } from "@/lib/api-key";
import { getProjects, getConversations, getProjectMemberPreviews } from "@/lib/db";
import { MemberAvatarStack } from "@/components/MemberAvatarStack";
import type { MemberPreview } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { ApiKeyStatus } from "@/lib/api-key";
import type { UserColor } from "@/lib/types";
import type { Project, Conversation } from "@/lib/types/database";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Shared emoji options ──────────────────────────────────────────────────────

const EMOJI_OPTIONS = ["📁", "🗂️", "💼", "🚀", "💡", "🔬", "📝", "🎯", "⚡", "🌱", "🏗️", "🎨", "📊", "🔒", "🤝", "🧪", "🌍", "🧠", "🎓", "🏆", "🔮", "🧩", "📡", "🛸", "🎪", "🌊", "🔥", "💎"];

// ── Rename modal ──────────────────────────────────────────────────────────────

function RenameModal({
  project,
  onClose,
  onRenamed,
}: {
  project: Project;
  onClose: () => void;
  onRenamed: (id: string, newName: string, newEmoji: string) => void;
}) {
  const [value, setValue] = useState(project.name);
  const [emoji, setEmoji] = useState(project.emoji ?? "📁");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    if (trimmed === project.name && emoji === (project.emoji ?? "📁")) { onClose(); return; }
    setSaving(true);
    setError(null);
    const token = await getToken();
    if (!token) { setError("Not authenticated"); setSaving(false); return; }
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed, emoji }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to rename"); setSaving(false); return; }
      onRenamed(project.id, trimmed, emoji);
      onClose();
    } catch {
      setError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4">
          <h2 className="font-serif text-lg text-foreground tracking-tight">Rename project</h2>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative group/emoji shrink-0">
              <button
                className="w-10 h-10 flex items-center justify-center text-xl rounded-xl border border-border hover:border-foreground/20 bg-background transition-colors"
                title="Change emoji"
                type="button"
              >
                {emoji}
              </button>
              <div className="absolute left-0 top-full mt-1 z-10 hidden group-focus-within/emoji:flex flex-wrap gap-1 bg-surface border border-border rounded-xl p-2 shadow-lg w-52">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-background transition-colors ${emoji === e ? "bg-background ring-1 ring-foreground/20" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              maxLength={80}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-foreground/25 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-background transition-colors ${emoji === e ? "bg-background ring-1 ring-foreground/20" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 text-sm text-muted border border-border rounded-xl py-2.5 hover:bg-background transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!value.trim() || saving}
              className="flex-1 text-sm font-medium text-surface rounded-xl py-2.5 transition-all disabled:opacity-40"
              style={{ backgroundColor: "var(--color-foreground)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({
  project,
  onClose,
  onDeleted,
}: {
  project: Project;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleDelete() {
    if (confirm !== project.name || deleting) return;
    setDeleting(true);
    setError(null);
    const token = await getToken();
    if (!token) { setError("Not authenticated"); setDeleting(false); return; }
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to delete"); setDeleting(false); return; }
      onDeleted(project.id);
      onClose();
    } catch {
      setError("Network error — please try again");
      setDeleting(false);
    }
  }

  const canDelete = confirm === project.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-serif text-lg text-foreground tracking-tight">Delete project</h2>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs text-red-700 leading-relaxed">
            <p className="font-semibold mb-1">This is permanent and cannot be undone.</p>
            <p>All conversations, messages, and documents inside <span className="font-medium">{project.name}</span> will be deleted for every member.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted">
              Type <span className="font-medium text-foreground">{project.name}</span> to confirm:
            </p>
            <input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canDelete) handleDelete(); }}
              placeholder={project.name}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:outline-none focus:border-red-300 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 text-sm text-muted border border-border rounded-xl py-2.5 hover:bg-background transition-colors">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex-1 text-sm font-medium text-white rounded-xl py-2.5 transition-all disabled:opacity-40"
              style={{ backgroundColor: canDelete ? "#DC2626" : "#DC262660" }}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  members = [],
  onRename,
  onDelete,
  onLeave,
  isOwner = true,
}: {
  project: Project;
  members?: MemberPreview[];
  onRename: (p: Project) => void;
  onDelete: (p: Project) => void;
  onLeave: (p: Project) => void;
  isOwner?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="relative group/card">
      <Link
        href={`/project/${project.id}`}
        className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-foreground/15 hover:shadow-sm transition-all block"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none mt-0.5 shrink-0">{project.emoji ?? "📁"}</span>
          <div className="flex-1 min-w-0 pr-6">
            <p className="font-medium text-foreground text-sm leading-snug truncate">{project.name}</p>
            <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">
              {project.description ?? "No description"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <MemberAvatarStack members={members} max={4} size="xs" />
          <span className="text-xs text-muted" style={{ opacity: 0.6 }}>
            {formatRelative(project.created_at)}
          </span>
        </div>
      </Link>

      {/* Three dots button — outside the Link so it doesn't navigate */}
      <div ref={menuRef} className="absolute top-3 right-3">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors opacity-0 group-hover/card:opacity-100"
          aria-label="Project actions"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
            <circle cx="7" cy="7"   r="1.2" fill="currentColor" />
            <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute top-full right-0 mt-1 w-36 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20">
            {isOwner && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(project); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-background transition-colors text-left"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8.5 1.5l2 2L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                Rename
              </button>
            )}
            {isOwner ? (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(project); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left border-t border-border"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onLeave(project); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2H10.5A1.5 1.5 0 0 1 12 3.5V8.5A1.5 1.5 0 0 1 10.5 10H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M5 4L2 6L5 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="2" y1="6" x2="9" y2="6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                Leave
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invitation card ───────────────────────────────────────────────────────────

interface Invitation {
  id: string;
  projectId: string;
  invitedByName: string | null;
  createdAt: string;
  project: { id: string; name: string; description: string | null; emoji: string | null; created_at: string } | null;
}

function InvitationCard({
  invite,
  onAccept,
  onDecline,
}: {
  invite: Invitation;
  onAccept: (projectId: string) => Promise<void>;
  onDecline: (projectId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  async function handle(action: "accept" | "decline") {
    setLoading(action);
    if (action === "accept") await onAccept(invite.projectId);
    else await onDecline(invite.projectId);
    setLoading(null);
  }

  const p = invite.project;
  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex items-start gap-4">
      <span className="text-2xl leading-none mt-0.5 shrink-0">{p?.emoji ?? "📁"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{p?.name ?? "Unknown project"}</p>
        {p?.description && (
          <p className="text-xs text-muted mt-0.5 line-clamp-1">{p.description}</p>
        )}
        <p className="text-xs text-muted mt-1">
          {invite.invitedByName ? `Invited by ${invite.invitedByName}` : "You've been invited"}
          {" · "}
          {formatRelative(invite.createdAt)}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handle("accept")}
            disabled={loading !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-surface transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--color-foreground)" }}
          >
            {loading === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            onClick={() => handle("decline")}
            disabled={loading !== null}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted border border-border hover:bg-background transition-colors disabled:opacity-50"
          >
            {loading === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leave confirmation modal ──────────────────────────────────────────────────

function LeaveModal({
  project,
  currentUserId,
  onClose,
  onLeft,
}: {
  project: Project;
  currentUserId: string;
  onClose: () => void;
  onLeft: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleLeave() {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    const token = await getToken();
    if (!token) { setError("Not authenticated"); setLeaving(false); return; }
    try {
      const res = await fetch(`/api/projects/${project.id}/members?userId=${encodeURIComponent(currentUserId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) { setError(json.error ?? "Failed to leave"); setLeaving(false); return; }
      onLeft(project.id);
      onClose();
    } catch {
      setError("Network error — please try again");
      setLeaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-serif text-lg text-foreground tracking-tight">Leave project</h2>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-4">
          <p className="text-sm text-muted leading-relaxed">
            You&apos;ll lose access to <span className="font-medium text-foreground">{project.name}</span> and all its conversations. The project owner can re-invite you later.
          </p>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 text-sm text-muted border border-border rounded-xl py-2.5 hover:bg-background transition-colors">
              Cancel
            </button>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="flex-1 text-sm font-medium text-white rounded-xl py-2.5 bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recent chat row ───────────────────────────────────────────────────────────

interface RecentChat {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  createdAt: string;
}

function RecentChatRow({ chat }: { chat: RecentChat }) {
  return (
    <Link
      href={`/chat/${chat.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-background transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{chat.name}</span>
          <span className="text-xs shrink-0" style={{ color: "var(--color-muted)", opacity: 0.6 }}>
            {chat.projectName}
          </span>
        </div>
      </div>
      <span className="text-xs shrink-0" style={{ color: "var(--color-muted)", opacity: 0.6 }}>
        {formatRelative(chat.createdAt)}
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

function UsageLine({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="text-[11px] font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div className="h-full rounded-full bg-foreground/30" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SidebarButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground hover:bg-background transition-colors w-full text-left"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { profile, user, logout } = useAuth();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | "loading">("loading");
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [joinedProjects, setJoinedProjects] = useState<Project[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [totalConvCount, setTotalConvCount] = useState(0);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const [memberPreviews, setMemberPreviews] = useState<Map<string, MemberPreview[]>>(new Map());

  // Rename / delete / leave state
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [leavingProject, setLeavingProject] = useState<Project | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => { getApiKeyStatus().then(setApiKeyStatus); }, []);

  useEffect(() => {
    if (!user) return;
    async function loadInvitations() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/invitations", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (json.success) setInvitations(json.invitations ?? []);
    }
    loadInvitations();
  }, [user, projectsVersion]);

  useEffect(() => {
    if (!user) return;
    setProjectsLoading(true);

    async function load() {
      const { data: projects } = await getProjects(user!.id);
      if (!projects) { setProjectsLoading(false); return; }

      const mine = projects.filter((p) => p.created_by === user!.id);
      const joined = projects.filter((p) => p.created_by !== user!.id);
      setMyProjects(mine);
      setJoinedProjects(joined);

      const convResults = await Promise.all(
        projects.map((p) => getConversations(p.id, user!.id))
      );

      const allConvs: RecentChat[] = [];
      let total = 0;
      convResults.forEach((result, i) => {
        if (result.data) {
          total += result.data.length;
          result.data.forEach((c) => {
            allConvs.push({
              id: c.id,
              name: c.name,
              projectId: projects[i]!.id,
              projectName: projects[i]!.name,
              createdAt: c.created_at,
            });
          });
        }
      });

      setTotalConvCount(total);
      setRecentChats(
        allConvs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
      );

      const previewMap = await getProjectMemberPreviews(projects.map((p) => p.id));
      // Owner goes first within each project
      previewMap.forEach((members, projectId) => {
        const ownerProject = projects.find((p) => p.id === projectId);
        if (ownerProject) {
          members.sort((a, b) =>
            a.userId === ownerProject.created_by ? -1 : b.userId === ownerProject.created_by ? 1 : 0
          );
        }
      });
      setMemberPreviews(previewMap);

      setProjectsLoading(false);
    }

    load();
  }, [user, projectsVersion]);

  function handleRenamed(id: string, newName: string, newEmoji: string) {
    setMyProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName, emoji: newEmoji } : p));
    setJoinedProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName, emoji: newEmoji } : p));
  }

  function handleDeleted(id: string) {
    setMyProjects((prev) => prev.filter((p) => p.id !== id));
    setJoinedProjects((prev) => prev.filter((p) => p.id !== id));
    setRecentChats((prev) => prev.filter((c) => c.projectId !== id));
  }

  function handleLeft(id: string) {
    setJoinedProjects((prev) => prev.filter((p) => p.id !== id));
    setRecentChats((prev) => prev.filter((c) => c.projectId !== id));
  }

  async function handleAcceptInvite(projectId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/invitations/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "accept" }),
    });
    setInvitations((prev) => prev.filter((i) => i.projectId !== projectId));
    setProjectsVersion((v) => v + 1);
  }

  async function handleDeclineInvite(projectId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/invitations/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: "decline" }),
    });
    setInvitations((prev) => prev.filter((i) => i.projectId !== projectId));
  }

  const displayName = profile?.display_name ?? user?.email ?? "";
  const displayEmail = user?.email ?? "";
  const displayColor = (profile?.color as UserColor) ?? "blue";

  async function handleLogout() {
    await logout();
    router.replace("/auth/login");
  }

  const allProjects = [...myProjects, ...joinedProjects];

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {newProjectOpen && (
        <NewProjectModal onClose={() => { setNewProjectOpen(false); setProjectsVersion((v) => v + 1); }} />
      )}
      {renamingProject && (
        <RenameModal
          project={renamingProject}
          onClose={() => setRenamingProject(null)}
          onRenamed={handleRenamed}
        />
      )}
      {deletingProject && (
        <DeleteModal
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDeleted={handleDeleted}
        />
      )}
      {leavingProject && user && (
        <LeaveModal
          project={leavingProject}
          currentUserId={user.id}
          onClose={() => setLeavingProject(null)}
          onLeft={handleLeft}
        />
      )}

      {navOpen && <LeftNav />}

      <div className="flex flex-1 overflow-hidden min-w-0">
        <div className="flex flex-col flex-1 overflow-hidden">

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

            <button
              onClick={() => setNewProjectOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New project
            </button>
          </header>

          <div className="border-b border-border px-8 py-2.5 flex items-center gap-5 shrink-0 bg-surface">
            <Stat value={allProjects.length} label="projects" />
            <div className="w-px h-3.5 bg-border" />
            <Stat value={totalConvCount} label="conversations" />
            <div className="w-px h-3.5 bg-border" />
            <Stat value={0} label="documents" />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-8 max-w-3xl mx-auto space-y-10">

              {invitations.length > 0 && (
                <section>
                  <p className="text-sm font-semibold text-foreground mb-4">Invitations</p>
                  <div className="grid grid-cols-2 gap-4">
                    {invitations.map((invite) => (
                      <InvitationCard
                        key={invite.id}
                        invite={invite}
                        onAccept={handleAcceptInvite}
                        onDecline={handleDeclineInvite}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <p className="text-sm font-semibold text-foreground mb-4">My projects</p>
                {projectsLoading ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {myProjects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        members={memberPreviews.get(p.id) ?? []}
                        isOwner
                        onRename={setRenamingProject}
                        onDelete={setDeletingProject}
                        onLeave={setLeavingProject}
                      />
                    ))}
                    <button
                      onClick={() => setNewProjectOpen(true)}
                      className="border border-dashed border-border rounded-xl p-5 flex items-center justify-center gap-2 text-sm text-muted hover:border-foreground/20 hover:text-foreground transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      New project
                    </button>
                  </div>
                )}
              </section>

              {!projectsLoading && joinedProjects.length > 0 && (
                <section>
                  <p className="text-sm font-semibold text-foreground mb-4">Projects I&apos;m in</p>
                  <div className="grid grid-cols-2 gap-4">
                    {joinedProjects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        members={memberPreviews.get(p.id) ?? []}
                        isOwner={false}
                        onRename={setRenamingProject}
                        onDelete={setDeletingProject}
                        onLeave={setLeavingProject}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!projectsLoading && recentChats.length > 0 && (
                <section>
                  <p className="text-sm font-semibold text-foreground mb-3">Recent conversations</p>
                  <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {recentChats.map((chat) => (
                      <RecentChatRow key={chat.id} chat={chat} />
                    ))}
                  </div>
                </section>
              )}

              {!projectsLoading && allProjects.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-muted text-sm">No projects yet.</p>
                  <p className="text-muted/60 text-xs mt-1">Create one to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="w-56 border-l border-border bg-surface flex flex-col shrink-0">
          <div className="h-14 border-b border-border flex items-center px-5 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted" style={{ opacity: 0.5 }}>
              Account
            </span>
          </div>

          <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              <Avatar name={displayName} color={displayColor} size="md" showOnline />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted truncate">{displayEmail}</p>
              </div>
            </div>

            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs hover:border-foreground/20 transition-colors"
              style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    apiKeyStatus === "active" ? "#22C55E" :
                    apiKeyStatus === "loading" ? "var(--color-border)" :
                    "#F87171",
                }}
              />
              <span className="text-muted flex-1 truncate">
                {apiKeyStatus === "loading" ? "Checking key…" :
                 apiKeyStatus === "active"  ? "API key set" :
                                              "No API key set"}
              </span>
              <span className="text-muted font-medium shrink-0">Edit</span>
            </Link>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2" style={{ opacity: 0.5 }}>
                This month
              </p>
              <div className="space-y-2">
                <UsageLine label="Input tokens" value="—" pct={0} />
                <UsageLine label="Output tokens" value="—" pct={0} />
              </div>
            </div>
          </div>

          <div className="px-3 py-3 border-t border-border flex flex-col gap-0.5">
            <SidebarButton
              label="Sign out"
              onClick={handleLogout}
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
