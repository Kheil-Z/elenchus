"use client";

import { ChatLayout } from "@/components/chat/ChatLayout";
import { MessageList } from "@/components/chat/MessageList";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { InputBar } from "@/components/chat/InputBar";
import { ChatFooter } from "@/components/chat/ChatFooter";
import { useAuth } from "@/lib/auth-context";
import type { ChatMessage, ChatMember, ChatDocument } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";

// ── Mock data (replace with Supabase fetch keyed on conversationId) ───────────

const MEMBERS: ChatMember[] = [
  { name: "Alex Kim",   color: "blue",   online: true,  tokenPct: 48 },
  { name: "Ben Clarke", color: "green",  online: false, tokenPct: 31 },
  { name: "Clara Ng",   color: "purple", online: true,  tokenPct: 21 },
];

const DOCUMENTS: ChatDocument[] = [
  { filename: "design-brief-v3.pdf",     uploader: "Alex",  uploaderColor: "blue"   },
  { filename: "user-interviews.md",      uploader: "Clara", uploaderColor: "purple" },
  { filename: "competitor-matrix.xlsx",  uploader: "Ben",   uploaderColor: "green"  },
];

const MESSAGES: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    authorName: "Alex Kim",
    authorColor: "blue" as UserColor,
    timestamp: "10:42",
    segments: [
      {
        type: "text",
        text: "I've uploaded the latest design brief. Can we kick off by mapping the current onboarding flow? I think we need to nail down where users are dropping off before we redesign anything.",
      },
    ],
  },
  {
    id: "2",
    role: "user",
    authorName: "Ben Clarke",
    authorColor: "green" as UserColor,
    timestamp: "10:44",
    segments: [
      {
        type: "text",
        text: "Good timing — @Clara, does your interview data back this up? I've been going through the competitor research. Notion and Linear both push team invite early in onboarding. ",
      },
      { type: "doc", filename: "competitor-matrix.xlsx", uploader: "Ben" },
      {
        type: "text",
        text: " suggests they optimise for collaborative activation rather than solo setup.",
      },
    ],
  },
  {
    id: "3",
    role: "user",
    authorName: "Clara Ng",
    authorColor: "purple" as UserColor,
    timestamp: "10:46",
    segments: [
      {
        type: "text",
        text: "The interviews confirm it. Biggest drop-off is at step 3 — users get confused by the 'workspace' concept before they've even sent a message. All the detail is in ",
      },
      { type: "doc", filename: "user-interviews.md", uploader: "Clara" },
      { type: "text", text: "." },
    ],
  },
  {
    id: "4",
    role: "user",
    authorName: "Alex Kim",
    authorColor: "blue" as UserColor,
    timestamp: "10:48",
    segments: [
      {
        type: "text",
        text: "@claude — based on the brief, Ben's competitor analysis, and Clara's interviews, can you map out a revised onboarding flow we could ship this sprint?",
      },
    ],
  },
  {
    id: "5",
    role: "assistant",
    authorName: "Claude",
    timestamp: "10:48",
    modelUsed: "claude-sonnet-4-6",
    inputTokens: 2341,
    outputTokens: 312,
    segments: [
      { type: "text", text: "Here's a revised 4-step flow based on " },
      { type: "doc", filename: "design-brief-v3.pdf",    uploader: "Alex"  },
      { type: "text", text: ", "                                            },
      { type: "doc", filename: "competitor-matrix.xlsx", uploader: "Ben"   },
      { type: "text", text: ", and "                                        },
      { type: "doc", filename: "user-interviews.md",     uploader: "Clara" },
      {
        type: "text",
        text: ":\n\n**Step 1 — Send first.** Remove the workspace creation gate entirely. Let users type their first message immediately; create the project container silently in the background.\n\n**Step 2 — Name it later.** After the first message is sent, surface a single prompt: 'What is this project about?' One field, low friction, high context.\n\n**Step 3 — Invite your team.** Now introduce collaboration. Users have something to show; the invite feels purposeful rather than premature.\n\n**Step 4 — Configure together.** Model settings, system prompt, and preferences move here — after the product has been experienced.\n\n@Alex, this directly addresses the step-3 drop-off @Clara flagged. @Ben, it also matches the collaborative activation pattern both Notion and Linear use.",
      },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { profile, user } = useAuth();
  const currentUserName = profile?.display_name ?? user?.email ?? "";
  const currentUserColor = (profile?.color as UserColor) ?? "blue";

  return (
    <ChatLayout
      title="Onboarding Flow Redesign"
      projectName="Product Redesign"
      projectId="test"
      sidebar={
        <ChatSidebar
          projectName="Product Redesign"
          members={MEMBERS}
          documents={DOCUMENTS}
          currentUserName={currentUserName}
        />
      }
    >
      <MessageList messages={MESSAGES} currentUserName={currentUserName} />
      <InputBar currentUser={{ name: currentUserName, color: currentUserColor }} members={MEMBERS} />
      <ChatFooter tokenCount={2653} model="claude-sonnet-4-6" apiKeySet={true} />
    </ChatLayout>
  );
}
