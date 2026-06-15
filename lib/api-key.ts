import { supabase } from "@/lib/supabase";
import type { LLMProvider } from "@/lib/types/database";

export type { LLMProvider };
export type ApiKeyStatus = "active" | "not_set" | "error";

export function validateApiKey(key: string, provider: LLMProvider): string | null {
  if (provider === "anthropic" && !key.startsWith("sk-ant-")) {
    return "Invalid key format. Anthropic API keys start with sk-ant-";
  }
  if (provider === "openai" && !key.startsWith("sk-")) {
    return "Invalid key format. OpenAI API keys start with sk-";
  }
  return null;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

export async function saveApiKey(
  key: string,
  provider: LLMProvider,
): Promise<{ error: string | null }> {
  const validationError = validateApiKey(key, provider);
  if (validationError) return { error: validationError };

  const auth = await getAuthHeader();
  if (!auth) return { error: "Not authenticated" };

  const res = await fetch("/api/keys/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ apiKey: key, provider }),
  });

  const data = await res.json();
  return { error: res.ok ? null : (data.error ?? "Failed to save API key") };
}

export async function revokeApiKey(): Promise<{ error: string | null }> {
  const auth = await getAuthHeader();
  if (!auth) return { error: "Not authenticated" };

  const res = await fetch("/api/keys/revoke", {
    method: "DELETE",
    headers: { Authorization: auth },
  });

  const data = await res.json();
  return { error: res.ok ? null : (data.error ?? "Failed to revoke API key") };
}

export interface KeyStatusResult {
  status: ApiKeyStatus;
  provider: LLMProvider | null;
}

export async function getApiKeyStatus(): Promise<KeyStatusResult> {
  const auth = await getAuthHeader();
  if (!auth) return { status: "error", provider: null };

  try {
    const res = await fetch("/api/keys/status", {
      headers: { Authorization: auth },
    });
    if (!res.ok) return { status: "error", provider: null };
    const data = await res.json();
    return {
      status: data.status ?? "error",
      provider: data.provider ?? null,
    };
  } catch {
    return { status: "error", provider: null };
  }
}
