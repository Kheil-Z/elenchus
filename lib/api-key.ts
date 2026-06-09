import { supabase } from "@/lib/supabase";

export type ApiKeyStatus = "active" | "not_set" | "error";

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? `Bearer ${session.access_token}` : null;
}

export async function saveApiKey(key: string): Promise<{ error: string | null }> {
  if (!key.startsWith("sk-ant-")) {
    return { error: "Invalid key format. Anthropic API keys start with sk-ant-" };
  }

  const auth = await getAuthHeader();
  if (!auth) return { error: "Not authenticated" };

  const res = await fetch("/api/keys/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ apiKey: key }),
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

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const auth = await getAuthHeader();
  if (!auth) return "error";

  try {
    const res = await fetch("/api/keys/status", {
      headers: { Authorization: auth },
    });
    if (!res.ok) return "error";
    const data = await res.json();
    return data.status ?? "error";
  } catch {
    return "error";
  }
}
