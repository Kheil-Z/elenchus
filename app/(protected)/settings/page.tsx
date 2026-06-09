"use client";

import { useState, useEffect } from "react";
import { LeftNav } from "@/components/LeftNav";
import { saveApiKey, revokeApiKey, getApiKeyStatus } from "@/lib/api-key";
import type { ApiKeyStatus } from "@/lib/api-key";

export default function SettingsPage() {
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<ApiKeyStatus | "loading">("loading");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    getApiKeyStatus().then(setStatus);
  }, []);

  function clearFeedback() {
    setFeedback(null);
  }

  async function handleSave() {
    clearFeedback();
    setSaving(true);
    const { error } = await saveApiKey(keyInput.trim());
    setSaving(false);
    if (error) {
      setFeedback({ type: "error", message: error });
    } else {
      setStatus("active");
      setKeyInput("");
      setFeedback({ type: "success", message: "API key saved successfully." });
    }
  }

  async function handleRevoke() {
    clearFeedback();
    setRevoking(true);
    const { error } = await revokeApiKey();
    setRevoking(false);
    if (error) {
      setFeedback({ type: "error", message: error });
    } else {
      setStatus("not_set");
      setFeedback({ type: "success", message: "API key revoked." });
    }
  }

  const hasKey = status === "active";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <LeftNav />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">
          <h1 className="font-serif text-3xl text-foreground mb-8">Account Settings</h1>

          {/* API Keys section */}
          <section className="bg-surface border border-border rounded-xl divide-y divide-border">
            {/* Section header */}
            <div className="px-6 py-5">
              <h2 className="font-medium text-foreground text-base">Anthropic API Key</h2>
              <p className="text-sm text-muted mt-0.5">
                Used to call Claude on your behalf when you trigger a response.
              </p>
            </div>

            {/* Status row */}
            <div className="px-6 py-4 flex items-center gap-3">
              <span className="text-sm text-muted w-16 shrink-0">Status</span>
              {status === "loading" ? (
                <span className="text-sm text-muted">Checking…</span>
              ) : (
                <StatusBadge status={status} />
              )}
            </div>

            {/* Input + save */}
            <div className="px-6 py-5 flex flex-col gap-3">
              <label htmlFor="api-key-input" className="text-sm font-medium text-foreground">
                {hasKey ? "Replace API key" : "Add API key"}
              </label>
              <input
                id="api-key-input"
                type="password"
                value={keyInput}
                onChange={(e) => { setKeyInput(e.target.value); clearFeedback(); }}
                placeholder="sk-ant-..."
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-foreground/20 font-mono"
              />

              {feedback && (
                <p
                  className={`text-sm ${
                    feedback.type === "success" ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {feedback.message}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !keyInput.trim()}
                  className="text-sm font-medium bg-foreground text-surface px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Save API Key"}
                </button>

                {hasKey && (
                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {revoking ? "Revoking…" : "Revoke API Key"}
                  </button>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="px-6 py-5">
              <div className="bg-background border border-border rounded-lg px-4 py-4 flex flex-col gap-2">
                <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                  About your API key
                </p>
                <ul className="text-sm text-muted space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                    Get your key from{" "}
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
                    >
                      console.anthropic.com
                    </a>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                    Encrypted and stored server-side — never in your browser
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                    Only used when you trigger a Claude response in a conversation
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                    You can revoke it from this page at any time
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ApiKeyStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Active
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span className="w-1.5 h-1.5 rounded-full bg-muted/40" />
      Not set
    </span>
  );
}
