import type { Message } from "@/lib/types/database";
import type { ClaudeMessage } from "@/lib/types/claude";

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

