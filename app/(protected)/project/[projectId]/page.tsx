"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LeftNav } from "@/components/LeftNav";
import { useAuth } from "@/lib/auth-context";
import { getProject, getConversations, getProjectMembers } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { UserColor } from "@/lib/types";
import type { Project as DBProject, Conversation as DBConversation } from "@/lib/types/database";
import type { ProjectMemberWithUser } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Member {
  name: string;
  color: UserColor;
  role: "Can edit" | "Can use";
  online: boolean;
  tokenPct: number;
}

interface Conversation {
  id: string;
  name: string;
  participants: { name: string; color: UserColor }[];
  lastActive: string;
  messageCount: number;
  lastMessage: { author: string; text: string };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const solidColor: Record<UserColor, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  purple: "#A855F7",
  coral:  "#F87171",
  amber:  "#F59E0B",
};

function firstName(name: string) {
  return name.split(" ")[0];
}

// ── Conversations tab ─────────────────────────────────────────────────────────

function ConversationsTab({ currentUser, conversations, members }: {
  currentUser: string;
  conversations: Conversation[];
  members: Member[];
}) {
  const totalMessages = conversations.reduce((s, c) => s + c.messageCount, 0);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invited, setInvited] = useState<Member[]>([]);

  const others = members.filter((m) => m.name !== currentUser);

  function toggleMember(m: Member) {
    setInvited((prev) =>
      prev.some((p) => p.name === m.name)
        ? prev.filter((p) => p.name !== m.name)
        : [...prev, m]
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Overview strip */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">{totalMessages} messages total</p>
          <p className="text-[11px] text-muted">{conversations.length} conversations</p>
        </div>
        {members.some((m) => m.tokenPct > 0) && (
          <div>
            <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
              {members.map((m) => (
                <div
                  key={m.name}
                  style={{ width: `${m.tokenPct}%`, backgroundColor: solidColor[m.color] }}
                />
              ))}
            </div>
            <div className="flex gap-4">
              {members.map((m) => (
                <div key={m.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: solidColor[m.color] }} />
                  <span className="text-[11px] text-muted">
                    {firstName(m.name)} <span className="font-medium text-foreground">{m.tokenPct}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New conversation input */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-foreground/20 transition-colors">
        <div className="flex items-center gap-2">
          {invited.map((m) => (
            <span
              key={m.name}
              className="inline-flex items-center gap-1 border border-border rounded-md pl-1 pr-1.5 py-0.5 text-xs shrink-0"
              style={{ backgroundColor: "var(--color-background)" }}
            >
              <Avatar name={m.name} color={m.color} size="xs" />
              <span className="font-medium text-foreground">{firstName(m.name)}</span>
              <button
                onClick={() => toggleMember(m)}
                className="text-muted/60 hover:text-foreground transition-colors leading-none ml-0.5"
              >×</button>
            </span>
          ))}

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={invited.length ? "What shall we work on?" : "Shall we examine a problem together?"}
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted/35 focus:outline-none"
          />

          <div className="relative shrink-0">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              title="Add participants"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                pickerOpen ? "bg-background text-foreground" : "text-muted hover:text-foreground hover:bg-background"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <path d="M10 6v4M8 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>

            {pickerOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-44 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-10">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 px-3 pt-3 pb-1.5">
                  Add to conversation
                </p>
                {others.map((m) => {
                  const selected = invited.some((p) => p.name === m.name);
                  return (
                    <button
                      key={m.name}
                      onClick={() => toggleMember(m)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-background transition-colors text-left"
                    >
                      <Avatar name={m.name} color={m.color} size="xs" />
                      <span className="flex-1 text-xs text-foreground">{m.name}</span>
                      {selected && (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            disabled={!draft.trim()}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-25"
            style={{ backgroundColor: "var(--color-foreground)" }}
            aria-label="Start conversation"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 9V2M2 5.5l3.5-3.5 3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      {conversations.length === 0 && (
        <p className="text-sm text-muted text-center py-8">No conversations yet. Start one above.</p>
      )}
      <div className="flex flex-col gap-2">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-transparent hover:border-border hover:bg-surface transition-all"
          >
            <div className="w-44 shrink-0 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
              <p className="text-[11px] text-muted mt-0.5 truncate">
                {c.participants.map((p) => (p.name === currentUser ? "You" : firstName(p.name))).join(", ")}
                {c.participants.length > 0 && <span className="mx-1.5 text-border">·</span>}
                {c.messageCount} messages
              </p>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted/60 truncate">
                <span className="font-medium text-muted">
                  {c.lastMessage.author === currentUser ? "You" : c.lastMessage.author === "—" ? "" : firstName(c.lastMessage.author)}
                  {c.lastMessage.author !== "—" && ": "}
                </span>
                {c.lastMessage.text}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {c.participants.length > 0 && (
                <div className="flex -space-x-2">
                  {c.participants.slice(0, 3).map((p) => (
                    <Avatar key={p.name} name={p.name} color={p.color} size="xs" className="ring-2 ring-background" />
                  ))}
                </div>
              )}
              <span className="text-[11px] text-muted">{c.lastActive}</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                className="text-border group-hover:text-muted transition-colors"
              >
                <path d="M5 10l4-3-4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">0 documents</p>
        <button
          disabled
          title="Upload coming soon"
          className="flex items-center gap-1.5 text-xs font-medium text-muted border border-border rounded-lg px-3 py-1.5 opacity-40 cursor-not-allowed"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Upload
        </button>
      </div>

      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <span className="text-3xl opacity-30">📄</span>
        <p className="text-sm text-muted">No documents yet.</p>
        <p className="text-xs text-muted/50">Document upload is coming soon.</p>
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({ currentUser, members }: { currentUser: string; members: Member[] }) {
  const [addingMember, setAddingMember] = useState(false);
  const [inviteValue, setInviteValue] = useState("");

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{members.length} members</p>
        <button
          onClick={() => setAddingMember((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Invite member
        </button>
      </div>

      {addingMember && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={inviteValue}
            onChange={(e) => setInviteValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setAddingMember(false), setInviteValue(""))}
            placeholder="Email or name…"
            className="flex-1 text-sm bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 placeholder:text-muted/40"
          />
          <button
            onClick={() => { setAddingMember(false); setInviteValue(""); }}
            className="text-sm font-medium bg-foreground text-surface px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
          >
            Send invite
          </button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {members.map((m, i) => (
          <div
            key={m.name}
            className={`flex items-center gap-4 px-4 py-4 ${i < members.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="relative shrink-0">
              <Avatar name={m.name} color={m.color} size="md" />
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface"
                style={{ backgroundColor: m.online ? "#4ADE80" : "#D1D5DB" }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-foreground">
                  {m.name}
                  {m.name === currentUser && (
                    <span className="font-normal text-muted ml-1.5 text-xs">— You</span>
                  )}
                </p>
                <span
                  className="text-[10px] font-medium rounded-full px-2 py-px border"
                  style={
                    m.role === "Can edit"
                      ? { color: "#1D4ED8", borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }
                      : { color: "#6b6b6b", borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#F7F5F0" }
                  }
                >
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.tokenPct}%`, backgroundColor: solidColor[m.color] }}
                  />
                </div>
                <span className="text-[11px] text-muted shrink-0">{m.tokenPct}% of tokens</span>
              </div>
            </div>

            <button className="shrink-0 text-[11px] text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              ···
            </button>
          </div>
        ))}

        <button
          onClick={() => setAddingMember((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-border hover:bg-background transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0 text-muted">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-sm text-muted">Invite a member…</span>
        </button>
      </div>
    </div>
  );
}

// ── Catch up tab ──────────────────────────────────────────────────────────────

function CatchUpTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-muted/30">
        <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 8v6.5l4 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-muted">You&apos;re all caught up.</p>
      <p className="text-xs text-muted/50">Mentions and unread messages will appear here.</p>
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-muted/30">
        <path d="M4 20l6-8 5 6 4-5 5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-muted">No activity yet.</p>
      <p className="text-xs text-muted/50">Actions in this project will be logged here.</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "catchup" | "conversations" | "documents" | "members" | "activity";

const TABS: { id: Tab; label: string }[] = [
  { id: "conversations", label: "Conversations" },
  { id: "documents",     label: "Documents"     },
  { id: "members",       label: "Members"       },
  { id: "activity",      label: "Activity"      },
  { id: "catchup",       label: "Catch up"      },
];

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

function mapMember(m: ProjectMemberWithUser): Member {
  return {
    name: m.user.display_name,
    color: (m.user.color as UserColor) ?? "blue",
    role: m.role === "can_edit" ? "Can edit" : "Can use",
    online: false,
    tokenPct: 0,
  };
}

function mapConversation(c: DBConversation): Conversation {
  return {
    id: c.id,
    name: c.name,
    participants: [],
    lastActive: formatRelative(c.created_at),
    messageCount: 0,
    lastMessage: { author: "—", text: "Start the conversation" },
  };
}

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { profile, user } = useAuth();
  const currentUser = profile?.display_name ?? user?.email ?? "";
  const [activeTab, setActiveTab] = useState<Tab>("conversations");
  const [navOpen, setNavOpen] = useState(true);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [realMembers, setRealMembers] = useState<Member[]>([]);
  const [realConversations, setRealConversations] = useState<Conversation[]>([]);
  const [realEmoji, setRealEmoji] = useState("📁");
  // Header inline name edit
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerDraft, setHeaderDraft] = useState("");
  const [headerSaving, setHeaderSaving] = useState(false);
  const headerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getProject(projectId, user.id),
      getProjectMembers(projectId, user.id),
      getConversations(projectId, user.id),
    ]).then(([projRes, membersRes, convsRes]) => {
      if (projRes.data) {
        setProjectName(projRes.data.name);
        setProjectDesc(projRes.data.description ?? "");
        setDraftName(projRes.data.name);
        setDraftDesc(projRes.data.description ?? "");
        setRealEmoji(projRes.data.emoji ?? "📁");
      }
      if (membersRes.data) setRealMembers(membersRes.data.map(mapMember));
      if (convsRes.data) setRealConversations(convsRes.data.map(mapConversation));
    });
  }, [projectId, user]);

  function startEdit() {
    setDraftName(projectName);
    setDraftDesc(projectDesc);
    setEditingProject(true);
  }

  function saveEdit() {
    if (draftName.trim()) setProjectName(draftName.trim());
    setProjectDesc(draftDesc.trim());
    setEditingProject(false);
  }

  async function saveHeaderName() {
    const trimmed = headerDraft.trim();
    if (!trimmed || trimmed === projectName || headerSaving) {
      setHeaderEditing(false);
      return;
    }
    setHeaderSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (json.success) setProjectName(trimmed);
      } catch { /* best-effort */ }
    }
    setHeaderSaving(false);
    setHeaderEditing(false);
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">

      {navOpen && <LeftNav activeProjectId={projectId} />}

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

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

          <span className="text-border text-sm select-none">/</span>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base" aria-hidden>{realEmoji}</span>
            {headerEditing ? (
              <input
                ref={headerInputRef}
                value={headerDraft}
                onChange={(e) => setHeaderDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveHeaderName(); }
                  if (e.key === "Escape") { setHeaderEditing(false); setHeaderDraft(projectName); }
                }}
                onBlur={saveHeaderName}
                disabled={headerSaving}
                maxLength={80}
                className="text-sm font-medium text-foreground bg-transparent border-b border-foreground/40 focus:outline-none focus:border-foreground truncate flex-1 min-w-0 disabled:opacity-50"
              />
            ) : (
              <button
                onClick={() => { if (!projectName) return; setHeaderDraft(projectName); setHeaderEditing(true); setTimeout(() => headerInputRef.current?.select(), 0); }}
                title="Click to rename"
                className="text-sm font-medium text-foreground truncate hover:opacity-70 transition-opacity text-left min-w-0"
              >
                {projectName || "Loading…"}
              </button>
            )}
          </div>

          <button className="flex items-center gap-1.5 bg-foreground text-surface text-xs font-medium rounded-lg px-3 py-2 hover:opacity-80 transition-opacity shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New conversation
          </button>

          {currentUser && (
            <div className="shrink-0">
              <Avatar name={currentUser} color={(profile?.color as UserColor) ?? "blue"} size="sm" />
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Right sidebar */}
          <aside className="w-56 border-l border-border bg-surface flex flex-col overflow-y-auto shrink-0 order-last">

            {/* Project info */}
            <div className="px-4 pt-5 pb-4 border-b border-border">
              {editingProject ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="text-sm font-semibold text-foreground bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-foreground/30 w-full"
                  />
                  <textarea
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    rows={3}
                    className="text-[11px] text-muted bg-background border border-border rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-foreground/30 w-full resize-none leading-snug"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={saveEdit}
                      className="flex-1 text-[11px] font-semibold bg-foreground text-surface rounded-md py-1.5 hover:opacity-80 transition-opacity"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingProject(false)}
                      className="flex-1 text-[11px] text-muted border border-border rounded-md py-1.5 hover:bg-background transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group">
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0" aria-hidden>{realEmoji}</span>
                      <p className="text-sm font-semibold text-foreground leading-tight">{projectName}</p>
                    </div>
                    <button
                      onClick={startEdit}
                      aria-label="Edit project"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md hover:bg-background text-muted hover:text-foreground mt-0.5"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted leading-snug">{projectDesc}</p>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="px-4 py-4 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-3">
                Members
              </p>
              <div className="flex flex-col gap-2.5">
                {realMembers.map((m) => (
                  <div key={m.name} className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <Avatar name={m.name} color={m.color} size="sm" />
                      <span
                        className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-surface"
                        style={{ backgroundColor: m.online ? "#4ADE80" : "#D1D5DB" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.name === currentUser ? (
                          <>
                            {m.name}
                            <span className="font-normal text-muted ml-1">— You</span>
                          </>
                        ) : (
                          m.name
                        )}
                      </p>
                      <p className="text-[10px] text-muted">{m.online ? "Online" : "Away"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Documents */}
            <div className="px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-3">
                Documents
              </p>
              <p className="text-[11px] text-muted/50">No documents yet.</p>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Tab bar */}
            <div className="flex items-end gap-6 px-6 border-b border-border bg-surface shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 pb-3 pt-3.5 text-sm font-medium border-b-2 transition-colors shrink-0"
                  style={
                    activeTab === tab.id
                      ? { borderColor: "var(--color-foreground)", color: "var(--color-foreground)" }
                      : { borderColor: "transparent", color: "var(--color-muted)" }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto">
                {activeTab === "catchup"       && <CatchUpTab />}
                {activeTab === "conversations" && <ConversationsTab currentUser={currentUser} conversations={realConversations} members={realMembers} />}
                {activeTab === "documents"     && <DocumentsTab />}
                {activeTab === "members"       && <MembersTab currentUser={currentUser} members={realMembers} />}
                {activeTab === "activity"      && <ActivityTab />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
