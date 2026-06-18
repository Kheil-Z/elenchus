import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatMessagesForClaude } from "@/lib/api";
import { decrypt } from "@/lib/encrypt";
import { callLLM, DEFAULT_MODEL, PROVIDER_DISPLAY_NAME, PROVIDER_MODELS, LLMError } from "@/lib/llm";
import { LIMITS } from "@/lib/validate";
import type { LLMProvider } from "@/lib/types/database";
import type { Database, Conversation, Message } from "@/lib/types/database";
import type { ImageContentBlock, DocumentContentBlock } from "@/lib/types/claude";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const DEFAULT_SYSTEM_PROMPT =
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

const IMAGE_SIZE_CAP = 5 * 1024 * 1024; // 5 MB — skip larger images

async function fetchImageBase64(storagePath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from("documents").download(storagePath);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  if (buf.byteLength > IMAGE_SIZE_CAP) return null;
  return Buffer.from(buf).toString("base64");
}

function determinePayer(conv: Conversation, callerId: string): string {
  if (conv.payer_mode === "host") return conv.creator_user_id;
  return callerId;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: { conversationId?: string; message?: string; model?: string; docMode?: string };
  try {
    body = await req.json();
  } catch {
    return err("Invalid request body", 400);
  }

  const { conversationId, message } = body;
  const docMode = body.docMode === "never" ? "never" : "always";
  if (!conversationId || !message?.trim()) {
    return err("conversationId and message are required", 400);
  }
  if (message.trim().length > LIMITS.messageContent) {
    return err(`Message must be ${LIMITS.messageContent.toLocaleString()} characters or fewer`, 400);
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

  // ── 5. Project system prompt ──────────────────────────────────────────────
  const { data: projectRaw } = await supabaseAdmin
    .from("projects")
    .select("system_prompt")
    .eq("id", conversation.project_id)
    .single();
  const projectSystemPrompt = (projectRaw as { system_prompt?: string | null } | null)?.system_prompt ?? null;

  // ── 6. Conversation history ───────────────────────────────────────────────
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

  // ── 7. Documents visible in this conversation ─────────────────────────────
  // Project-wide docs (conversation_id IS NULL) + docs scoped to this conversation.
  let projectDocsContent = "";
  const imageBlocks: ImageContentBlock[] = [];
  const docBlocks: DocumentContentBlock[] = []; // Anthropic-only: native PDF blocks

  const { data: docsRaw } = await supabaseAdmin
    .from("documents")
    .select("name, content, conversation_id, storage_path, mime_type")
    .eq("project_id", conversation.project_id);

  const docs = (docsRaw ?? []) as unknown as {
    name: string;
    content: string | null;
    conversation_id: string | null;
    storage_path: string;
    mime_type: string | null;
  }[];

  const visibleDocs = docs.filter(
    (d) => d.conversation_id === null || d.conversation_id === conversationId
  );

  if (visibleDocs.length > 0) {
    const isImage = (d: typeof docs[0]) => (d.mime_type ?? "").toLowerCase().startsWith("image/");

    if (docMode === "always") {
      const isPdf    = (d: typeof docs[0]) => (d.mime_type ?? "").toLowerCase() === "application/pdf";
      // Anthropic: PDFs go as native document blocks; others: use extracted text
      const isAnthropicProvider = profile.llm_provider === "anthropic";

      const imageDocs    = visibleDocs.filter((d) => isImage(d));
      const pdfDocs      = visibleDocs.filter((d) => isPdf(d));
      // Text docs: non-image, non-pdf, with extracted content; OR pdfs with content for non-anthropic
      const textDocs     = visibleDocs.filter((d) => {
        if (isImage(d)) return false;
        if (isPdf(d)) return !isAnthropicProvider && !!d.content;
        return !!d.content;
      });
      const unreadable   = visibleDocs.filter((d) => {
        if (isImage(d) || isPdf(d)) return false; // handled separately
        return !d.content;
      });

      const parts: string[] = [];

      if (textDocs.length > 0) {
        parts.push(textDocs.map((d) => `## ${d.name}\n${d.content}`).join("\n\n"));
      }

      // Fetch image bytes; skip those that exceed the size cap
      const skippedImages: string[] = [];
      await Promise.all(
        imageDocs.map(async (d) => {
          const b64 = await fetchImageBase64(d.storage_path);
          if (b64 && d.mime_type) {
            imageBlocks.push({
              type: "image",
              source: { type: "base64", media_type: d.mime_type.toLowerCase(), data: b64 },
            });
          } else {
            skippedImages.push(d.name);
          }
        })
      );

      // For Anthropic: fetch PDF bytes and send as native document blocks
      // For other providers: extracted text was already added via textDocs above
      const skippedPdfs: string[] = [];
      if (isAnthropicProvider) {
        await Promise.all(
          pdfDocs.map(async (d) => {
            const b64 = await fetchImageBase64(d.storage_path); // same fetch helper works for any file
            if (b64) {
              docBlocks.push({
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: b64 },
              });
            } else {
              skippedPdfs.push(d.name);
            }
          })
        );
      } else {
        // Non-Anthropic: PDFs without extracted text go to unreadable
        pdfDocs.filter((d) => !d.content).forEach((d) => skippedPdfs.push(d.name));
      }

      const allUnreadable = [
        ...unreadable.map((d) => {
          const scope = d.conversation_id === null ? "project-wide" : "this chat";
          return `"${d.name}" (${scope})`;
        }),
        ...skippedImages.map((n) => `"${n}" (image too large to send)`),
        ...skippedPdfs.map((n) => `"${n}" (PDF too large to send)`),
      ];
      if (allUnreadable.length > 0) {
        parts.push(`[Also attached — content not readable: ${allUnreadable.join(", ")}]`);
      }

      if (parts.length > 0) projectDocsContent = parts.join("\n\n");
    } else {
      // "never" — manifest so the LLM knows documents exist and their scope
      const lines = visibleDocs.map((d) => {
        const scope = d.conversation_id === null ? "project-wide" : "this chat";
        return `- "${d.name}" (${scope})`;
      });
      projectDocsContent = [
        "[Available documents — content not included in this call]",
        ...lines,
        "If you need a document's content to answer a question, let the user know.",
      ].join("\n");
    }
  }

  // ── 8. Build messages ─────────────────────────────────────────────────────
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

  const formattedMessages = formatMessagesForClaude(allMessages, PROVIDER_DISPLAY_NAME[profile.llm_provider]);
  const basePrompt = projectSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const systemPrompt = projectDocsContent
    ? `${basePrompt}\n\n[Project Documents]\n${projectDocsContent}`
    : basePrompt;

  const requestedModel = body.model ?? DEFAULT_MODEL[profile.llm_provider];
  const validModels = PROVIDER_MODELS[profile.llm_provider].map((m) => m.id);
  const model = validModels.includes(requestedModel)
    ? requestedModel
    : DEFAULT_MODEL[profile.llm_provider];

  // Attach image and document blocks to the last user message
  // (vision/document inputs go in messages, not system prompt — per all provider specs)
  const allMediaBlocks = [...imageBlocks, ...docBlocks];
  if (allMediaBlocks.length > 0) {
    const last = formattedMessages[formattedMessages.length - 1];
    if (last?.role === "user") {
      const textStr = typeof last.content === "string" ? last.content : "";
      last.content = [{ type: "text", text: textStr }, ...allMediaBlocks];
    }
  }

  // ── 8. Save user message (before LLM call so it appears instantly via realtime) ──
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

  // ── 9. Call the LLM ───────────────────────────────────────────────────────
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
