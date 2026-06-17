"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { LeftNav } from "@/components/LeftNav";
import { useAuth } from "@/lib/auth-context";
import { getProject, getConversations, getProjectMembers } from "@/lib/db";
import { MemberAvatarStack } from "@/components/MemberAvatarStack";
import { DocPreviewModal } from "@/components/DocPreviewModal";
import type { MemberPreview } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { PROJECT_EMOJIS } from "@/lib/types";
import type { UserColor } from "@/lib/types";
import type { Conversation as DBConversation } from "@/lib/types/database";
import type { ProjectMemberWithUser } from "@/lib/db";
import { ThemeToggle } from "@/components/ThemeToggle";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  name: string;
  color: UserColor;
  role: "Can edit" | "Can use";
  online: boolean;
  tokenPct: number;
}

interface Conversation {
  id: string;
  name: string;
  lastActive: string;
  messageCount: number;
  participants: MemberPreview[];
  creatorUserId: string;
}

interface DocumentEntry {
  id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  uploader_name: string;
  created_at: string;
  conversation_id: string | null;
  conversation_name: string | null;
}

interface ActivityEntry {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_color: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  metadata: { scope?: string; conversation_name?: string; conversation_id?: string } | null;
  created_at: string;
}

interface Mention {
  id: string;
  content: string;
  author_display_name: string;
  conversation_id: string;
  conversation_name: string;
  created_at: string;
}

interface UnreadConversation {
  id: string;
  name: string;
  new_count: number;
  latest_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

type DismissedState = { mentions: string[]; unreads: Record<string, string> };
function getCatchupDismissed(projectId: string): DismissedState {
  try { return JSON.parse(localStorage.getItem(`elenchus_catchup_${projectId}`) ?? "{}"); } catch { return { mentions: [], unreads: {} }; }
}
function setCatchupDismissed(projectId: string, data: DismissedState) {
  localStorage.setItem(`elenchus_catchup_${projectId}`, JSON.stringify(data));
}

const EMOJI_OPTIONS = PROJECT_EMOJIS;

const solidColor: Record<UserColor, string> = {
  blue: "#3B82F6", green: "#22C55E", purple: "#A855F7", coral: "#F87171", amber: "#F59E0B",
  teal: "#14B8A6", rose: "#EC4899", orange: "#F97316", indigo: "#6366F1", sky: "#0EA5E9", lime: "#84CC16",
};

function firstName(name: string) { return name.split(" ")[0]; }

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// ── Conversation row (with inline rename) ─────────────────────────────────────

function ConversationRow({
  conversation,
  canDelete,
  onRenamed,
  onDeleted,
}: {
  conversation: Conversation;
  canDelete: boolean;
  onRenamed: (id: string, newName: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.name);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmDelete) return;
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [confirmDelete]);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(conversation.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === conversation.name || saving) { setEditing(false); return; }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ name: trimmed }),
        });
        const json = await res.json();
        if (json.success) onRenamed(conversation.id, trimmed);
      } catch { /* best-effort */ }
    }
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) onDeleted(conversation.id);
    } catch { /* best-effort */ }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl border border-foreground/20 bg-surface">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={saveEdit}
          disabled={saving}
          maxLength={120}
          className="flex-1 text-sm font-medium text-foreground bg-transparent focus:outline-none disabled:opacity-50"
        />
        <span className="text-[11px] text-muted shrink-0">{saving ? "Saving…" : "Enter to save"}</span>
      </div>
    );
  }

  return (
    <div className="group/row flex items-center gap-2 px-4 py-3.5 rounded-xl border border-transparent hover:border-border hover:bg-surface transition-all">
      <Link href={`/chat/${conversation.id}`} className="flex-1 min-w-0 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{conversation.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[11px] text-muted shrink-0">{conversation.messageCount} messages</p>
            {conversation.participants.length > 0 && (
              <MemberAvatarStack members={conversation.participants} max={4} size="xs" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] text-muted shrink-0">{conversation.lastActive}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-border group-hover/row:text-muted transition-colors shrink-0">
            <path d="M5 10l4-3-4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Link>

      <button
        onClick={startEdit}
        title="Rename"
        className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-background transition-colors opacity-0 group-hover/row:opacity-100 shrink-0"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </button>

      {canDelete && (
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete((o) => !o); }}
            title="Delete"
            className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover-destructive transition-colors opacity-0 group-hover/row:opacity-100"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {confirmDelete && (
            <div
              ref={popupRef}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full mb-2 w-56 bg-surface rounded-xl shadow-lg p-3 z-20" style={{ border: "1px solid var(--color-error-border)" }}
            >
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--color-error)" }}>Delete conversation?</p>
              <p className="text-[11px] text-muted mb-3 leading-snug">
                This permanently deletes all messages. It cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                  className="flex-1 text-xs text-muted border border-border rounded-lg py-1.5 hover:bg-background transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 text-xs font-medium rounded-lg py-1.5 transition-colors" style={{ backgroundColor: "var(--color-error)", color: "var(--color-background)" }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Conversations tab ─────────────────────────────────────────────────────────

function ConversationsTab({
  projectId,
  currentUser,
  currentUserId,
  conversations,
  members,
  canDelete,
  onConversationCreated,
  onConversationRenamed,
  onConversationDeleted,
}: {
  projectId: string;
  currentUser: string;
  currentUserId: string;
  conversations: Conversation[];
  members: Member[];
  canDelete: boolean;
  onConversationCreated: (conv: Conversation) => void;
  onConversationRenamed: (id: string, newName: string) => void;
  onConversationDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invited, setInvited] = useState<Member[]>([]);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const others = members.filter((m) => m.id !== currentUserId);

  function toggleMember(m: Member) {
    setInvited((prev) =>
      prev.some((p) => p.id === m.id) ? prev.filter((p) => p.id !== m.id) : [...prev, m]
    );
  }

  async function handleCreate() {
    const message = draft.trim();
    if (!message || creating) return;
    setCreating(true);
    const token = await getToken();
    if (!token) { setCreating(false); return; }

    // Derive a short name from the first 5 words
    const words = message.split(/\s+/);
    const name = words.length > 5 ? words.slice(0, 5).join(" ") + "…" : message;

    try {
      const createRes = await fetch("/api/conversations/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId, name, memberIds: invited.map((m) => m.id) }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) { setCreating(false); return; }

      const conversationId = createJson.conversation.id;

      // Send the initial message before navigating
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId, content: message, authorDisplayName: currentUser }),
      });

      const conv: Conversation = {
        id: conversationId,
        name,
        lastActive: formatRelative(createJson.conversation.created_at),
        messageCount: 1,
        participants: [],
        creatorUserId: createJson.conversation.creator_user_id ?? "",
      };
      onConversationCreated(conv);
      router.push(`/chat/${conversationId}`);
    } catch { /* network error */ }
    setCreating(false);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Stats strip */}
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">{conversations.length} conversations</p>
      </div>

      {/* New conversation input */}
      <div className="bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-foreground/20 transition-colors">
        <div className="flex items-center gap-2">
          {invited.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 border border-border rounded-md pl-1 pr-1.5 py-0.5 text-xs shrink-0"
              style={{ backgroundColor: "var(--color-background)" }}
            >
              <Avatar name={m.name} color={m.color} size="xs" />
              <span className="font-medium text-foreground">{firstName(m.name)}</span>
              <button onClick={() => toggleMember(m)} className="text-muted/60 hover:text-foreground transition-colors leading-none ml-0.5">×</button>
            </span>
          ))}

          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleCreate(); }}
            placeholder={invited.length ? "What shall we work on?" : "Shall we examine a problem together?"}
            disabled={creating}
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted/35 focus:outline-none disabled:opacity-50"
          />

          {/* People picker */}
          {others.length > 0 && (
            <div className="relative shrink-0">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                title="Add participants"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${pickerOpen ? "bg-background text-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M1 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M10 6v4M8 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
              {pickerOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-44 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-10">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 px-3 pt-3 pb-1.5">Add to conversation</p>
                  {others.map((m) => {
                    const selected = invited.some((p) => p.id === m.id);
                    return (
                      <button key={m.id} onClick={() => toggleMember(m)} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-background transition-colors text-left">
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
          )}

          <button
            onClick={handleCreate}
            disabled={!draft.trim() || creating}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-25"
            style={{ backgroundColor: "var(--color-foreground)" }}
          >
            {creating ? (
              <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="white" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 9V2M2 5.5l3.5-3.5 3.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Conversation list */}
      {conversations.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No conversations yet. Start one above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              canDelete={canDelete}
              onRenamed={onConversationRenamed}
              onDeleted={onConversationDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab({
  projectId,
  currentUser,
  conversations,
}: {
  projectId: string;
  currentUser: string;
  conversations: { id: string; name: string }[];
}) {
  const [docs, setDocs] = useState<DocumentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [movingDocId, setMovingDocId] = useState<string | null>(null);
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const deletePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpenFor) return;
    function handle(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpenFor(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [pickerOpenFor]);

  useEffect(() => {
    if (!deleteConfirmFor) return;
    function handle(e: MouseEvent) {
      if (deletePopoverRef.current && !deletePopoverRef.current.contains(e.target as Node)) {
        setDeleteConfirmFor(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [deleteConfirmFor]);

  async function handleDeleteDoc(docId: string) {
    setDeletingDocId(docId);
    setDeleteConfirmFor(null);
    const token = await getToken();
    if (!token) { setDeletingDocId(null); return; }
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
      }
    } catch { /* best-effort */ }
    setDeletingDocId(null);
  }

  useEffect(() => {
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      fetch(`/api/projects/${projectId}/documents`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setDocs(json.documents);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [projectId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const token = await getToken();
    if (!token) { setUploading(false); return; }

    const formData = new FormData();
    formData.append("file", file);
    // No conversationId here — project-wide by default from the Documents tab

    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setDocs((prev) => [{ ...json.document, conversation_id: null, conversation_name: null }, ...prev]);
      } else {
        setUploadError(json.error ?? "Upload failed");
      }
    } catch {
      setUploadError("Network error — please try again");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleScopeChange(docId: string, toConversationId: string | null) {
    if (movingDocId) return;
    setMovingDocId(docId);
    setPickerOpenFor(null);
    const token = await getToken();
    if (!token) { setMovingDocId(null); return; }
    try {
      const res = await fetch(`/api/documents/${docId}/scope`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: toConversationId }),
      });
      const json = await res.json();
      if (json.success) {
        const convName = toConversationId
          ? (conversations.find((c) => c.id === toConversationId)?.name ?? null)
          : null;
        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId ? { ...d, conversation_id: toConversationId, conversation_name: convName } : d
          )
        );
      }
    } catch { /* best-effort */ }
    setMovingDocId(null);
  }

  const projectDocs = docs.filter((d) => !d.conversation_id);
  const chatDocs = docs.filter((d) => d.conversation_id);

  // Group chat docs by conversation_id
  const chatDocsByConv = new Map<string, DocumentEntry[]>();
  chatDocs.forEach((d) => {
    const key = d.conversation_id!;
    if (!chatDocsByConv.has(key)) chatDocsByConv.set(key, []);
    chatDocsByConv.get(key)!.push(d);
  });

  if (loading) return <div className="p-6 text-sm text-muted">Loading…</div>;

  return (
    <>
    {previewDoc && (
      <DocPreviewModal
        id={previewDoc.id}
        name={previewDoc.name}
        sizeBytes={previewDoc.size_bytes}
        mimeType={previewDoc.mime_type}
        uploaderName={previewDoc.uploader_name}
        createdAt={previewDoc.created_at}
        onClose={() => setPreviewDoc(null)}
        onDeleted={(deletedId) => {
          setDocs((prev) => prev.filter((d) => d.id !== deletedId));
          setPreviewDoc(null);
        }}
      />
    )}
    <div className="p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors disabled:opacity-40"
        >
          {uploading ? (
            <>
              <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
              </svg>
              Uploading…
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Upload project-wide
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {uploadError && (
        <div className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--color-error)", backgroundColor: "var(--color-error-bg)", border: "1px solid var(--color-error-border)" }}>
          {uploadError}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span className="text-3xl opacity-30">📄</span>
          <p className="text-sm text-muted">No documents yet.</p>
          <p className="text-xs text-muted/50">Upload a file to share it with the project.</p>
        </div>
      ) : (
        <>
          {/* Project-wide section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted/60 shrink-0">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
                <path d="M1.5 6h9M6 1.5c-1 1.2-1.6 2.7-1.6 4.5S5 9.3 6 10.5M6 1.5c1 1.2 1.6 2.7 1.6 4.5S7 9.3 6 10.5" stroke="currentColor" strokeWidth="1.1" />
              </svg>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
                Project-wide
              </p>
              <span className="text-[10px] text-muted/40">— included in all conversations</span>
            </div>

            {projectDocs.length === 0 ? (
              <p className="text-xs text-muted/50 py-2">No project-wide documents.</p>
            ) : (
              <div className="bg-surface border border-border rounded-xl">
                {projectDocs.map((doc, i) => (
                  <div
                    key={doc.id}
                    className={`group/doc flex items-center gap-4 px-4 py-3.5 hover:bg-background transition-colors ${
                      i === 0 ? "rounded-t-xl" : ""
                    } ${i === projectDocs.length - 1 ? "rounded-b-xl" : "border-b border-border"}`}
                  >
                    <button onClick={() => setPreviewDoc(doc)} className="text-base shrink-0 hover:scale-110 transition-transform" title="Preview">📄</button>
                    <button onClick={() => setPreviewDoc(doc)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate hover:underline underline-offset-2">{doc.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {doc.uploader_name === currentUser ? "You" : doc.uploader_name}
                      </p>
                    </button>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-muted">{formatRelative(doc.created_at)}</p>
                      <p className="text-[11px] text-muted/60 mt-0.5">{formatBytes(doc.size_bytes)}</p>
                    </div>
                    {/* Move to chat button */}
                    {conversations.length > 0 && (
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPickerOpenFor(pickerOpenFor === doc.id ? null : doc.id); }}
                          disabled={movingDocId === doc.id}
                          title="Move to a specific chat"
                          className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground border border-transparent hover:border-border rounded-md px-2 py-1 transition-colors opacity-0 group-hover/doc:opacity-100 disabled:opacity-40 whitespace-nowrap"
                        >
                          {movingDocId === doc.id ? (
                            <svg className="animate-spin" width="9" height="9" viewBox="0 0 10 10" fill="none">
                              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                            </svg>
                          ) : (
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                              <path d="M4.5 1.5v6M1.5 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          Move to chat
                        </button>
                        {pickerOpenFor === doc.id && (
                          <div
                            ref={pickerRef}
                            className="absolute right-0 top-full mt-1 w-52 bg-surface border border-border rounded-xl shadow-lg z-20 overflow-hidden"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 px-3 pt-3 pb-1.5">
                              Move to chat
                            </p>
                            {conversations.map((conv) => (
                              <button
                                key={conv.id}
                                onClick={() => handleScopeChange(doc.id, conv.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-background transition-colors text-left text-xs text-foreground"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted">
                                  <path d="M1 1.5h8a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H5.5L3.5 9V7.5H1a.5.5 0 0 1-.5-.5V2A.5.5 0 0 1 1 1.5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                                </svg>
                                <span className="truncate">{conv.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Delete button */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmFor(deleteConfirmFor === doc.id ? null : doc.id); setPickerOpenFor(null); }}
                        disabled={deletingDocId === doc.id}
                        title="Delete document"
                        className="flex items-center justify-center w-7 h-7 text-muted hover-destructive border border-transparent rounded-md transition-colors opacity-0 group-hover/doc:opacity-100 disabled:opacity-40"
                      >
                        {deletingDocId === doc.id ? (
                          <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      {deleteConfirmFor === doc.id && (
                        <div
                          ref={deletePopoverRef}
                          className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-lg z-20 p-3 flex flex-col gap-2"
                        >
                          <p className="text-xs text-foreground font-medium">Delete permanently?</p>
                          <p className="text-[10px] text-muted leading-snug">This cannot be undone.</p>
                          <div className="flex gap-1.5 mt-1">
                            <button
                              onClick={() => setDeleteConfirmFor(null)}
                              className="flex-1 text-xs text-muted border border-border rounded-lg py-1.5 hover:bg-background transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="flex-1 text-xs font-medium rounded-lg py-1.5 transition-colors" style={{ backgroundColor: "var(--color-error)", color: "var(--color-background)" }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat-scoped section */}
          {chatDocsByConv.size > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted/60 shrink-0">
                  <path d="M1 2h10a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H6.5L4.5 11V9H1a.5.5 0 0 1-.5-.5v-6A.5.5 0 0 1 1 2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                </svg>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
                  Chat documents
                </p>
                <span className="text-[10px] text-muted/40">— scoped to specific conversations</span>
              </div>

              <div className="flex flex-col gap-4">
                {Array.from(chatDocsByConv.entries()).map(([convId, convDocs]) => (
                  <div key={convId}>
                    <div className="flex items-center gap-1.5 mb-1.5 px-1">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-muted shrink-0">
                        <path d="M1 1.5h8a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H5.5L3.5 9V7.5H1a.5.5 0 0 1-.5-.5V2A.5.5 0 0 1 1 1.5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs font-medium text-muted truncate">
                        {convDocs[0]?.conversation_name ?? "Unknown conversation"}
                      </span>
                    </div>
                    <div className="bg-surface border border-border rounded-xl">
                      {convDocs.map((doc, i) => (
                        <div
                          key={doc.id}
                          className={`group/doc flex items-center gap-4 px-4 py-3.5 hover:bg-background transition-colors ${
                            i === 0 ? "rounded-t-xl" : ""
                          } ${i === convDocs.length - 1 ? "rounded-b-xl" : "border-b border-border"}`}
                        >
                          <button onClick={() => setPreviewDoc(doc)} className="text-base shrink-0 hover:scale-110 transition-transform" title="Preview">📄</button>
                          <button onClick={() => setPreviewDoc(doc)} className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium text-foreground truncate hover:underline underline-offset-2">{doc.name}</p>
                            <p className="text-[11px] text-muted mt-0.5">
                              {doc.uploader_name === currentUser ? "You" : doc.uploader_name}
                            </p>
                          </button>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-muted">{formatRelative(doc.created_at)}</p>
                            <p className="text-[11px] text-muted/60 mt-0.5">{formatBytes(doc.size_bytes)}</p>
                          </div>
                          <button
                            onClick={() => handleScopeChange(doc.id, null)}
                            disabled={movingDocId === doc.id}
                            title="Make project-wide"
                            className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground border border-transparent hover:border-border rounded-md px-2 py-1 transition-colors opacity-0 group-hover/doc:opacity-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                          >
                            {movingDocId === doc.id ? (
                              <svg className="animate-spin" width="9" height="9" viewBox="0 0 10 10" fill="none">
                                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                              </svg>
                            ) : (
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 7.5V1.5M1.5 4.5l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            Make project-wide
                          </button>
                          {/* Delete button */}
                          <div className="relative shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmFor(deleteConfirmFor === doc.id ? null : doc.id); }}
                              disabled={deletingDocId === doc.id}
                              title="Delete document"
                              className="flex items-center justify-center w-7 h-7 text-muted hover-destructive border border-transparent rounded-md transition-colors opacity-0 group-hover/doc:opacity-100 disabled:opacity-40"
                            >
                              {deletingDocId === doc.id ? (
                                <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            {deleteConfirmFor === doc.id && (
                              <div
                                ref={deletePopoverRef}
                                className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-lg z-20 p-3 flex flex-col gap-2"
                              >
                                <p className="text-xs text-foreground font-medium">Delete permanently?</p>
                                <p className="text-[10px] text-muted leading-snug">This cannot be undone.</p>
                                <div className="flex gap-1.5 mt-1">
                                  <button
                                    onClick={() => setDeleteConfirmFor(null)}
                                    className="flex-1 text-xs text-muted border border-border rounded-lg py-1.5 hover:bg-background transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="flex-1 text-xs font-medium rounded-lg py-1.5 transition-colors" style={{ backgroundColor: "var(--color-error)", color: "var(--color-background)" }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({
  projectId,
  currentUser,
  members,
  onMembersRefresh,
}: {
  projectId: string;
  currentUser: string;
  members: Member[];
  onMembersRefresh: () => void;
}) {
  const [addingMember, setAddingMember] = useState(false);
  const [inviteValue, setInviteValue] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  async function handleInvite() {
    if (!inviteValue.trim() || inviting) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    const token = await getToken();
    if (!token) { setInviting(false); return; }

    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteValue.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setInviteSuccess(`${json.member.display_name} added to the project.`);
        setInviteValue("");
        onMembersRefresh();
      } else {
        setInviteError(json.error ?? "Failed to invite member");
      }
    } catch {
      setInviteError("Network error — please try again");
    }
    setInviting(false);
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setAddingMember((v) => !v); setInviteError(null); setInviteSuccess(null); }}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-surface transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Invite member
        </button>
      </div>

      {addingMember && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={inviteValue}
              onChange={(e) => setInviteValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              placeholder="Email address…"
              className="flex-1 text-sm bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-foreground/30 placeholder:text-muted/40"
            />
            <button
              onClick={handleInvite}
              disabled={!inviteValue.trim() || inviting}
              className="text-sm font-medium bg-foreground text-surface px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {inviting ? "Adding…" : "Add"}
            </button>
          </div>
          {inviteError && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--color-error)", backgroundColor: "var(--color-error-bg)", border: "1px solid var(--color-error-border)" }}>{inviteError}</p>
          )}
          {inviteSuccess && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--color-success)", backgroundColor: "color-mix(in srgb, var(--color-success) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)" }}>{inviteSuccess}</p>
          )}
          <p className="text-[11px] text-muted/60">They must already have an Elenchus account.</p>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {members.map((m, i) => (
          <div
            key={m.id}
            className={`flex items-center gap-4 px-4 py-4 ${i < members.length - 1 ? "border-b border-border" : ""}`}
          >
            <div className="relative shrink-0">
              <Avatar name={m.name} color={m.color} size="md" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface" style={{ backgroundColor: m.online ? "#4ADE80" : "var(--color-border)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-foreground">
                  {m.name}
                  {m.name === currentUser && <span className="font-normal text-muted ml-1.5 text-xs">— You</span>}
                </p>
                <span
                  className="text-[10px] font-medium rounded-full px-2 py-px border"
                  style={m.role === "Can edit"
                    ? { color: "var(--color-badge-edit)", borderColor: "var(--color-badge-edit-border)", backgroundColor: "var(--color-badge-edit-bg)" }
                    : { color: "var(--color-badge-default)", borderColor: "var(--color-badge-default-border)", backgroundColor: "var(--color-badge-default-bg)" }}
                >
                  {m.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.tokenPct}%`, backgroundColor: solidColor[m.color] }} />
                </div>
                <span className="text-[11px] text-muted shrink-0">{m.tokenPct > 0 ? `${m.tokenPct}% of AI spend` : "—"}</span>
              </div>
            </div>
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

// ── Activity tab ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  created_project:       "created this project",
  renamed_project:       "renamed this project to",
  updated_system_prompt: "updated the AI system prompt to",
  reset_system_prompt:   "reset the AI system prompt to default",
  created_conversation:  "started a conversation",
  renamed_conversation:  "renamed a conversation to",
  deleted_conversation:  "deleted a conversation",
  invited_member:        "invited",
  removed_member:        "removed",
  left_project:          "left this project",
  uploaded_document:     "uploaded",
  moved_document_scope:  "moved",
  deleted_document:      "deleted",
};

function truncateName(name: string, max = 32): string {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

function activitySuffix(item: ActivityEntry): string | null {
  const m = item.metadata;
  if (!m) return null;
  if (item.action === "uploaded_document" || item.action === "moved_document_scope") {
    if (m.scope === "chat") return `to "${m.conversation_name ?? "a chat"}"`;
    if (m.scope === "project") return "to project";
  }
  if (item.action === "deleted_document") {
    if (m.scope === "chat") return `from "${m.conversation_name ?? "a chat"}"`;
    if (m.scope === "project") return "from project";
  }
  return null;
}

function ActivityTab({ projectId }: { projectId: string }) {
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken().then((token) => {
      if (!token) { setLoading(false); return; }
      fetch(`/api/projects/${projectId}/activity`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setActivity(json.activity);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [projectId]);

  if (loading) return <div className="p-6 text-sm text-muted">Loading…</div>;

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-muted/30">
          <path d="M4 20l6-8 5 6 4-5 5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-muted">No activity yet.</p>
        <p className="text-xs text-muted/50">Actions in this project will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="relative flex flex-col gap-px">
        <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border" />
        {activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5 relative">
            {item.user_name ? (
              <Avatar name={item.user_name} color={(item.user_color as UserColor) ?? "blue"} size="xs" className="shrink-0 mt-0.5 z-10" />
            ) : (
              <span className="w-6 h-6 rounded-full shrink-0 mt-0.5 z-10 flex items-center justify-center text-[8px] font-semibold bg-border text-muted">Cl</span>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-medium">{item.user_name ?? "System"}</span>
                {" "}
                <span className="text-muted">{ACTION_LABELS[item.action] ?? item.action}</span>
                {item.target_name && (
                  <>{" "}<span className="font-medium text-foreground" title={item.target_name}>{truncateName(item.target_name)}</span></>
                )}
                {activitySuffix(item) && (
                  <>{" "}<span className="text-muted">{activitySuffix(item)}</span></>
                )}
              </p>
            </div>
            <span className="text-[11px] text-muted shrink-0 pt-0.5">{formatRelative(item.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Catch up tab ──────────────────────────────────────────────────────────────

function highlightMention(text: string, displayName: string) {
  const pattern = new RegExp(`(@${displayName.split(" ")[0]})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part) ? <span key={i} className="font-semibold" style={{ color: "var(--color-user-blue)" }}>{part}</span> : part
  );
}

function CatchUpTab({
  currentUser, mentions, unread, lastSeen, loading, clearing,
  onDismissMention, onDismissUnread, onClearAll,
}: {
  currentUser: string;
  mentions: Mention[];
  unread: UnreadConversation[];
  lastSeen: string | null;
  loading: boolean;
  clearing: boolean;
  onDismissMention: (id: string) => void;
  onDismissUnread: (id: string) => void;
  onClearAll: () => void;
}) {
  if (loading) return <div className="p-6 text-sm text-muted">Loading…</div>;

  if (mentions.length === 0 && unread.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-muted/30">
          <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
          <path d="M14 8v6.5l4 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-muted">You&apos;re all caught up.</p>
        {lastSeen && (
          <p className="text-xs text-muted/50">Last checked {formatRelative(lastSeen)}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <div className="flex items-center justify-between gap-4">
        {lastSeen ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 3.5V6.5L8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Since your last visit {formatRelative(lastSeen)}.
          </div>
        ) : <div />}
        <button
          onClick={onClearAll}
          disabled={clearing}
          className="text-xs text-muted border border-border rounded-lg px-3 py-1.5 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40 shrink-0"
        >
          {clearing ? "Clearing…" : "All caught up!"}
        </button>
      </div>

      {mentions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">Mentions</p>
            <span className="text-[10px] font-semibold rounded-full px-1.5 py-px leading-none" style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}>
              {mentions.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {mentions.map((m) => (
              <Link
                key={m.id}
                href={`/chat/${m.conversation_id}`}
                onClick={() => onDismissMention(m.id)}
                className="group flex flex-col gap-2 bg-surface border border-border rounded-xl px-4 py-3.5 hover:border-foreground/15 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{m.author_display_name}</span>
                    <span className="text-muted/40 text-xs shrink-0">in</span>
                    <span className="text-xs text-muted truncate">{m.conversation_name}</span>
                  </div>
                  <span className="text-[11px] text-muted shrink-0">{formatRelative(m.created_at)}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">
                  {highlightMention(m.content, currentUser)}
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
      )}

      {unread.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">New messages</p>
            <span className="text-[10px] font-semibold text-muted bg-background border border-border rounded-full px-1.5 py-px leading-none">
              {unread.reduce((s, c) => s + c.new_count, 0)}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {unread.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                onClick={() => onDismissUnread(c.id)}
                className="group flex items-center gap-4 bg-surface border border-border rounded-xl px-4 py-3.5 hover:border-foreground/15 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted mt-0.5">{formatRelative(c.latest_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-semibold bg-foreground rounded-full px-2 py-px leading-none" style={{ color: "var(--color-background)" }}>
                    {c.new_count} new
                  </span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-border group-hover:text-muted transition-colors">
                    <path d="M5 10l4-3-4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── SettingsTab ───────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT_DISPLAY =
  "You are an AI collaborating with a team in a shared, multiplayer workspace.\n\n" +
  "Messages are labeled with each person's name, so you can see who said what. Other AI assistants " +
  "(Claude, Gemini, ChatGPT) may also appear in the thread — their responses are labeled too. " +
  "You can build on, reference, or compare what any participant — human or AI — has said.\n\n" +
  "When it helps the team:\n" +
  "- @mention specific people to ask for input or call out their contribution\n" +
  "- Poll the group to surface opinions or check consensus\n" +
  "- Read the room — if the team seems split or uncertain, name it\n" +
  "- Research a question and bring findings back for the group to discuss\n\n" +
  "Be concise and address the team, not just the person who tagged you.";

function SettingsTab({
  projectId,
  projectName,
  systemPrompt,
  onSaved,
  canEdit,
  isOwner,
  onDeleted,
}: {
  projectId: string;
  projectName: string;
  systemPrompt: string | null;
  onSaved: (value: string | null) => void;
  canEdit: boolean;
  isOwner: boolean;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(systemPrompt ?? DEFAULT_SYSTEM_PROMPT_DISPLAY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const isDefault = systemPrompt === null;
  const MAX = 4000;

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSaving(false); return; }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ system_prompt: draft.trim() || null }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(draft.trim() || null);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        setError(json.error ?? "Failed to save");
      }
    } catch {
      setError("Network error — try again");
    }
    setSaving(false);
  }

  async function deleteProject() {
    if (deleting || confirmText !== projectName) return;
    setDeleting(true);
    setDeleteError(null);
    const token = await getToken();
    if (!token) { setDeleting(false); return; }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        onDeleted();
      } else {
        setDeleteError(json.error ?? "Failed to delete project");
        setDeleting(false);
      }
    } catch {
      setDeleteError("Network error — try again");
      setDeleting(false);
    }
  }

  async function reset() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const token = await getToken();
    if (!token) { setSaving(false); return; }
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ system_prompt: null }),
      });
      const json = await res.json();
      if (json.success) {
        setDraft(DEFAULT_SYSTEM_PROMPT_DISPLAY);
        onSaved(null);
        setSavedAt(new Date().toLocaleTimeString());
      } else {
        setError(json.error ?? "Failed to reset");
      }
    } catch {
      setError("Network error — try again");
    }
    setSaving(false);
  }

  const isDirty = draft.trim() !== (systemPrompt ?? DEFAULT_SYSTEM_PROMPT_DISPLAY).trim();

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-sm font-semibold text-foreground mb-1">AI system prompt</h2>
      <p className="text-xs text-muted mb-4">
        Sent to the AI before every conversation in this project.{" "}
        {isDefault ? "Using the default prompt." : "Custom prompt active."}
      </p>

      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setSavedAt(null); }}
        disabled={!canEdit}
        rows={14}
        maxLength={MAX}
        className="w-full rounded-lg border border-border bg-background text-foreground text-sm leading-relaxed px-3.5 py-3 resize-none focus:outline-none focus:border-foreground/30 disabled:opacity-50 disabled:cursor-default font-mono"
        placeholder="Enter a system prompt…"
      />

      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-muted">{draft.length} / {MAX}</span>

        {canEdit && (
          <div className="flex items-center gap-2">
            {savedAt && !isDirty && (
              <span className="text-[11px] text-muted">Saved at {savedAt}</span>
            )}
            {error && (
              <span className="text-[11px] text-red-500">{error}</span>
            )}
            {!isDefault && (
              <button
                onClick={reset}
                disabled={saving}
                className="text-[12px] text-muted hover:text-foreground transition-colors disabled:opacity-50 px-3 py-1.5"
              >
                Reset to default
              </button>
            )}
            <button
              onClick={save}
              disabled={saving || !isDirty}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="mt-10 pt-6 border-t border-red-500/20">
          <h2 className="text-sm font-semibold text-red-500 mb-1">Danger zone</h2>
          <p className="text-xs text-muted mb-4">
            Permanently delete this project and all its conversations, messages, and documents.
            This cannot be undone.
          </p>
          <p className="text-xs text-muted mb-2">
            Type <span className="font-mono font-semibold text-foreground">{projectName}</span> to confirm.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => { setConfirmText(e.target.value); setDeleteError(null); }}
              placeholder={projectName}
              className="flex-1 rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:border-red-500/50"
            />
            <button
              onClick={deleteProject}
              disabled={deleting || confirmText !== projectName}
              className="text-[12px] font-medium px-3 py-2 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </button>
          </div>
          {deleteError && <p className="text-[11px] text-red-500 mt-2">{deleteError}</p>}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "catchup" | "conversations" | "documents" | "members" | "activity" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "conversations", label: "Conversations" },
  { id: "documents",     label: "Documents"     },
  { id: "members",       label: "Members"       },
  { id: "activity",      label: "Activity"      },
  { id: "catchup",       label: "Catch up"      },
  { id: "settings",      label: "Settings"      },
];

function mapMember(m: ProjectMemberWithUser): Member {
  const u = m.user as typeof m.user | null;
  return {
    id: m.user_id,
    name: u?.display_name ?? m.user_id,
    color: (u?.color as UserColor) ?? "blue",
    role: m.role === "can_edit" ? "Can edit" : "Can use",
    online: false,
    tokenPct: 0,
  };
}

function mapConversation(c: DBConversation, participants: MemberPreview[] = []): Conversation {
  return {
    id: c.id,
    name: c.name,
    lastActive: formatRelative(c.created_at),
    messageCount: 0,
    participants,
    creatorUserId: c.creator_user_id,
  };
}

export default function ProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const router = useRouter();
  const { profile, user } = useAuth();
  const currentUser = profile?.display_name ?? user?.email ?? "";
  const currentUserId = user?.id ?? "";

  const [activeTab, setActiveTab] = useState<Tab>("conversations");
  const [catchupBadge,    setCatchupBadge]    = useState(0);
  const [catchupMentions, setCatchupMentions] = useState<Mention[]>([]);
  const [catchupUnread,   setCatchupUnread]   = useState<UnreadConversation[]>([]);
  const [catchupLastSeen, setCatchupLastSeen] = useState<string | null>(null);
  const [catchupLoading,  setCatchupLoading]  = useState(true);
  const [catchupClearing, setCatchupClearing] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [realMembers, setRealMembers] = useState<Member[]>([]);
  const [realConversations, setRealConversations] = useState<Conversation[]>([]);
  const [realEmoji, setRealEmoji] = useState("📁");
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);

  // Header inline name edit
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerDraft, setHeaderDraft] = useState("");
  const [headerDraftEmoji, setHeaderDraftEmoji] = useState("📁");
  const [headerEmojiOpen, setHeaderEmojiOpen] = useState(false);
  const [headerSaving, setHeaderSaving] = useState(false);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const headerCancelRef = useRef(false);
  const onlineIdsRef = useRef<Set<string>>(new Set());

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
        setIsOwner(projRes.data.created_by === user?.id);
        setSystemPrompt(projRes.data.system_prompt ?? null);
      }
      if (membersRes.data) setRealMembers(membersRes.data.map((m) => ({
        ...mapMember(m),
        online: onlineIdsRef.current.has(m.user_id),
      })));
      if (convsRes.data) {
        const mapped = convsRes.data.map((c) => mapConversation(c));
        setRealConversations(mapped);
        const ids = mapped.map((c) => c.id);
        if (ids.length > 0) {
          // Build a color map from the project members we already loaded
          const memberColorMap = new Map<string, { name: string; color: string }>();
          (membersRes.data ?? []).forEach((m) => {
            const u = m.user as typeof m.user | null;
            if (u) memberColorMap.set(m.user_id, { name: u.display_name ?? m.user_id, color: u.color ?? "blue" });
          });

          supabase
            .from("messages")
            .select("conversation_id, author_user_id, author_display_name, created_at, payer_user_id, input_tokens, output_tokens")
            .in("conversation_id", ids)
            .order("created_at", { ascending: true })
            .then(({ data: rows }) => {
              const counts = new Map<string, number>();
              // authorsByConv: ordered list of unique authors per conversation
              const authorsByConv = new Map<string, { userId: string; name: string }[]>();
              const spendByUser = new Map<string, number>();

              (rows ?? []).forEach((r) => {
                const row = r as {
                  conversation_id: string;
                  author_user_id: string | null;
                  author_display_name: string;
                  payer_user_id: string | null;
                  input_tokens: number;
                  output_tokens: number;
                };
                counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
                if (row.author_user_id) {
                  const list = authorsByConv.get(row.conversation_id) ?? [];
                  if (!list.some((a) => a.userId === row.author_user_id)) {
                    list.push({ userId: row.author_user_id!, name: row.author_display_name });
                  }
                  authorsByConv.set(row.conversation_id, list);
                }
                if (row.payer_user_id && (row.input_tokens > 0 || row.output_tokens > 0)) {
                  const prev = spendByUser.get(row.payer_user_id) ?? 0;
                  spendByUser.set(row.payer_user_id, prev + (row.input_tokens ?? 0) + (row.output_tokens ?? 0));
                }
              });

              // Update member tokenPct based on share of total AI spend
              const totalSpend = Array.from(spendByUser.values()).reduce((s, v) => s + v, 0);
              if (totalSpend > 0) {
                setRealMembers((prev) =>
                  prev.map((m) => {
                    const spend = spendByUser.get(m.id) ?? 0;
                    return { ...m, tokenPct: Math.round((spend / totalSpend) * 100) };
                  })
                );
              }

              setRealConversations((prev) =>
                prev.map((c) => {
                  const authors = authorsByConv.get(c.id) ?? [];
                  // Creator first, then others in message order
                  const sorted = [
                    ...authors.filter((a) => a.userId === c.creatorUserId),
                    ...authors.filter((a) => a.userId !== c.creatorUserId),
                  ];
                  const participants: MemberPreview[] = sorted.map((a) => ({
                    userId: a.userId,
                    name: memberColorMap.get(a.userId)?.name ?? a.name,
                    color: memberColorMap.get(a.userId)?.color ?? "blue",
                  }));
                  return { ...c, messageCount: counts.get(c.id) ?? 0, participants };
                })
              );
            });
        }
      }
    });
  }, [projectId, user]);

  useEffect(() => {
    if (!user) return;
    getToken().then((token) => {
      if (!token) return;
      fetch(`/api/projects/${projectId}/catchup?peek=1`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            const dismissed = getCatchupDismissed(projectId);
            const filteredMentions = (json.mentions ?? []).filter((m: Mention) => !dismissed.mentions?.includes(m.id));
            const filteredUnreads = (json.unread ?? []).filter((c: UnreadConversation) => {
              const dismissedAt = dismissed.unreads?.[c.id];
              return !dismissedAt || c.latest_at > dismissedAt;
            });
            setCatchupMentions(filteredMentions);
            setCatchupUnread(filteredUnreads);
            setCatchupLastSeen(json.lastSeenAt ?? null);
            setCatchupBadge(filteredMentions.length + filteredUnreads.length);
          }
          setCatchupLoading(false);
        })
        .catch(() => setCatchupLoading(false));
    });
  }, [projectId, user]);

  const refreshMembers = useCallback(async () => {
    if (!user) return;
    const { data } = await getProjectMembers(projectId, user.id);
    if (data) setRealMembers(data.map((m) => ({ ...mapMember(m), online: onlineIdsRef.current.has(m.user_id) })));
  }, [projectId, user]);

  useEffect(() => {
    if (!user) return;
    const presence = supabase.channel("presence:global");
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState<{ user_id: string }>();
        const online = new Set(Object.values(state).flat().map((p) => p.user_id));
        onlineIdsRef.current = online;
        setRealMembers((prev) => prev.map((m) => ({ ...m, online: online.has(m.id) })));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ user_id: user.id });
        }
      });
    return () => { supabase.removeChannel(presence); };
  }, [projectId, user]);

  async function handleNewConversation() {
    const token = await getToken();
    if (!token) return;
    const name = `New conversation — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    const res = await fetch("/api/conversations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, name, memberIds: [] }),
    });
    const json = await res.json();
    if (json.success) router.push(`/chat/${json.conversation.id}`);
  }

  async function handleCatchupClearAll() {
    setCatchupClearing(true);
    const token = await getToken();
    if (token) {
      await fetch(`/api/projects/${projectId}/catchup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(`elenchus_catchup_${projectId}`);
    setCatchupMentions([]);
    setCatchupUnread([]);
    setCatchupBadge(0);
    setCatchupClearing(false);
  }

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
    if (headerCancelRef.current) { headerCancelRef.current = false; return; }
    const trimmed = headerDraft.trim();
    setHeaderEmojiOpen(false);
    if (!trimmed || headerSaving) { setHeaderEditing(false); return; }
    if (trimmed === projectName && headerDraftEmoji === realEmoji) { setHeaderEditing(false); return; }
    setHeaderSaving(true);
    const token = await getToken();
    if (token) {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: trimmed, emoji: headerDraftEmoji }),
        });
        const json = await res.json();
        if (json.success) { setProjectName(trimmed); setRealEmoji(headerDraftEmoji); }
      } catch { /* best-effort */ }
    }
    setHeaderSaving(false);
    setHeaderEditing(false);
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {navOpen && <LeftNav activeProjectId={projectId} />}

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

          {headerEditing ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Emoji button + popup */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setHeaderEmojiOpen((o) => !o)}
                  className="w-8 h-8 flex items-center justify-center text-base rounded-lg hover:bg-background transition-colors"
                  title="Change emoji"
                >
                  {headerDraftEmoji}
                </button>
                {headerEmojiOpen && (
                  <div
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute left-0 top-full mt-1 z-20 bg-surface border border-border rounded-xl p-2 shadow-lg grid grid-cols-4 gap-1"
                    style={{ width: "10rem" }}
                  >
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onMouseDown={(evt) => evt.preventDefault()}
                        onClick={() => { setHeaderDraftEmoji(e); setHeaderEmojiOpen(false); headerInputRef.current?.focus(); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-background transition-colors ${headerDraftEmoji === e ? "bg-background ring-1 ring-foreground/20" : ""}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                ref={headerInputRef}
                value={headerDraft}
                onChange={(e) => setHeaderDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveHeaderName(); }
                  if (e.key === "Escape") { headerCancelRef.current = true; setHeaderEditing(false); setHeaderEmojiOpen(false); setHeaderDraft(projectName); setHeaderDraftEmoji(realEmoji); }
                }}
                onBlur={saveHeaderName}
                disabled={headerSaving}
                maxLength={80}
                className="text-sm font-medium text-foreground bg-transparent border-b border-foreground/40 focus:outline-none focus:border-foreground flex-1 min-w-0 disabled:opacity-50"
              />
              <button
                onMouseDown={() => { headerCancelRef.current = true; }}
                onClick={() => { headerCancelRef.current = false; setHeaderEditing(false); setHeaderEmojiOpen(false); setHeaderDraft(projectName); setHeaderDraftEmoji(realEmoji); }}
                className="text-[11px] text-muted hover:text-foreground shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-base shrink-0" aria-hidden>{realEmoji}</span>
              {isOwner ? (
                <button
                  onClick={() => { if (!projectName) return; setHeaderDraft(projectName); setHeaderDraftEmoji(realEmoji); setHeaderEditing(true); setTimeout(() => headerInputRef.current?.select(), 0); }}
                  title="Click to rename"
                  className="text-sm font-medium text-foreground truncate hover:opacity-70 transition-opacity text-left min-w-0"
                >
                  {projectName || "Loading…"}
                </button>
              ) : (
                <span className="text-sm font-medium text-foreground truncate">
                  {projectName || "Loading…"}
                </span>
              )}
            </div>
          )}

          <button
            onClick={handleNewConversation}
            className="flex items-center gap-1.5 bg-foreground text-surface text-xs font-medium rounded-lg px-3 py-2 hover:opacity-80 transition-opacity shrink-0"
          >
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
                    <button onClick={saveEdit} className="flex-1 text-[11px] font-semibold bg-foreground text-surface rounded-md py-1.5 hover:opacity-80 transition-opacity">Save</button>
                    <button onClick={() => setEditingProject(false)} className="flex-1 text-[11px] text-muted border border-border rounded-md py-1.5 hover:bg-background transition-colors">Cancel</button>
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-3">Members</p>
              <div className="flex flex-col gap-2.5">
                {realMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <Avatar name={m.name} color={m.color} size="sm" />
                      <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-surface" style={{ backgroundColor: m.online ? "#4ADE80" : "var(--color-border)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.name === currentUser ? <>{m.name}<span className="font-normal text-muted ml-1">— You</span></> : m.name}
                      </p>
                      <p className="text-[10px] text-muted">{m.online ? "Online" : "Away"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto px-4 py-4 border-t border-border">
              <ThemeToggle />
            </div>

          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Tab bar */}
            <div className="flex items-end gap-6 px-6 border-b border-border bg-surface shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); if (tab.id === "catchup") setCatchupBadge(0); }}
                  className="flex items-center gap-1.5 pb-3 pt-3.5 text-sm font-medium border-b-2 transition-colors shrink-0"
                  style={
                    activeTab === tab.id
                      ? { borderColor: "var(--color-foreground)", color: "var(--color-foreground)" }
                      : { borderColor: "transparent", color: "var(--color-muted)" }
                  }
                >
                  {tab.label}
                  {tab.id === "catchup" && catchupBadge > 0 && (
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-px leading-none" style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}>
                      {catchupBadge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto">
                {activeTab === "conversations" && (
                  <ConversationsTab
                    projectId={projectId}
                    currentUser={currentUser}
                    currentUserId={currentUserId}
                    conversations={realConversations}
                    members={realMembers}
                    canDelete={realMembers.find((m) => m.id === currentUserId)?.role === "Can edit"}
                    onConversationCreated={(conv) => setRealConversations((prev) => [conv, ...prev])}
                    onConversationRenamed={(id, newName) =>
                      setRealConversations((prev) => prev.map((c) => c.id === id ? { ...c, name: newName } : c))
                    }
                    onConversationDeleted={(id) =>
                      setRealConversations((prev) => prev.filter((c) => c.id !== id))
                    }
                  />
                )}
                {activeTab === "documents" && (
                  <DocumentsTab
                    projectId={projectId}
                    currentUser={currentUser}
                    conversations={realConversations}
                  />
                )}
                {activeTab === "members" && (
                  <MembersTab
                    projectId={projectId}
                    currentUser={currentUser}
                    members={realMembers}
                    onMembersRefresh={refreshMembers}
                  />
                )}
                {activeTab === "activity" && <ActivityTab projectId={projectId} />}
                {activeTab === "settings" && (
                  <SettingsTab
                    projectId={projectId}
                    projectName={projectName}
                    systemPrompt={systemPrompt}
                    onSaved={setSystemPrompt}
                    canEdit={realMembers.find((m) => m.id === currentUserId)?.role === "Can edit"}
                    isOwner={isOwner}
                    onDeleted={() => router.push("/projects")}
                  />
                )}
                {activeTab === "catchup" && (
                  <CatchUpTab
                    currentUser={currentUser}
                    mentions={catchupMentions}
                    unread={catchupUnread}
                    lastSeen={catchupLastSeen}
                    loading={catchupLoading}
                    clearing={catchupClearing}
                    onDismissMention={(id) => {
                      const d = getCatchupDismissed(projectId);
                      setCatchupDismissed(projectId, { ...d, mentions: [...(d.mentions ?? []), id] });
                      setCatchupMentions((prev) => prev.filter((m) => m.id !== id));
                      setCatchupBadge((prev) => Math.max(0, prev - 1));
                    }}
                    onDismissUnread={(id) => {
                      const d = getCatchupDismissed(projectId);
                      setCatchupDismissed(projectId, { ...d, unreads: { ...(d.unreads ?? {}), [id]: new Date().toISOString() } });
                      setCatchupUnread((prev) => prev.filter((c) => c.id !== id));
                      setCatchupBadge((prev) => Math.max(0, prev - 1));
                    }}
                    onClearAll={handleCatchupClearAll}
                  />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
