"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { MessageList } from "@/components/chat/MessageList";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { InputBar } from "@/components/chat/InputBar";
import { ChatFooter } from "@/components/chat/ChatFooter";
import { useAuth } from "@/lib/auth-context";
import { getApiKeyStatus } from "@/lib/api-key";
import { getConversation, getMessages, getProject, getProjectMembers, subscribeToMessages } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { ApiKeyStatus } from "@/lib/api-key";
import type { ChatMessage, ChatMember, ChatDocument, ContentSegment } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";
import type { Message, Conversation, Project } from "@/lib/types/database";
import type { ProjectMemberWithUser } from "@/lib/db";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const DOC_SENTINEL_RE = /\[doc:([a-f0-9-]{36}):([^\]]+)\]/g;

function parseSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  DOC_SENTINEL_RE.lastIndex = 0;
  while ((match = DOC_SENTINEL_RE.exec(content)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", text: content.slice(last, match.index) });
    }
    segments.push({ type: "doc", id: match[1]!, filename: match[2]!, uploader: "" });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    segments.push({ type: "text", text: content.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", text: content }];
}

function dbMsgToChat(msg: Message, colorMap: Map<string, UserColor>): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    authorName: msg.role === "assistant" ? "Claude" : msg.author_display_name,
    authorColor: msg.author_user_id ? (colorMap.get(msg.author_user_id) ?? "blue") : undefined,
    timestamp: formatTime(msg.created_at),
    segments: parseSegments(msg.content),
    modelUsed: msg.model_used ?? undefined,
    inputTokens: msg.input_tokens > 0 ? msg.input_tokens : undefined,
    outputTokens: msg.output_tokens > 0 ? msg.output_tokens : undefined,
  };
}

export default function ChatPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { profile, user } = useAuth();
  const currentUserName = profile?.display_name ?? user?.email ?? "";
  const currentUserColor = (profile?.color as UserColor) ?? "blue";

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationName, setConversationName] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMembers, setChatMembers] = useState<ChatMember[]>([]);
  const [chatDocuments, setChatDocuments] = useState<ChatDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [awaitingClaude, setAwaitingClaude] = useState(false);
  const [mentionsOnly, setMentionsOnly] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | "loading">("loading");
  const [sendError, setSendError] = useState<string | null>(null);
  const colorMapRef = useRef<Map<string, UserColor>>(new Map());
  const onlineIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { getApiKeyStatus().then(setApiKeyStatus); }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const convResult = await getConversation(conversationId, user!.id);
      if (cancelled || convResult.error || !convResult.data) { setLoading(false); return; }
      const conv = convResult.data;
      if (!cancelled) { setConversation(conv); setConversationName(conv.name); }

      const [projResult, membersResult, msgResult] = await Promise.all([
        getProject(conv.project_id, user!.id),
        getProjectMembers(conv.project_id, user!.id),
        getMessages(conversationId, user!.id),
      ]);

      // Load project documents
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (sess && !cancelled) {
        fetch(`/api/projects/${conv.project_id}/documents`, {
          headers: { Authorization: `Bearer ${sess.access_token}` },
        })
          .then((r) => r.json())
          .then((json) => {
            if (json.success && !cancelled) {
              setChatDocuments(
                (json.documents as Array<{
                  id: string; name: string; uploader_name: string; conversation_id: string | null;
                  size_bytes: number; mime_type: string | null; created_at: string;
                }>)
                  // Only show project-wide docs and docs scoped to this conversation
                  .filter((d) => !d.conversation_id || d.conversation_id === conversationId)
                  .map((d) => ({
                    id: d.id,
                    filename: d.name,
                    uploader: d.uploader_name,
                    uploaderColor: "blue" as UserColor,
                    conversationId: d.conversation_id,
                    sizeBytes: d.size_bytes,
                    mimeType: d.mime_type,
                    createdAt: d.created_at,
                  }))
              );
            }
          })
          .catch(() => {});
      }

      if (cancelled) return;

      if (projResult.data) setProject(projResult.data);

      if (membersResult.data) {
        const colorMap = new Map<string, UserColor>();
        membersResult.data.forEach((m) => {
          const u = m.user as typeof m.user | null;
          if (u) colorMap.set(m.user_id, (u.color as UserColor) ?? "blue");
        });
        colorMapRef.current = colorMap;
        setChatMembers(membersResult.data.map((m) => {
          const u = m.user as typeof m.user | null;
          return {
            userId: m.user_id,
            name: u?.display_name ?? m.user_id,
            color: (u?.color as UserColor) ?? "blue",
            online: onlineIdsRef.current.has(m.user_id),
            tokenPct: 0,
          };
        }));
      }

      if (msgResult.data) {
        setMessages(msgResult.data.map((m) => dbMsgToChat(m, colorMapRef.current)));
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [conversationId, user]);

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToMessages(conversationId, (newMsg) => {
      const mapped = dbMsgToChat(newMsg, colorMapRef.current);
      setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, mapped]);
      if (newMsg.role === "assistant") setAwaitingClaude(false);
    });
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    if (!user) return;
    const presence = supabase.channel("presence:global");
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState<{ user_id: string }>();
        const online = new Set(
          Object.values(state).flat().map((p) => p.user_id)
        );
        onlineIdsRef.current = online;
        setChatMembers((prev) =>
          prev.map((m) => ({ ...m, online: m.userId ? online.has(m.userId) : false }))
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ user_id: user.id });
        }
      });
    return () => { supabase.removeChannel(presence); };
  }, [conversationId, user]);

  async function uploadDoc(file: File): Promise<ChatDocument | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !conversation) return null;
    const form = new FormData();
    form.append("file", file);
    form.append("conversationId", conversationId);
    try {
      const res = await fetch(`/api/projects/${conversation.project_id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const json = await res.json();
      if (!json.success) return null;
      const d = json.document as {
        id: string; name: string; uploader_name: string; conversation_id: string | null;
        size_bytes: number; mime_type: string | null; created_at: string;
      };
      const newDoc: ChatDocument = {
        id: d.id,
        filename: d.name,
        uploader: d.uploader_name,
        uploaderColor: currentUserColor,
        conversationId: d.conversation_id,
        sizeBytes: d.size_bytes,
        mimeType: d.mime_type,
        createdAt: d.created_at,
      };
      setChatDocuments((prev) => [newDoc, ...prev]);
      return newDoc;
    } catch {
      return null;
    }
  }

  async function handleSend(content: string, files: File[] = []) {
    if (!user || !profile) return;
    if (!content && files.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSending(true);
    setSendError(null);

    // Upload attached files in parallel; collect successful docs
    let uploadedDocs: ChatDocument[] = [];
    if (files.length > 0) {
      const results = await Promise.all(files.map((f) => uploadDoc(f)));
      uploadedDocs = results.filter((d): d is ChatDocument => d !== null);
    }

    // Build combined message: text + doc sentinels on a new line
    const docSentinels = uploadedDocs.map((d) => `[doc:${d.id}:${d.filename}]`).join(" ");
    const fullContent = [content.trim(), docSentinels].filter(Boolean).join("\n");

    if (fullContent) {
      const isClaudeCall = fullContent.includes("@claude");
      if (isClaudeCall) setAwaitingClaude(true);

      const url = isClaudeCall ? "/api/claude" : "/api/messages/send";
      const body = isClaudeCall
        ? { conversationId, message: fullContent }
        : { conversationId, content: fullContent, authorDisplayName: profile.display_name };

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const rawText = await res.text().catch(() => "");
          let errorMsg = "Something went wrong. Please try again.";
          try {
            const parsed = JSON.parse(rawText) as { error?: string };
            if (parsed.error) errorMsg = parsed.error;
          } catch { /* not JSON */ }
          if (errorMsg.toLowerCase().includes("api key") || errorMsg.toLowerCase().includes("no key")) {
            errorMsg = "No API key set — add one in settings to use @claude.";
          }
          setSendError(errorMsg);
          setAwaitingClaude(false);
        }
      } catch (err) {
        console.error("Send error:", err);
        setSendError("Failed to send — check your connection.");
        setAwaitingClaude(false);
      }
    }

    setSending(false);
  }

  async function handleRenameConversation(newName: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    if (json.success) setConversationName(newName);
  }

  async function handleUploadDoc(file: File): Promise<ChatDocument | null> {
    const doc = await uploadDoc(file);
    if (!doc || !profile) return doc;

    // Send a message in the chat showing the uploaded document
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversationId,
          content: `[doc:${doc.id}:${doc.filename}]`,
          authorDisplayName: profile.display_name,
        }),
      }).catch(() => {});
    }

    return doc;
  }

  const tokenCount = messages.reduce((sum, m) => {
    const chars = m.segments.reduce((s, seg) => s + (seg.type === "text" ? seg.text.length : 0), 0);
    return sum + Math.ceil(chars / 4);
  }, 0);

  return (
    <ChatLayout
      title={conversationName || (conversation?.name ?? "Loading…")}
      projectName={project?.name ?? "Project"}
      projectId={conversation?.project_id}
      onRenameTitle={conversation ? handleRenameConversation : undefined}
      sidebar={
        <ChatSidebar
          projectName={project?.name ?? "Project"}
          members={chatMembers}
          documents={chatDocuments}
          conversationId={conversationId}
          currentUserName={currentUserName}
          onUploadFile={conversation ? handleUploadDoc : undefined}
          mentionsOnly={mentionsOnly}
          onMentionsToggle={() => setMentionsOnly((v) => !v)}
        />
      }
    >
      <MessageList
        messages={messages}
        currentUserName={currentUserName}
        loading={loading}
        sending={awaitingClaude}
        mentionsOnly={mentionsOnly}
      />
      {sendError && (
        <div className="mx-4 mb-2 flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 4.5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="flex-1">{sendError}</span>
          {sendError.includes("settings") && (
            <a href="/settings" className="underline underline-offset-2 font-medium hover:opacity-70 transition-opacity shrink-0">
              Settings
            </a>
          )}
          <button onClick={() => setSendError(null)} aria-label="Dismiss" className="shrink-0 text-red-400 hover:text-red-700 transition-colors">
            ×
          </button>
        </div>
      )}
      <InputBar
        currentUser={{ name: currentUserName, color: currentUserColor }}
        members={chatMembers}
        apiKeyStatus={apiKeyStatus === "loading" ? undefined : apiKeyStatus}
        onSend={handleSend}
        sending={sending}
      />
      <ChatFooter
        tokenCount={tokenCount}
        model="claude-sonnet-4-6"
        apiKeySet={apiKeyStatus === "active"}
      />
    </ChatLayout>
  );
}
