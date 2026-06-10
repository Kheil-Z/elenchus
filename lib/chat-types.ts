import type { UserColor } from "./types";

export type ContentSegment =
  | { type: "text"; text: string }
  | { type: "doc"; id?: string; filename: string; uploader: string; sizeBytes?: number; mimeType?: string | null; createdAt?: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  authorName: string;
  authorColor?: UserColor;
  timestamp: string;
  segments: ContentSegment[];
  modelUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ChatMember {
  userId?: string;
  name: string;
  color: UserColor;
  online: boolean;
  tokenPct: number; // 0–100
}

export interface ChatDocument {
  id: string;
  filename: string;
  uploader: string;
  uploaderColor: UserColor;
  conversationId: string | null; // null = project-wide
  sizeBytes: number;
  mimeType: string | null;
  createdAt: string;
}
