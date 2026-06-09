export type ApiKeyStatus = "active" | "not_set" | "error";

// Mocked until Step 6 wires the real /api/claude backend route.
// All functions simulate network latency and return success.

export async function saveApiKey(key: string): Promise<{ error: string | null }> {
  if (!key.startsWith("sk-ant-")) {
    return { error: "Invalid key format. Anthropic API keys start with sk-ant-" };
  }
  await new Promise((r) => setTimeout(r, 600));
  return { error: null };
}

export async function revokeApiKey(): Promise<{ error: string | null }> {
  await new Promise((r) => setTimeout(r, 400));
  return { error: null };
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  await new Promise((r) => setTimeout(r, 300));
  return "not_set";
}
