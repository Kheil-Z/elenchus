export interface ClaudeResponse {
  id: string;
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
  name?: string;
}
