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
import { DEFAULT_MODEL } from "@/lib/llm";
import { getConversation, getMessages, getProject, getProjectMembers, subscribeToMessages } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { ApiKeyStatus, LLMProvider } from "@/lib/api-key";
import type { ChatMessage, ChatMember, ChatDocument, ContentSegment, DocMode } from "@/lib/chat-types";
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

function dbMsgToChat(msg: Message, memberMap: Map<string, { name: string; color: UserColor }>): ChatMessage {
  const member = msg.author_user_id ? memberMap.get(msg.author_user_id) : undefined;
  return {
    id: msg.id,
    role: msg.role,
    authorUserId: msg.author_user_id ?? null,
    authorName: member?.name ?? msg.author_display_name ?? (msg.role === "assistant" ? "AI" : ""),
    authorColor: member?.color ?? (msg.author_user_id ? "blue" : undefined),
    timestamp: formatTime(msg.created_at),
    segments: parseSegments(msg.content),
    modelUsed: msg.model_used ?? undefined,
    inputTokens: msg.input_tokens > 0 ? msg.input_tokens : undefined,
    outputTokens: msg.output_tokens > 0 ? msg.output_tokens : undefined,
    payerUserId: msg.payer_user_id ?? null,
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
  const [currentProvider, setCurrentProvider] = useState<LLMProvider | null>(null);
  const [customAgentName, setCustomAgentName] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [docMode, setDocMode] = useState<DocMode>("always");
  const colorMapRef = useRef<Map<string, { name: string; color: UserColor }>>(new Map());
  const onlineIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    getApiKeyStatus().then(({ status, provider, agentName, model }) => {
      setApiKeyStatus(status);
      setCurrentProvider(provider);
      if (agentName) setCustomAgentName(agentName);
      // Custom: pre-fill the footer with the model saved in settings (still editable per conversation)
      if (provider) setSelectedModel(provider === "custom" ? (model ?? "") : DEFAULT_MODEL[provider]);
    });
  }, []);

  // AI identity for the user's configured provider — the custom provider uses
  // the user-chosen agent name as both display name and @mention handle.
  const aiName =
    currentProvider === "custom"      ? (customAgentName || "Custom")
    : currentProvider === "anthropic" ? "Claude"
    : currentProvider === "gemini"    ? "Gemini"
    : currentProvider === "openai"    ? "ChatGPT"
    : null;
  const aiMention = aiName ? `@${aiName}` : null;

  useEffect(() => {
    const saved = localStorage.getItem(`doc-mode:${conversationId}`) as DocMode | null;
    if (saved === "always" || saved === "never") setDocMode(saved);
  }, [conversationId]);

  function handleDocModeChange(mode: DocMode) {
    setDocMode(mode);
    localStorage.setItem(`doc-mode:${conversationId}`, mode);
  }

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
                    contentLength: (d as typeof d & { content_length?: number | null }).content_length ?? null,
                  }))
              );
            }
          })
          .catch(() => {});
      }

      if (cancelled) return;

      if (projResult.data) setProject(projResult.data);

      if (membersResult.data) {
        const colorMap = new Map<string, { name: string; color: UserColor }>();
        membersResult.data.forEach((m) => {
          const u = m.user as typeof m.user | null;
          if (u) colorMap.set(m.user_id, { name: u.display_name ?? m.user_id, color: (u.color as UserColor) ?? "blue" });
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
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        // Swap out our own optimistic placeholder when the real DB row arrives
        if (newMsg.role === "user" && newMsg.author_user_id === user.id) {
          const pendingIdx = prev.findIndex((m) => m.id.startsWith("pending-"));
          if (pendingIdx !== -1) {
            const next = [...prev];
            next[pendingIdx] = mapped;
            return next;
          }
        }
        return [...prev, mapped];
      });
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
        contentLength: (d as typeof d & { content_length?: number | null }).content_length ?? null,
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
      const lower = fullContent.toLowerCase();
      const customMention = currentProvider === "custom" && aiMention ? aiMention.toLowerCase() : null;
      const isClaudeCall =
        lower.includes("@claude") ||
        lower.includes("@gemini") ||
        lower.includes("@openai") ||
        lower.includes("@chatgpt") ||
        (customMention !== null && lower.includes(customMention));
      if (isClaudeCall) {
        setAwaitingClaude(true);
        // Show the user's message immediately; realtime will swap in the real DB row
        setMessages((prev) => [...prev, {
          id: `pending-${Date.now()}`,
          role: "user" as const,
          authorUserId: user.id,
          authorName: profile.display_name,
          authorColor: currentUserColor,
          timestamp: formatTime(new Date().toISOString()),
          segments: parseSegments(fullContent),
          modelUsed: undefined,
          inputTokens: undefined,
          outputTokens: undefined,
          payerUserId: null,
        }]);
      }

      const url = isClaudeCall ? "/api/llm" : "/api/messages/send";
      const body = isClaudeCall
        ? { conversationId, message: fullContent, model: selectedModel ?? undefined, docMode }
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
            errorMsg = `No API key set — add one in settings to use ${aiMention ?? "@claude"}.`;
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

  function handleDocumentDeleted(docId: string) {
    setChatDocuments((prev) => prev.filter((d) => d.id !== docId));
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

  // ── Token context estimate ────────────────────────────────────────────────
  const messageTokens = messages.reduce((sum, m) => {
    const chars = m.segments.reduce((s, seg) => s + (seg.type === "text" ? seg.text.length : 0), 0);
    return sum + Math.ceil(chars / 4);
  }, 0);

  // System prompt: use actual length if the project has a custom one, otherwise ~90 tokens for the default
  const systemPromptTokens = project?.system_prompt
    ? Math.ceil(project.system_prompt.length / 4)
    : 90;

  // Documents: both modes pay the same per-doc manifest cost (name line).
  // "always" additionally adds an estimate of the content tokens for each doc.
  //
  // Content token estimate priority:
  //   1. content_length (chars of extracted text) / 4  — most accurate
  //   2. File-size fallback for MIME types that should be extractable:
  //      - PDF: ~20% of bytes are text (rest is structure, fonts, images)
  //      - text/*: ~90% of bytes are text
  //   3. ~800 — images (sent as vision content blocks; cost varies by size/model)
  //   4. 0 — other non-image binaries (not sent)
  let docTokens = 0;
  if (chatDocuments.length > 0) {
    const SECTION_OVERHEAD = 15;
    const perDocTokens = chatDocuments.reduce((sum, d) => {
      const manifestLine = Math.ceil((d.filename.length + 20) / 4);
      let contentTok = 0;
      if (docMode === "always") {
        if (typeof d.contentLength === "number" && d.contentLength > 0) {
          contentTok = Math.ceil(d.contentLength / 4);
        } else if (d.contentLength === null) {
          // Extraction not attempted or failed — estimate from file size by MIME type
          const mime = (d.mimeType ?? "").toLowerCase();
          if (mime === "application/pdf") {
            contentTok = Math.ceil(d.sizeBytes * 0.2 / 4);
          } else if (
            mime.startsWith("text/") ||
            mime === "application/json" ||
            mime === "application/xml" ||
            mime === "application/csv"
          ) {
            contentTok = Math.ceil(d.sizeBytes * 0.9 / 4);
          } else if (mime.startsWith("image/")) {
            contentTok = 800; // rough average vision token cost per image
          }
          // other non-image binaries: 0 — not sent
        }
        // contentLength === 0 means extraction succeeded but returned empty (e.g. scanned PDF)
      }
      return sum + manifestLine + contentTok;
    }, 0);
    docTokens = SECTION_OVERHEAD + perDocTokens;
  }

  const tokenCount = Math.max(0, messageTokens + systemPromptTokens + docTokens) || 0;

  // Compute per-member share of AI token spend in this conversation
  const spendByUser = new Map<string, number>();
  for (const m of messages) {
    if (m.role === "assistant" && m.payerUserId && (m.inputTokens || m.outputTokens)) {
      const prev = spendByUser.get(m.payerUserId) ?? 0;
      spendByUser.set(m.payerUserId, prev + (m.inputTokens ?? 0) + (m.outputTokens ?? 0));
    }
  }
  const totalSpend = Array.from(spendByUser.values()).reduce((s, v) => s + v, 0);
  const membersWithTokens = chatMembers.map((m) => {
    const spend = m.userId ? (spendByUser.get(m.userId) ?? 0) : 0;
    return { ...m, tokenPct: totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0 };
  });

  return (
    <ChatLayout
      title={conversationName || (conversation?.name ?? "Loading…")}
      projectName={project?.name ?? "Project"}
      projectId={conversation?.project_id}
      onRenameTitle={conversation ? handleRenameConversation : undefined}
      sidebar={
        <ChatSidebar
          projectName={project?.name ?? "Project"}
          members={membersWithTokens}
          documents={chatDocuments}
          conversationId={conversationId}
          currentUserName={currentUserName}
          onUploadFile={conversation ? handleUploadDoc : undefined}
          onDocumentDeleted={handleDocumentDeleted}
          mentionsOnly={mentionsOnly}
          onMentionsToggle={() => setMentionsOnly((v) => !v)}
          docMode={docMode}
          onDocModeChange={handleDocModeChange}
        />
      }
    >
      <MessageList
        messages={messages}
        currentUserName={currentUserName}
        currentUserId={user?.id}
        loading={loading}
        sending={awaitingClaude}
        mentionsOnly={mentionsOnly}
        aiName={aiName ?? "AI"}
      />
      {sendError && (
        <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm" style={{ color: "var(--color-error)", backgroundColor: "var(--color-error-bg)", border: "1px solid var(--color-error-border)" }}>
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
          <button onClick={() => setSendError(null)} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
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
        aiMention={aiMention ?? "@claude"}
        aiName={aiName ?? "Claude"}
      />
      <ChatFooter
        tokenCount={tokenCount}
        model={selectedModel ?? (currentProvider ? DEFAULT_MODEL[currentProvider] : "—")}
        provider={currentProvider}
        apiKeySet={apiKeyStatus === "active"}
        onModelChange={setSelectedModel}
      />
    </ChatLayout>
  );
}
