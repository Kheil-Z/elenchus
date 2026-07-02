// Provider-agnostic LLM call layer.
// Each provider branch accepts the same normalised input and returns the same
// normalised output — the route never needs to know which provider was used.

import type { LLMProvider } from "@/lib/types/database";
import type { ClaudeMessage, ContentBlock } from "@/lib/types/claude";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LLMRequest {
  provider: LLMProvider;
  apiKey: string;         // empty string for custom endpoints with no auth
  model: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  baseUrl?: string;       // required when provider === "custom"
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── Per-provider constants ───────────────────────────────────────────────────

export const DEFAULT_MODEL: Record<LLMProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  gemini:    "gemini-2.5-flash",
  openai:    "gpt-4o-mini",
  custom:    "",   // no default — the user types their model name
};

export const PROVIDER_DISPLAY_NAME: Record<LLMProvider, string> = {
  anthropic: "Claude",
  gemini:    "Gemini",
  openai:    "ChatGPT",
  custom:    "Custom", // replaced at call time by the user's agent name
};

export const PROVIDER_MODELS: Record<LLMProvider, { id: string; name: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-8",           name: "Claude Opus 4.8"    },
    { id: "claude-sonnet-4-6",         name: "Claude Sonnet 4.6"  },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5"   },
  ],
  gemini: [
    { id: "gemini-2.5-pro",   name: "Gemini 2.5 Pro"   },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ],
  openai: [
    { id: "gpt-4o",      name: "GPT-4o"      },
    { id: "gpt-4o-mini", name: "GPT-4o mini" },
    { id: "o4-mini",     name: "o4 mini"     },
  ],
  custom: [],   // free-text model name — no fixed list
};

// ─── Content-block converters (Anthropic format is the canonical input) ───────

// OpenAI image_url format (document blocks are Anthropic-only — skip them here)
function toOpenAIContent(content: string | ContentBlock[]): unknown {
  if (typeof content === "string") return content;
  const out: unknown[] = [];
  for (const b of content) {
    if (b.type === "text")  out.push({ type: "text", text: b.text });
    if (b.type === "image") out.push({ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } });
    // document blocks: not supported by OpenAI — text already in system prompt
  }
  return out;
}

// Gemini inlineData format (document blocks are Anthropic-only — skip them here)
function toGeminiParts(content: string | ContentBlock[]): unknown[] {
  if (typeof content === "string") return [{ text: content }];
  const out: unknown[] = [];
  for (const b of content) {
    if (b.type === "text")  out.push({ text: b.text });
    if (b.type === "image") out.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
    // document blocks: not supported by Gemini
  }
  return out;
}

// ─── Provider: Anthropic ──────────────────────────────────────────────────────

const ANTHROPIC_API_URL     = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

async function callAnthropic(req: LLMRequest): Promise<LLMResponse> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-api-key":       req.apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify({
      model:      req.model,
      max_tokens: req.maxTokens ?? 4096,
      system:     req.systemPrompt,
      messages:   req.messages,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    const msg: string = body?.error?.message ?? `Anthropic ${response.status}`;
    if (response.status === 401) throw new LLMAuthError("Update your API key in account settings");
    if (response.status === 402 || msg.toLowerCase().includes("credit"))
      throw new LLMCreditError("Your API key has no remaining credits — add credits at console.anthropic.com");
    if (response.status === 429) throw new LLMRateLimitError("You've hit your API rate limit — try again in a moment");
    throw new LLMError(msg);
  }

  return {
    content:      body.content?.find((b: { type: string }) => b.type === "text")?.text ?? "",
    inputTokens:  body.usage?.input_tokens  ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  };
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

async function callOpenAI(req: LLMRequest): Promise<LLMResponse> {
  const messages = [
    { role: "system", content: req.systemPrompt },
    ...req.messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
  ];

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model:      req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    const msg: string = body?.error?.message ?? `OpenAI ${response.status}`;
    if (response.status === 401) throw new LLMAuthError("Update your API key in account settings");
    if (response.status === 429) throw new LLMRateLimitError("You've hit your API rate limit — try again in a moment");
    if (response.status === 402 || msg.toLowerCase().includes("quota"))
      throw new LLMCreditError("Your API key has no remaining credits — add credits at platform.openai.com");
    throw new LLMError(msg);
  }

  return {
    content:      body.choices?.[0]?.message?.content ?? "",
    inputTokens:  body.usage?.prompt_tokens            ?? 0,
    outputTokens: body.usage?.completion_tokens        ?? 0,
  };
}

// ─── Provider: Custom (OpenAI-compatible endpoint) ────────────────────────────
// Same wire format as OpenAI, but with a user-supplied base URL and optional
// auth (plain Ollama / LM Studio setups have none).

async function callCustom(req: LLMRequest): Promise<LLMResponse> {
  const url = (req.baseUrl ?? "").replace(/\/$/, "") + "/chat/completions";

  const messages = [
    { role: "system", content: req.systemPrompt },
    ...req.messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
  ];

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (req.apiKey) headers["Authorization"] = `Bearer ${req.apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model:      req.model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
    }),
  });

  // 520–530 are Cloudflare edge statuses that origin servers never emit —
  // 530 in particular means "no tunnel connected for this hostname", i.e. the
  // saved URL is stale (quick-tunnel URLs change on every restart).
  if (response.status >= 520 && response.status <= 530) {
    throw new LLMError(
      `Tunnel unreachable (${response.status}) — the endpoint's public URL is stale or the tunnel is down. Restart your tunnel and update the base URL in account settings.`
    );
  }

  let body: { error?: { message?: string } | string; choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  try {
    body = await response.json();
  } catch {
    throw new LLMError(`Custom endpoint returned a non-JSON response (${response.status}) — check the base URL in account settings`);
  }

  if (!response.ok) {
    // Some servers return { error: "..." } instead of { error: { message } }
    const rawErr = body?.error;
    const msg: string = typeof rawErr === "string" ? rawErr : (rawErr?.message ?? `Custom endpoint ${response.status}`);
    if (response.status === 401 || response.status === 403)
      throw new LLMAuthError("Custom endpoint rejected the request — check your API key and base URL in account settings");
    if (response.status === 429) throw new LLMRateLimitError("Rate limit hit — try again in a moment");
    if (response.status === 404)
      throw new LLMError(`Custom endpoint 404 — check the model name (settings or chat footer) and that the base URL ends with the right path. Endpoint said: ${msg}`);
    throw new LLMError(msg);
  }

  return {
    content:      body.choices?.[0]?.message?.content ?? "",
    inputTokens:  body.usage?.prompt_tokens            ?? 0,
    outputTokens: body.usage?.completion_tokens        ?? 0,
  };
}

// ─── Provider: Gemini ─────────────────────────────────────────────────────────

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const url = `${GEMINI_API_BASE}/${req.model}:generateContent?key=${req.apiKey}`;

  const contents = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toGeminiParts(m.content),
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(req.systemPrompt ? { systemInstruction: { parts: [{ text: req.systemPrompt }] } } : {}),
      generationConfig: { maxOutputTokens: req.maxTokens ?? 4096 },
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    const msg: string = body?.error?.message ?? `Gemini ${response.status}`;
    console.error("[callGemini] error", response.status, JSON.stringify(body));
    if (response.status === 401 || response.status === 403)
      throw new LLMAuthError("Update your API key in account settings");
    if (response.status === 429)
      throw new LLMRateLimitError(`Gemini rate limit hit — try again in a moment (${msg})`);
    throw new LLMError(msg);
  }

  const text: string         = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const inputTokens: number  = body?.usageMetadata?.promptTokenCount             ?? 0;
  const outputTokens: number = body?.usageMetadata?.candidatesTokenCount         ?? 0;

  return { content: text, inputTokens, outputTokens };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  switch (req.provider) {
    case "anthropic": return callAnthropic(req);
    case "gemini":    return callGemini(req);
    case "openai":    return callOpenAI(req);
    case "custom":    return callCustom(req);
  }
}

// ─── Typed errors (lets the route set the right HTTP status without string matching) ──

export class LLMError          extends Error { readonly status: number = 500; }
export class LLMAuthError      extends LLMError { override readonly status = 400; }
export class LLMCreditError    extends LLMError { override readonly status = 402; }
export class LLMRateLimitError extends LLMError { override readonly status = 429; }
