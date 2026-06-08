"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LeftNav } from "@/components/LeftNav";
import type { UserColor } from "@/lib/types";

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

interface Doc {
  id: string;
  filename: string;
  uploader: string;
  uploaderColor: UserColor;
  uploadedAt: string;
  size: string;
}

interface ActivityItem {
  id: string;
  user: string;
  color: UserColor;
  action: string;
  target: string;
  time: string;
  type: "upload" | "chat" | "claude" | "project" | "member";
}

interface Mention {
  id: string;
  from: string;
  fromColor: UserColor | null;
  conversation: string;
  conversationId: string;
  preview: string;
  time: string;
}

interface NewMessages {
  conversationId: string;
  name: string;
  newCount: number;
  senders: { name: string; color: UserColor }[];
  lastTime: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const PROJECT = {
  name: "Product Redesign",
  emoji: "🎨",
  description: "Onboarding flow and navigation redesign for Q3 launch.",
};

const CURRENT_USER = "Alex Kim";

const MEMBERS: Member[] = [
  { name: "Alex Kim",   color: "blue",   role: "Can edit", online: true,  tokenPct: 44 },
  { name: "Ben Clarke", color: "green",  role: "Can use",  online: false, tokenPct: 31 },
  { name: "Clara Ng",   color: "purple", role: "Can edit", online: true,  tokenPct: 25 },
];

const CONVERSATIONS: Conversation[] = [
  {
    id: "onboarding",
    name: "Onboarding Flow Redesign",
    participants: [{ name: "Alex Kim", color: "blue" }, { name: "Ben Clarke", color: "green" }, { name: "Clara Ng", color: "purple" }],
    lastActive: "2h ago",
    messageCount: 24,
    lastMessage: { author: "Claude", text: "Step 4 moves model settings and preferences here — after the product has been experienced, not before." },
  },
  {
    id: "nav",
    name: "Navigation Architecture",
    participants: [{ name: "Alex Kim", color: "blue" }, { name: "Clara Ng", color: "purple" }],
    lastActive: "Yesterday",
    messageCount: 18,
    lastMessage: { author: "Clara Ng", text: "The sidebar-first layout tested better with power users but confused new ones — we might need two modes." },
  },
  {
    id: "mobile",
    name: "Mobile Breakpoints",
    participants: [{ name: "Ben Clarke", color: "green" }],
    lastActive: "3 days ago",
    messageCount: 7,
    lastMessage: { author: "Ben Clarke", text: "Bumping the card grid to a single column below 480px fixed the overflow issue on older iPhones." },
  },
  {
    id: "design-sys",
    name: "Design System Audit",
    participants: [{ name: "Alex Kim", color: "blue" }, { name: "Ben Clarke", color: "green" }, { name: "Clara Ng", color: "purple" }],
    lastActive: "1 week ago",
    messageCount: 41,
    lastMessage: { author: "Alex Kim", text: "Let's freeze token changes until the audit is done — too many moving parts right now." },
  },
  {
    id: "brief",
    name: "Stakeholder Brief",
    participants: [{ name: "Alex Kim", color: "blue" }],
    lastActive: "2 weeks ago",
    messageCount: 12,
    lastMessage: { author: "Claude", text: "Here's a one-page summary framing the redesign around retention metrics rather than feature changes." },
  },
];

const DOCUMENTS: Doc[] = [
  { id: "d1", filename: "nav-wireframes-v2.fig",  uploader: "Alex Kim",   uploaderColor: "blue",   uploadedAt: "May 20, 2025", size: "8.1 MB"  },
  { id: "d2", filename: "design-brief-v3.pdf",    uploader: "Alex Kim",   uploaderColor: "blue",   uploadedAt: "May 14, 2025", size: "2.4 MB"  },
  { id: "d3", filename: "competitor-matrix.xlsx", uploader: "Ben Clarke", uploaderColor: "green",  uploadedAt: "May 16, 2025", size: "180 KB"  },
  { id: "d4", filename: "user-interviews.md",     uploader: "Clara Ng",   uploaderColor: "purple", uploadedAt: "May 15, 2025", size: "48 KB"   },
];

const ACTIVITY: ActivityItem[] = [
  { id: "a1", user: "Alex Kim",   color: "blue",   action: "uploaded",           target: "nav-wireframes-v2.fig",    time: "2h ago",    type: "upload"  },
  { id: "a2", user: "Ben Clarke", color: "green",  action: "sent 6 messages in", target: "Onboarding Flow Redesign", time: "2h ago",    type: "chat"    },
  { id: "a3", user: "Clara Ng",   color: "purple", action: "called Claude in",   target: "Onboarding Flow Redesign", time: "3h ago",    type: "claude"  },
  { id: "a4", user: "Alex Kim",   color: "blue",   action: "started",            target: "Navigation Architecture",  time: "Yesterday", type: "chat"    },
  { id: "a5", user: "Clara Ng",   color: "purple", action: "joined project",     target: "Product Redesign",         time: "May 16",    type: "member"  },
  { id: "a6", user: "Ben Clarke", color: "green",  action: "uploaded",           target: "competitor-matrix.xlsx",   time: "May 16",    type: "upload"  },
  { id: "a7", user: "Clara Ng",   color: "purple", action: "uploaded",           target: "user-interviews.md",       time: "May 15",    type: "upload"  },
  { id: "a8", user: "Alex Kim",   color: "blue",   action: "uploaded",           target: "design-brief-v3.pdf",      time: "May 14",    type: "upload"  },
  { id: "a9", user: "Alex Kim",   color: "blue",   action: "created project",    target: "Product Redesign",         time: "May 12",    type: "project" },
];

const LAST_VISITED = "4 hours ago";

const MENTIONS: Mention[] = [
  {
    id: "mn1",
    from: "Clara Ng",
    fromColor: "purple",
    conversation: "Onboarding Flow Redesign",
    conversationId: "onboarding",
    preview: "Great point @Alex, but the interviews suggest users want to see value before they invite anyone — step 3 needs rethinking.",
    time: "2h ago",
  },
  {
    id: "mn2",
    from: "Ben Clarke",
    fromColor: "green",
    conversation: "Navigation Architecture",
    conversationId: "nav",
    preview: "@Alex can you take a look at the mobile breakpoint proposal before our call tomorrow? I want your sign-off on the grid.",
    time: "Yesterday",
  },
  {
    id: "mn3",
    from: "Claude",
    fromColor: null,
    conversation: "Onboarding Flow Redesign",
    conversationId: "onboarding",
    preview: "@Alex, this directly addresses the step-3 drop-off Clara flagged. Ben, it also matches the collaborative activation pattern.",
    time: "3h ago",
  },
];

const NEW_MESSAGES: NewMessages[] = [
  {
    conversationId: "onboarding",
    name: "Onboarding Flow Redesign",
    newCount: 4,
    senders: [{ name: "Ben Clarke", color: "green" }, { name: "Clara Ng", color: "purple" }],
    lastTime: "2h ago",
  },
  {
    conversationId: "nav",
    name: "Navigation Architecture",
    newCount: 2,
    senders: [{ name: "Clara Ng", color: "purple" }],
    lastTime: "Yesterday",
  },
];

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

function highlightMentions(text: string) {
  const parts = text.split(/(@[A-Za-z]+)/g);
  return parts.map((part, i) =>
    /^@[A-Za-z]+$/.test(part) ? (
      <span key={i} className="font-semibold text-blue-600">{part}</span>
    ) : part
  );
}

// ── Activity icon ─────────────────────────────────────────────────────────────

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const base = "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-muted";
  if (type === "upload")
    return (
      <span className={base} style={{ backgroundColor: "#F1F0EE" }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="3" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="3" y1="6.5" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
    );
  if (type === "chat")
    return (
      <span className={base} style={{ backgroundColor: "#F1F0EE" }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 2.5C1 1.7 1.7 1 2.5 1h6C9.3 1 10 1.7 10 2.5v4C10 7.3 9.3 8 8.5 8H6L3.5 10V8H2.5C1.7 8 1 7.3 1 6.5v-4Z" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </span>
    );
  if (type === "claude")
    return (
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-semibold select-none"
        style={{ backgroundColor: "#E8E5E0", color: "#6b6b6b" }}
      >
        Cl
      </span>
    );
  if (type === "member")
    return (
      <span className={base} style={{ backgroundColor: "#F1F0EE" }}>
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <circle cx="5.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.1" />
          <path d="M1.5 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </span>
    );
  // project
  return (
    <span className={base} style={{ backgroundColor: "#F1F0EE" }}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
        <path d="M1 3.5C1 2.7 1.7 2 2.5 2H4l1 1.5h3.5C9.3 3.5 10 4.2 10 5v3.5C10 9.3 9.3 10 8.5 10h-6C1.7 10 1 9.3 1 8.5v-5Z" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    </span>
  );
}

// ── Conversations tab ─────────────────────────────────────────────────────────

function ConversationsTab() {
  const totalMessages = CONVERSATIONS.reduce((s, c) => s + c.messageCount, 0);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invited, setInvited] = useState<Member[]>([]);

  const others = MEMBERS.filter((m) => m.name !== CURRENT_USER);

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
          <p className="text-[11px] text-muted">{CONVERSATIONS.length} conversations</p>
        </div>
        {/* Stacked token bar */}
        <div>
          <div className="flex h-1.5 rounded-full overflow-hidden mb-2">
            {MEMBERS.map((m) => (
              <div
                key={m.name}
                style={{ width: `${m.tokenPct}%`, backgroundColor: solidColor[m.color] }}
              />
            ))}
          </div>
          <div className="flex gap-4">
            {MEMBERS.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: solidColor[m.color] }} />
                <span className="text-[11px] text-muted">
                  {firstName(m.name)} <span className="font-medium text-foreground">{m.tokenPct}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New conversation input */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-foreground/20 transition-colors">
        <div className="flex items-center gap-2">
          {/* Invited chips */}
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

          {/* Text input */}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={invited.length ? "What shall we work on?" : "Shall we examine a problem together?"}
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted/35 focus:outline-none"
          />

          {/* People picker button */}
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

          {/* Send */}
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
      <div className="flex flex-col gap-2">
        {CONVERSATIONS.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-transparent hover:border-border hover:bg-surface transition-all"
          >
            {/* Left: title + meta */}
            <div className="w-44 shrink-0 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {c.name}
              </p>
              <p className="text-[11px] text-muted mt-0.5 truncate">
                {c.participants.map((p) => (p.name === CURRENT_USER ? "You" : firstName(p.name))).join(", ")}
                <span className="mx-1.5 text-border">·</span>
                {c.messageCount} messages
              </p>
            </div>

            {/* Middle: last message preview */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted/60 truncate">
                <span className="font-medium text-muted">
                  {c.lastMessage.author === CURRENT_USER ? "You" : firstName(c.lastMessage.author)}:
                </span>
                {" "}{c.lastMessage.text}
              </p>
            </div>

            {/* Right: avatars + timestamp + arrow */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex -space-x-2">
                {c.participants.slice(0, 3).map((p) => (
                  <Avatar key={p.name} name={p.name} color={p.color} size="xs" className="ring-2 ring-background" />
                ))}
              </div>
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
        <p className="text-sm text-muted">{DOCUMENTS.length} documents</p>
        <button className="flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Upload
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {DOCUMENTS.map((doc, i) => (
          <div
            key={doc.id}
            className={`flex items-center gap-4 px-4 py-3.5 hover:bg-background transition-colors cursor-pointer ${
              i < DOCUMENTS.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-base shrink-0" aria-hidden>📄</span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{doc.filename}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: solidColor[doc.uploaderColor] }} />
                <span className="text-[11px] text-muted">
                  {doc.uploader === CURRENT_USER ? "You" : doc.uploader}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-[11px] text-muted">{doc.uploadedAt}</p>
              <p className="text-[11px] text-muted/60 mt-0.5">{doc.size}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab() {
  const [addingMember, setAddingMember] = useState(false);
  const [inviteValue, setInviteValue] = useState("");

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{MEMBERS.length} members</p>
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
        {MEMBERS.map((m, i) => (
          <div
            key={m.name}
            className={`flex items-center gap-4 px-4 py-4 ${i < MEMBERS.length - 1 ? "border-b border-border" : ""}`}
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
                  {m.name === CURRENT_USER && (
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

        {/* Invite row */}
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
    <div className="flex flex-col gap-8 p-6">

      {/* Last visited banner */}
      <div className="flex items-center gap-2 text-xs text-muted">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6 3.5V6.5L8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        You were last active <span className="font-medium text-foreground mx-0.5">{LAST_VISITED}</span> — here's what you missed.
      </div>

      {/* Mentions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">Mentions</p>
          <span className="text-[10px] font-semibold bg-blue-500 text-white rounded-full px-1.5 py-px leading-none">
            {MENTIONS.length}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {MENTIONS.map((m) => (
            <Link
              key={m.id}
              href={`/chat/${m.conversationId}`}
              className="group flex flex-col gap-2 bg-surface border border-border rounded-xl px-4 py-3.5 hover:border-foreground/15 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {m.fromColor ? (
                    <Avatar name={m.from} color={m.fromColor} size="xs" />
                  ) : (
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-semibold shrink-0 select-none"
                      style={{ backgroundColor: "#E8E5E0", color: "#6b6b6b" }}
                    >
                      Cl
                    </span>
                  )}
                  <span className="text-xs font-medium text-foreground truncate">{m.from}</span>
                  <span className="text-muted/40 text-xs shrink-0">in</span>
                  <span className="text-xs text-muted truncate">{m.conversation}</span>
                </div>
                <span className="text-[11px] text-muted shrink-0">{m.time}</span>
              </div>

              <p className="text-xs text-muted leading-relaxed line-clamp-2">
                {highlightMentions(m.preview)}
              </p>

              <span className="text-[11px] font-medium text-muted group-hover:text-foreground transition-colors flex items-center gap-1">
                Open conversation
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 7.5l4-3-4-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* New messages */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">New messages</p>
          <span className="text-[10px] font-semibold text-muted bg-background border border-border rounded-full px-1.5 py-px leading-none">
            {NEW_MESSAGES.reduce((s, c) => s + c.newCount, 0)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {NEW_MESSAGES.map((c) => (
            <Link
              key={c.conversationId}
              href={`/chat/${c.conversationId}`}
              className="group flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3.5 hover:border-foreground/15 transition-all"
            >
              <div className="flex -space-x-2 shrink-0">
                {c.senders.map((s) => (
                  <Avatar key={s.name} name={s.name} color={s.color} size="xs" className="ring-2 ring-surface" />
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  {c.senders.map((s) => firstName(s.name)).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-semibold text-white bg-foreground rounded-full px-2 py-px leading-none">
                  {c.newCount} new
                </span>
                <span className="text-[11px] text-muted">{c.lastTime}</span>
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
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────────

function ActivityTab() {
  return (
    <div className="p-6">
      <div className="relative flex flex-col gap-px">
        {/* Vertical spine */}
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />

        {ACTIVITY.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5 relative">
            <ActivityIcon type={item.type} />
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-medium">
                  {item.user === CURRENT_USER ? "You" : item.user}
                </span>
                {" "}
                <span className="text-muted">{item.action}</span>
                {" "}
                <span className="font-medium text-foreground">{item.target}</span>
              </p>
            </div>
            <span className="text-[11px] text-muted shrink-0 pt-0.5">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "catchup" | "conversations" | "documents" | "members" | "activity";

const TABS: { id: Tab; label: string; badge?: number }[] = [
  { id: "conversations", label: "Conversations"                                                                             },
  { id: "documents",     label: "Documents"                                                                                 },
  { id: "members",       label: "Members"                                                                                   },
  { id: "activity",      label: "Activity"                                                                                  },
  { id: "catchup",       label: "Catch up",     badge: MENTIONS.length + NEW_MESSAGES.reduce((s, c) => s + c.newCount, 0) },
];

export default function ProjectPage() {
  const [activeTab, setActiveTab] = useState<Tab>("conversations");
  const [navOpen, setNavOpen] = useState(true);
  const [projectName, setProjectName] = useState(PROJECT.name);
  const [projectDesc, setProjectDesc] = useState(PROJECT.description);
  const [editingProject, setEditingProject] = useState(false);
  const [draftName, setDraftName] = useState(PROJECT.name);
  const [draftDesc, setDraftDesc] = useState(PROJECT.description);

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

  return (
    <div className="h-screen flex bg-background overflow-hidden">

      {/* Left nav — full height */}
      {navOpen && (
        <LeftNav activeProjectId="test" />
      )}

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

      {/* Header */}
      <header className="h-14 border-b border-border bg-surface flex items-center px-5 gap-3 shrink-0">
        {/* Nav toggle */}
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
          <span className="text-base" aria-hidden>{PROJECT.emoji}</span>
          <h1 className="text-sm font-medium text-foreground truncate">{projectName}</h1>
        </div>

        <button className="flex items-center gap-1.5 bg-foreground text-surface text-xs font-medium rounded-lg px-3 py-2 hover:opacity-80 transition-opacity shrink-0">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New conversation
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Right sidebar — declared first in DOM but rendered last via order */}
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
                    <span className="text-xl shrink-0" aria-hidden>{PROJECT.emoji}</span>
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
              {MEMBERS.map((m) => (
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
                      {m.name === CURRENT_USER ? (
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
            <div className="flex flex-col gap-2">
              {DOCUMENTS.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-background transition-colors cursor-pointer"
                >
                  <span className="text-sm mt-px shrink-0" aria-hidden>📄</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate">{doc.filename}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: solidColor[doc.uploaderColor] }} />
                      <span className="text-[10px] text-muted">
                        {doc.uploader === CURRENT_USER ? "You" : doc.uploader}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className="text-[10px] font-semibold rounded-full px-1.5 py-px leading-none"
                    style={
                      activeTab === tab.id
                        ? { backgroundColor: "var(--color-foreground)", color: "var(--color-surface)" }
                        : { backgroundColor: "#3B82F6", color: "#fff" }
                    }
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "catchup"       && <CatchUpTab />}
            {activeTab === "conversations" && <ConversationsTab />}
            {activeTab === "documents"     && <DocumentsTab />}
            {activeTab === "members"       && <MembersTab />}
            {activeTab === "activity"      && <ActivityTab />}
          </div>
        </main>
      </div>
      </div> {/* end main column */}
    </div>
  );
}
