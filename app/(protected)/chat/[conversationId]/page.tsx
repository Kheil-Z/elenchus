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
import type { ChatMessage, ChatMember } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";
import type { Message, Conversation, Project } from "@/lib/types/database";
import type { ProjectMemberWithUser } from "@/lib/db";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dbMsgToChat(msg: Message, colorMap: Map<string, UserColor>): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    authorName: msg.role === "assistant" ? "Claude" : msg.author_display_name,
    authorColor: msg.author_user_id ? (colorMap.get(msg.author_user_id) ?? "blue") : undefined,
    timestamp: formatTime(msg.created_at),
    segments: [{ type: "text", text: msg.content }],
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
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatMembers, setChatMembers] = useState<ChatMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [awaitingClaude, setAwaitingClaude] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | "loading">("loading");
  const colorMapRef = useRef<Map<string, UserColor>>(new Map());

  useEffect(() => { getApiKeyStatus().then(setApiKeyStatus); }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const convResult = await getConversation(conversationId, user!.id);
      if (cancelled || convResult.error || !convResult.data) { setLoading(false); return; }
      const conv = convResult.data;
      if (!cancelled) setConversation(conv);

      const [projResult, membersResult, msgResult] = await Promise.all([
        getProject(conv.project_id, user!.id),
        getProjectMembers(conv.project_id, user!.id),
        getMessages(conversationId, user!.id),
      ]);

      if (cancelled) return;

      if (projResult.data) setProject(projResult.data);

      if (membersResult.data) {
        const colorMap = new Map<string, UserColor>();
        membersResult.data.forEach((m) => {
          colorMap.set(m.user_id, (m.user.color as UserColor) ?? "blue");
        });
        colorMapRef.current = colorMap;
        setChatMembers(membersResult.data.map((m) => ({
          name: m.user.display_name,
          color: (m.user.color as UserColor) ?? "blue",
          online: false,
          tokenPct: 0,
        })));
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

  async function handleSend(content: string) {
    if (!user || !profile) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const isClaudeCall = content.includes("@claude");
    setSending(true);
    if (isClaudeCall) setAwaitingClaude(true);

    const url = isClaudeCall ? "/api/claude" : "/api/messages/send";
    const body = isClaudeCall
      ? { conversationId, content }
      : { conversationId, content, authorDisplayName: profile.display_name };

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
        const err = await res.json().catch(() => ({}));
        console.error("Send failed:", err);
        setAwaitingClaude(false);
      }
    } catch (err) {
      console.error("Send error:", err);
      setAwaitingClaude(false);
    } finally {
      setSending(false);
    }
  }

  const tokenCount = messages.reduce((sum, m) => {
    const chars = m.segments.reduce((s, seg) => s + (seg.type === "text" ? seg.text.length : 0), 0);
    return sum + Math.ceil(chars / 4);
  }, 0);

  return (
    <ChatLayout
      title={conversation?.name ?? "Loading…"}
      projectName={project?.name ?? "Project"}
      projectId={conversation?.project_id}
      sidebar={
        <ChatSidebar
          projectName={project?.name ?? "Project"}
          members={chatMembers}
          documents={[]}
          currentUserName={currentUserName}
        />
      }
    >
      <MessageList
        messages={messages}
        currentUserName={currentUserName}
        loading={loading}
        sending={awaitingClaude}
      />
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
