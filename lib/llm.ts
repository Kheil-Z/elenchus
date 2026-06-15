// Provider-agnostic LLM call layer.
// Each provider branch accepts the same normalised input and returns the same
// normalised output — the route never needs to know which provider was used.

import type { LLMProvider } from "@/lib/types/database";
import type { ClaudeMessage } from "@/lib/types/claude";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface LLMRequest {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── Per-provider constants ───────────────────────────────────────────────────

export const DEFAULT_MODEL: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  gemini:    "gemini-2.5-flash",
  openai:    "gpt-4o",
};

export const PROVIDER_DISPLAY_NAME: Record<LLMProvider, string> = {
  anthropic: "Claude",
  gemini:    "Gemini",
  openai:    "ChatGPT",
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
};

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
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
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

// ─── Provider: Gemini ─────────────────────────────────────────────────────────

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const url = `${GEMINI_API_BASE}/${req.model}:generateContent?key=${req.apiKey}`;

  const contents = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
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
  }
}

// ─── Typed errors (lets the route set the right HTTP status without string matching) ──

export class LLMError               extends Error { readonly status: number = 500; }
export class LLMAuthError           extends LLMError { override readonly status = 400; }
export class LLMCreditError         extends LLMError { override readonly status = 402; }
export class LLMRateLimitError      extends LLMError { override readonly status = 429; }
export class LLMNotImplementedError extends LLMError { override readonly status = 501; }
