import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatMessagesForClaude } from "@/lib/api";
import { decrypt } from "@/lib/encrypt";
import { callLLM, DEFAULT_MODEL, PROVIDER_DISPLAY_NAME, LLMError } from "@/lib/llm";
import type { LLMProvider } from "@/lib/types/database";
import type { Database, Conversation, Message } from "@/lib/types/database";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT =
  "You are an AI assistant collaborating with a team on a shared conversation thread.\n" +
  "You can see who wrote each message and reference their work by name.\n" +
  "Be concise, helpful, and acknowledge the contributions of team members.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data !== null;
}

function determinePayer(conv: Conversation, callerId: string): string {
  if (conv.payer_mode === "host") return conv.creator_user_id;
  return callerId;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: { conversationId?: string; message?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body", 400);
  }

  const { conversationId, message } = body;
  if (!conversationId || !message?.trim()) {
    return err("conversationId and message are required", 400);
  }

  // ── 2. Auth ──────────────────────────────────────────────────────────────
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return err("Unauthorized", 401);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return err("Unauthorized", 401);

  // ── 3. Conversation + membership ─────────────────────────────────────────
  const { data: convRaw, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (convError || !convRaw) return err("Conversation not found", 404);
  const conversation = convRaw as Conversation;

  if (!(await isProjectMember(conversation.project_id, user.id))) {
    return err("Forbidden", 403);
  }

  // ── 4. User profile + API key ─────────────────────────────────────────────
  const { data: profileRaw, error: profileError } = await supabaseAdmin
    .from("users")
    .select("display_name, color, llm_provider, llm_api_key_encrypted")
    .eq("id", user.id)
    .single();

  if (profileError || !profileRaw) return err("Failed to fetch user profile", 500);

  const profile = profileRaw as {
    display_name: string | null;
    color: string | null;
    llm_provider: LLMProvider | null;
    llm_api_key_encrypted: string | null;
  };

  if (!profile.llm_provider || !profile.llm_api_key_encrypted) {
    return err("Add an API key in account settings before calling the AI", 400);
  }

  let userApiKey: string;
  try {
    userApiKey = decrypt(profile.llm_api_key_encrypted);
  } catch {
    return err("Update your API key in account settings", 400);
  }

  // ── 5. Conversation history ───────────────────────────────────────────────
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

  // ── 6. Project documents (soft — table may not exist yet) ─────────────────
  let projectDocsContent = "";
  try {
    const { data: docs } = await supabaseAdmin
      .from("project_documents" as never)
      .select("filename, content")
      .eq("project_id", conversation.project_id) as { data: { filename: string; content: string }[] | null };

    if (docs && docs.length > 0) {
      projectDocsContent = docs.map((d) => `## ${d.filename}\n${d.content}`).join("\n\n");
    }
  } catch {
    // table not in schema yet — skip silently
  }

  // ── 7. Build messages ─────────────────────────────────────────────────────
  const displayName = profile.display_name ?? user.email ?? "User";

  const allMessages = [
    ...history,
    {
      id: "pending",
      conversation_id: conversationId,
      role: "user" as const,
      content: message.trim(),
      author_display_name: displayName,
      author_user_id: user.id,
      caller_user_id: user.id,
      payer_user_id: null,
      model_used: null,
      input_tokens: 0,
      output_tokens: 0,
      created_at: new Date().toISOString(),
    },
  ];

  const formattedMessages = formatMessagesForClaude(allMessages);
  const systemPrompt = projectDocsContent
    ? `${SYSTEM_PROMPT}\n\n[Project Documents]\n${projectDocsContent}`
    : SYSTEM_PROMPT;

  const model = body.model ?? DEFAULT_MODEL[profile.llm_provider];

  // ── 8. Call the LLM ───────────────────────────────────────────────────────
  let llmResult: Awaited<ReturnType<typeof callLLM>>;
  try {
    llmResult = await callLLM({
      provider: profile.llm_provider,
      apiKey: userApiKey,
      model,
      systemPrompt,
      messages: formattedMessages,
    });
  } catch (e) {
    if (e instanceof LLMError) return err(e.message, e.status);
    console.error("LLM call failed:", e);
    return err("AI request failed — try again", 500);
  }

  // ── 9. Save user message ──────────────────────────────────────────────────
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

  if (userMsgError) console.error("Failed to save user message:", userMsgError);

  // ── 10. Save assistant response ───────────────────────────────────────────
  const payerUserId = determinePayer(conversation, user.id);

  const { data: assistantMsgRaw, error: assistantMsgError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: llmResult.content,
      author_user_id: null,
      author_display_name: PROVIDER_DISPLAY_NAME[profile.llm_provider],
      caller_user_id: user.id,
      payer_user_id: payerUserId,
      model_used: model,
      input_tokens: llmResult.inputTokens,
      output_tokens: llmResult.outputTokens,
    } as never)
    .select()
    .single();

  if (assistantMsgError) {
    console.error("Failed to save assistant message:", assistantMsgError);
    return err("Database save failed", 500);
  }

  const assistantMsg = assistantMsgRaw as Message;

  return NextResponse.json({
    success: true,
    messageId: assistantMsg.id,
    provider: profile.llm_provider,
    tokensUsed: { input: llmResult.inputTokens, output: llmResult.outputTokens },
  });
}
