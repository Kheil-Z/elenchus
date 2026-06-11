import type { Message } from "@/lib/types/database";
import type { ClaudeMessage, ClaudeResponse } from "@/lib/types/claude";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

const SYSTEM_PROMPT =
  "You are Claude, a helpful AI assistant collaborating with a team on a shared conversation thread.\n" +
  "You can see who wrote each message and reference their work by name.\n" +
  "Be concise, helpful, and acknowledge the contributions of team members.";

// ─── Format helpers ───────────────────────────────────────────────────────────

export const formatMessagesForClaude = (messages: Message[]): ClaudeMessage[] => {
  // Anthropic requires strict user/assistant alternation.
  // Merge consecutive same-role messages into one, prefixing each part with the author name.
  const merged: ClaudeMessage[] = [];

  for (const msg of messages) {
    const authorPrefix =
      msg.role === "user" && msg.author_display_name
        ? `[${msg.author_display_name}]: `
        : "";
    const text = `${authorPrefix}${msg.content}`;

    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content = `${last.content}\n\n${text}`;
    } else {
      merged.push({ role: msg.role, content: text });
    }
  }

  return merged;
};

// Rough estimate: ~4 characters per token (good enough for budget warnings).
export const countTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// ─── API call ─────────────────────────────────────────────────────────────────

export const callClaudeAPI = async (
  apiKey: string,
  messages: Message[],
  model: string = "claude-sonnet-4-6"
): Promise<{ data: ClaudeResponse | null; error: string | null }> => {
  try {
    const formattedMessages = formatMessagesForClaude(messages);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: formattedMessages,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      const message =
        body?.error?.message ??
        `Anthropic API error ${response.status}: ${response.statusText}`;
      console.error("callClaudeAPI error response:", body);
      return { data: null, error: message };
    }

    return { data: body as ClaudeResponse, error: null };
  } catch (err) {
    console.error("callClaudeAPI error:", err);
    return { data: null, error: String(err) };
  }
};
