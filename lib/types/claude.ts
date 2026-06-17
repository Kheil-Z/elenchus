type TextContentBlock = { type: "text";  text: string };
export type ImageContentBlock = {
  type: "image";
  source: {
    type: "base64";
    media_type: string; // e.g. "image/jpeg"
    data: string;       // raw base64, no data: URI prefix
  };
};
// Anthropic-only: lets Claude read the PDF natively (handles scanned docs too)
export type DocumentContentBlock = {
  type: "document";
  source: {
    type: "base64";
    media_type: "application/pdf";
    data: string;
  };
};
export type ContentBlock = TextContentBlock | ImageContentBlock | DocumentContentBlock;

export interface ClaudeMessage {
  role: "user" | "assistant";
  // string = text-only (backward-compat); ContentBlock[] = multimodal
  content: string | ContentBlock[];
}

