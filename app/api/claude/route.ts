import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatMessagesForClaude } from "@/lib/api";
import { decrypt } from "@/lib/encrypt";
import type { Database, Conversation, Message } from "@/lib/types/database";

// Service-role client — never sent to the browser, server-only.
// Bypasses RLS so we do access checks explicitly below.
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT =
  "You are Claude, a helpful AI assistant collaborating with a team on a shared conversation thread.\n" +
  "You can see who wrote each message and reference their work by name.\n" +
  "Be concise, helpful, and acknowledge the contributions of team members.";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

function determinePayer(conv: Conversation, callerId: string): string {
  if (conv.payer_mode === "host") return conv.creator_user_id;
  // last_speaker (default) + unimplemented modes all fall back to caller
  return callerId;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: { conversationId?: string; message?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body", 400);
  }

  const { conversationId, message, model = DEFAULT_MODEL } = body;
  if (!conversationId || !message?.trim()) {
    return err("conversationId and message are required", 400);
  }

  // ── 2. Auth check ────────────────────────────────────────────────────────
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return err("Unauthorized", 401);

  // ── 3. Verify access to conversation ────────────────────────────────────
  const { data: convRaw, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convError || !convRaw) return err("Conversation not found", 403);
  const conversation = convRaw as Conversation;

  const member = await isProjectMember(conversation.project_id, user.id);
  if (!member) return err("Forbidden", 403);

  // ── 4. Get user's API key ────────────────────────────────────────────────
  const { data: profileRaw, error: profileError } = await supabaseAdmin
    .from("users")
    .select("display_name, color, anthropic_api_key_encrypted")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) return err("Failed to fetch user profile", 500);

  const profile = profileRaw as Pick<
    Database["public"]["Tables"]["users"]["Row"],
    "display_name" | "color" | "anthropic_api_key_encrypted"
  >;

  const rawKey = profile.anthropic_api_key_encrypted;
  if (!rawKey) {
    return err("Update your API key in account settings", 400);
  }
  let userApiKey: string;
  try {
    userApiKey = decrypt(rawKey);
  } catch {
    return err("Update your API key in account settings", 400);
  }

  // ── 5. Fetch conversation history ────────────────────────────────────────
  const { data: messagesRaw, error: msgError } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Failed to fetch messages:", msgError);
    return err("Failed to fetch conversation history", 500);
  }

  const history = (messagesRaw ?? []) as Message[];

  // ── 6. Fetch project documents (soft — table may not exist yet) ──────────
  let projectDocsContent = "";
  try {
    const { data: docs } = await supabaseAdmin
      .from("project_documents" as never)
      .select("filename, content")
      .eq("project_id", conversation.project_id) as { data: { filename: string; content: string }[] | null };

    if (docs && docs.length > 0) {
      projectDocsContent = docs
        .map((d) => `## ${d.filename}\n${d.content}`)
        .join("\n\n");
    }
  } catch {
    // project_documents not in schema yet — skip silently
  }

  // ── 7. Build messages for Claude (history + new user message) ────────────
  const displayName = profile.display_name ?? user.email ?? "User";
  const sanitizedName = displayName.trim().replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);

  const formattedMessages = [
    ...formatMessagesForClaude(history),
    { role: "user" as const, content: message.trim(), name: sanitizedName },
  ];

  // ── 8. Build system blocks with prompt caching ───────────────────────────
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];

  if (projectDocsContent) {
    systemBlocks.push({
      type: "text",
      text: `[Project Documents]\n${projectDocsContent}`,
      cache_control: { type: "ephemeral" },
    });
  }

  // ── 9. Call Claude API ───────────────────────────────────────────────────
  let claudeData: {
    content: Array<{ type: string; text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": userApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemBlocks,
        messages: formattedMessages,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", body);
      if (response.status === 401) return err("Update your API key in account settings", 400);
      if (response.status === 402) return err("Your API key has no remaining credits", 402);
      if (response.status === 429) return err("You've hit your API rate limit — try again in a moment", 429);
      return err("Claude request failed — try again", 500);
    }

    claudeData = body;
  } catch (e) {
    console.error("Claude API fetch error:", e);
    return err("Claude request failed — try again", 500);
  }

  const inputTokens = claudeData.usage?.input_tokens ?? 0;
  const outputTokens = claudeData.usage?.output_tokens ?? 0;
  const assistantContent = claudeData.content?.find((b) => b.type === "text")?.text ?? "";

  // ── 10. Save user message ────────────────────────────────────────────────
  const { error: userMsgError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: message.trim(),
      author_user_id: user.id,
      author_display_name: displayName,
      caller_user_id: user.id,
      payer_user_id: null,
      model_used: null,
      input_tokens: 0,
      output_tokens: 0,
    } as never);

  if (userMsgError) {
    console.error("Failed to save user message:", userMsgError);
    // Non-fatal — continue to save assistant message
  }

  // ── 11. Save Claude response ─────────────────────────────────────────────
  const payerUserId = determinePayer(conversation, user.id);

  const { data: assistantMsgRaw, error: assistantMsgError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantContent,
      author_user_id: null,
      author_display_name: "Claude",
      caller_user_id: user.id,
      payer_user_id: payerUserId,
      model_used: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    } as never)
    .select()
    .single();

  if (assistantMsgError) {
    console.error("Failed to save assistant message:", assistantMsgError);
    return err("Database save failed", 500);
  }

  const assistantMsg = assistantMsgRaw as Message;

  // Supabase real-time broadcasts the new rows automatically —
  // clients subscribed to `messages:${conversationId}` will receive them.

  return NextResponse.json({
    success: true,
    messageId: assistantMsg.id,
    tokensUsed: { input: inputTokens, output: outputTokens },
  });
}
