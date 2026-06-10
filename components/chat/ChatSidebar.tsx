"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { DocPreviewModal } from "@/components/DocPreviewModal";
import type { ChatMember, ChatDocument } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";

const dotColor: Record<UserColor, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  purple: "#A855F7",
  coral:  "#F87171",
  amber:  "#F59E0B",
};

interface ChatSidebarProps {
  projectName: string;
  members: ChatMember[];
  documents: ChatDocument[];
  conversationId?: string;
  currentUserName?: string;
  onUploadFile?: (file: File) => Promise<ChatDocument | null>;
  mentionsOnly?: boolean;
  onMentionsToggle?: () => void;
}

function DocRow({
  doc,
  conversationId,
  onScopeChange,
  onPreview,
  onDelete,
}: {
  doc: ChatDocument;
  conversationId?: string;
  onScopeChange?: (docId: string, toConvId: string | null) => void;
  onPreview: (doc: ChatDocument) => void;
  onDelete?: (docId: string) => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isChat = doc.conversationId !== null;

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    await onDelete?.(doc.id);
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div className="group/doc flex items-start gap-2 p-2 rounded-lg hover:bg-background transition-colors">
      <button
        onClick={() => onPreview(doc)}
        className="text-sm mt-px shrink-0 hover:scale-110 transition-transform"
        aria-label={`Preview ${doc.filename}`}
        title="Click to preview"
      >
        📄
      </button>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => onPreview(doc)}
          className="text-left w-full"
          title="Click to preview"
        >
          <p className="text-xs font-medium text-foreground truncate hover:underline underline-offset-2">
            {doc.filename}
          </p>
        </button>
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: dotColor[doc.uploaderColor] }}
          />
          <span className="text-[10px] text-muted">{doc.uploader}</span>
        </div>
      </div>
      {/* Action buttons — scope toggle + delete */}
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5 opacity-0 group-hover/doc:opacity-100 transition-opacity">
        {onScopeChange && conversationId && (
          <button
            onClick={() => onScopeChange(doc.id, isChat ? null : conversationId)}
            title={isChat ? "Make project-wide" : "Move to this chat only"}
            className="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-foreground hover:bg-border/60 transition-colors"
          >
            {isChat ? (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M4.5 7.5V1.5M1.5 4.5l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M4.5 1.5v6M1.5 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
        {onDelete && !confirmDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            title="Delete document"
            className="w-5 h-5 flex items-center justify-center rounded text-muted/50 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M2 3h8M4 3V2h4v1M5 5.5v3M7 5.5v3M3 3l.5 7h5L9 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {confirmDelete && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">Delete?</span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
              className="text-[10px] text-muted border border-border rounded px-1.5 py-0.5 hover:bg-background transition-colors"
            >
              No
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[10px] font-medium text-white bg-red-600 hover:bg-red-700 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
            >
              {deleting ? "…" : "Yes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatSidebar({
  projectName,
  members,
  documents,
  conversationId,
  currentUserName,
  onUploadFile,
  mentionsOnly = false,
  onMentionsToggle,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");

  const [addingMember, setAddingMember] = useState(false);
  const [inviteValue, setInviteValue] = useState("");

  const [docList, setDocList] = useState<ChatDocument[]>(documents);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ChatDocument | null>(null);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Keep in sync when the parent's async doc load completes or adds a new doc
  useEffect(() => {
    setDocList(documents);
  }, [documents]);

  function handleInvite() {
    setAddingMember(false);
    setInviteValue("");
  }

  async function handleDocFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!onUploadFile) return;
    setUploading(true);
    setUploadError(null);
    const doc = await onUploadFile(file);
    if (!doc) setUploadError("Upload failed — try again");
    setUploading(false);
  }

  async function handleDeleteDoc(docId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/documents/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      setDocList((prev) => prev.filter((d) => d.id !== docId));
    }
  }

  async function handleScopeChange(docId: string, toConversationId: string | null) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch(`/api/documents/${docId}/scope`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ conversationId: toConversationId }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.success) {
      setDocList((prev) =>
        prev.map((d) => d.id === docId ? { ...d, conversationId: toConversationId } : d)
      );
    }
  }

  const chatDocs = conversationId
    ? docList.filter((d) => d.conversationId === conversationId)
    : [];
  const projectDocs = docList.filter((d) => d.conversationId === null);

  return (
    <>
    {previewDoc && (
      <DocPreviewModal
        id={previewDoc.id}
        name={previewDoc.filename}
        sizeBytes={previewDoc.sizeBytes}
        mimeType={previewDoc.mimeType}
        uploaderName={previewDoc.uploader}
        createdAt={previewDoc.createdAt}
        onClose={() => setPreviewDoc(null)}
        onDeleted={(deletedId) => {
          setDocList((prev) => prev.filter((d) => d.id !== deletedId));
          setPreviewDoc(null);
        }}
      />
    )}
    <aside className="w-60 border-l border-border bg-surface flex flex-col overflow-y-auto shrink-0">

      {/* Search + filters */}
      <div className="px-3 py-3 border-b border-border flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2.5 py-1.5 focus-within:border-foreground/20 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted shrink-0">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversation…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted/40 focus:outline-none min-w-0"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-muted/60 hover:text-foreground transition-colors leading-none shrink-0"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={onMentionsToggle}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors w-full text-left"
          style={
            mentionsOnly
              ? { backgroundColor: "rgba(59,130,246,0.1)", color: "#1D4ED8" }
              : { color: "var(--color-muted)" }
          }
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6 3.5C4.6 3.5 3.5 4.6 3.5 6C3.5 7.4 4.6 8.5 6 8.5C7.4 8.5 8.5 7.9 8.5 6V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="6" cy="6" r="1.2" fill="currentColor" />
          </svg>
          <span className="font-medium">My mentions</span>
          {mentionsOnly && (
            <span className="ml-auto text-[10px] font-semibold bg-blue-500 text-white rounded-full px-1.5 py-px leading-none">
              on
            </span>
          )}
        </button>
      </div>

      {/* Project */}
      <div className="px-4 py-4 border-b border-border">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60 mb-2">
          Project
        </p>
        <span className="text-sm font-medium text-foreground">{projectName}</span>
      </div>

      {/* Members */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
            Members
          </p>
          <button
            onClick={() => setAddingMember((v) => !v)}
            aria-label="Add member"
            title="Add member"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-background transition-colors text-muted hover:text-foreground"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <div key={m.name} className="flex items-start gap-2.5">
              <div className="relative shrink-0 mt-0.5">
                <Avatar name={m.name} color={m.color} size="sm" />
                <span
                  className="absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-surface"
                  style={{ backgroundColor: m.online ? "#4ADE80" : "#D1D5DB" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1 mb-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {m.name}
                    {m.name === currentUserName && (
                      <span className="font-normal text-muted ml-1">— You</span>
                    )}
                  </p>
                  <span className="text-[11px] font-medium text-muted shrink-0">
                    {m.tokenPct}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.tokenPct}%`, backgroundColor: dotColor[m.color] }}
                  />
                </div>
                <p className="text-[10px] text-muted mt-0.5">{m.online ? "Online" : "Away"}</p>
              </div>
            </div>
          ))}
        </div>

        {addingMember && (
          <div className="mt-3 flex gap-1.5">
            <input
              autoFocus
              value={inviteValue}
              onChange={(e) => setInviteValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="Name or email…"
              className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-foreground/30 placeholder:text-muted/40 min-w-0"
            />
            <button
              onClick={handleInvite}
              className="text-[11px] font-semibold bg-foreground text-surface px-2.5 py-1.5 rounded-md hover:opacity-80 transition-opacity shrink-0"
            >
              Invite
            </button>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted/60">
            Documents
          </p>
          {onUploadFile && (
            <button
              onClick={() => { if (!uploading) docFileRef.current?.click(); }}
              aria-label="Upload document"
              title={uploading ? "Uploading…" : "Upload to this chat"}
              disabled={uploading}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-background transition-colors text-muted hover:text-foreground disabled:opacity-40"
            >
              {uploading ? (
                <svg className="animate-spin" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="10" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>

        <input ref={docFileRef} type="file" className="hidden" onChange={handleDocFile} />

        {uploadError && (
          <p className="text-[10px] text-red-600 mb-2">{uploadError}</p>
        )}

        {/* Project-wide section */}
        <div className={conversationId ? "mb-3" : ""}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="text-muted/50 shrink-0">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1" />
              <path d="M1 4.5h7M4.5 1c-.7 1-1.2 2.1-1.2 3.5S3.8 7 4.5 8M4.5 1c.7 1 1.2 2.1 1.2 3.5S5.2 7 4.5 8" stroke="currentColor" strokeWidth="1" />
            </svg>
            <span className="text-[10px] font-medium text-muted/60">Project-wide</span>
          </div>
          {projectDocs.length === 0 ? (
            <p className="text-[10px] text-muted/40 pl-0.5">No project-wide documents.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {projectDocs.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  conversationId={conversationId}
                  onScopeChange={handleScopeChange}
                  onPreview={setPreviewDoc}
                  onDelete={handleDeleteDoc}
                />
              ))}
            </div>
          )}
        </div>

        {/* This chat section */}
        {conversationId && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="text-muted/50 shrink-0">
                <path d="M1 1.5h7a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H5L3 8V6.5H1a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px] font-medium text-muted/60">This chat</span>
            </div>
            {chatDocs.length === 0 ? (
              <p className="text-[10px] text-muted/40 pl-0.5">None yet — upload to add.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {chatDocs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    conversationId={conversationId}
                    onScopeChange={handleScopeChange}
                    onPreview={setPreviewDoc}
                    onDelete={handleDeleteDoc}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
