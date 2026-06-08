// BYOK: API keys are stored in localStorage per user and passed directly
// from the browser to the Anthropic API. No key ever touches the server.

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("anthropic_api_key");
}

export function setApiKey(key: string): void {
  localStorage.setItem("anthropic_api_key", key);
}

export function clearApiKey(): void {
  localStorage.removeItem("anthropic_api_key");
}
