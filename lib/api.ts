import type { Message } from "@/lib/types/database";
import type { ClaudeMessage } from "@/lib/types/claude";

// ─── Format helpers ───────────────────────────────────────────────────────────

// callerDisplayName is the display name of the AI being called (e.g. "Claude", "Gemini").
// That AI's own past responses stay as role:"assistant"; other AIs' responses become
// role:"user" with a [Name]: prefix so the called AI can see and attribute them.
export const formatMessagesForClaude = (
  messages: Message[],
  callerDisplayName: string,
): ClaudeMessage[] => {
  const merged: ClaudeMessage[] = [];

  for (const msg of messages) {
    let role: "user" | "assistant";
    let text: string;

    if (msg.role === "user") {
      role = "user";
      const prefix = msg.author_display_name ? `[${msg.author_display_name}]: ` : "";
      text = `${prefix}${msg.content}`;
    } else if (msg.author_display_name === callerDisplayName) {
      // This AI's own past response — keep as assistant turn.
      role = "assistant";
      text = msg.content;
    } else {
      // Another AI's response — surface as a user turn so the called AI can read it.
      role = "user";
      const prefix = msg.author_display_name ? `[${msg.author_display_name}]: ` : "[AI]: ";
      text = `${prefix}${msg.content}`;
    }

    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${text}`;
    } else {
      merged.push({ role, content: text });
    }
  }

  return merged;
};

// Rough estimate: ~4 characters per token (good enough for budget warnings).
export const countTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

