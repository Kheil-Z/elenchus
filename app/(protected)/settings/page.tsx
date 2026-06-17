"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LeftNav } from "@/components/LeftNav";
import { Avatar } from "@/components/Avatar";
import { saveApiKey, revokeApiKey, getApiKeyStatus } from "@/lib/api-key";
import { updateUserProfile } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { PROVIDER_DISPLAY_NAME } from "@/lib/llm";
import type { ApiKeyStatus, LLMProvider } from "@/lib/api-key";
import type { UserColor } from "@/lib/types";

const PROVIDER_OPTIONS: {
  value: LLMProvider;
  label: string;
  description: string;
  placeholder: string;
  consoleUrl: string;
  consoleName: string;
}[] = [
  {
    value: "anthropic",
    label: "Anthropic",
    description: "Claude models",
    placeholder: "sk-ant-...",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    consoleName: "console.anthropic.com",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Gemini models",
    placeholder: "Paste your API key…",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    consoleName: "aistudio.google.com",
  },
  {
    value: "openai",
    label: "OpenAI",
    description: "GPT models",
    placeholder: "sk-...",
    consoleUrl: "https://platform.openai.com/api-keys",
    consoleName: "platform.openai.com",
  },
];

const COLOR_OPTIONS: { value: UserColor; bg: string; ring: string; label: string }[] = [
  { value: "blue",   bg: "#DBEAFE", ring: "#1D4ED8", label: "Blue"   },
  { value: "sky",    bg: "#E0F2FE", ring: "#0369A1", label: "Sky"    },
  { value: "teal",   bg: "#CCFBF1", ring: "#0F766E", label: "Teal"   },
  { value: "green",  bg: "#DCFCE7", ring: "#15803D", label: "Green"  },
  { value: "lime",   bg: "#ECFCCB", ring: "#3F6212", label: "Lime"   },
  { value: "amber",  bg: "#FEF3C7", ring: "#92400E", label: "Amber"  },
  { value: "orange", bg: "#FFEDD5", ring: "#C2410C", label: "Orange" },
  { value: "coral",  bg: "#FEE2E2", ring: "#B91C1C", label: "Coral"  },
  { value: "rose",   bg: "#FCE7F3", ring: "#9D174D", label: "Rose"   },
  { value: "purple", bg: "#F3E8FF", ring: "#7E22CE", label: "Purple" },
  { value: "indigo", bg: "#E0E7FF", ring: "#4338CA", label: "Indigo" },
];

export default function SettingsPage() {
  const { profile, user, refreshProfile } = useAuth();
  const router = useRouter();
  const [keyInput, setKeyInput] = useState("");
  const [status, setStatus] = useState<ApiKeyStatus | "loading">("loading");
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>("anthropic");
  const [storedProvider,  setStoredProvider]  = useState<LLMProvider | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [selectedColor, setSelectedColor] = useState<UserColor>((profile?.color as UserColor) ?? "blue");
  const [colorSaving, setColorSaving] = useState(false);
  const [colorFeedback, setColorFeedback] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen]     = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting]                   = useState(false);
  const [deleteError, setDeleteError]             = useState<string | null>(null);

  useEffect(() => {
    if (profile?.color) setSelectedColor(profile.color as UserColor);
  }, [profile?.color]);

  useEffect(() => {
    getApiKeyStatus().then(({ status: s, provider }) => {
      setStatus(s);
      if (provider) { setSelectedProvider(provider); setStoredProvider(provider); }
      if (s === "not_set" || s === "error") setIsEditing(true);
    });
  }, []);

  async function handleColorSave() {
    if (!user || colorSaving) return;
    setColorSaving(true);
    setColorFeedback(null);
    const { error } = await updateUserProfile(user.id, { color: selectedColor });
    setColorSaving(false);
    if (error) {
      setColorFeedback("Failed to save — try again");
    } else {
      await refreshProfile();
      setColorFeedback("Saved!");
      setTimeout(() => setColorFeedback(null), 2000);
    }
  }

  function clearFeedback() {
    setFeedback(null);
  }

  async function handleSave() {
    clearFeedback();
    setSaving(true);
    const { error } = await saveApiKey(keyInput.trim(), selectedProvider);
    setSaving(false);
    if (error) {
      setFeedback({ type: "error", message: error });
    } else {
      setStatus("active");
      setStoredProvider(selectedProvider);
      setKeyInput("");
      setIsEditing(false);
      setFeedback({ type: "success", message: "API key saved." });
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
      setStoredProvider(null);
      setIsEditing(true);
      setFeedback({ type: "success", message: "API key revoked." });
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDeleteError("Not authenticated — please refresh and try again."); setDeleting(false); return; }

    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setDeleteError(json.error ?? "Something went wrong — please try again.");
      setDeleting(false);
      return;
    }
    // Sign out locally — the server already deleted the auth user
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const hasKey = status === "active";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <LeftNav />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">
          <h1 className="font-serif text-3xl text-foreground mb-8">Account Settings</h1>

          {/* Profile section */}
          <section className="bg-surface border border-border rounded-xl divide-y divide-border mb-6">
            <div className="px-6 py-5">
              <h2 className="font-medium text-foreground text-base">Profile</h2>
              <p className="text-sm text-muted mt-0.5">
                Customize how you appear to other members.
              </p>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <Avatar
                  name={profile?.display_name ?? user?.email ?? ""}
                  color={selectedColor}
                  size="lg"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {profile?.display_name ?? user?.email ?? ""}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{user?.email}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Avatar colour</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setSelectedColor(c.value)}
                      title={c.label}
                      className="w-8 h-8 rounded-full transition-all"
                      style={{
                        backgroundColor: c.bg,
                        outline: selectedColor === c.value ? `2px solid ${c.ring}` : "2px solid transparent",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleColorSave}
                  disabled={colorSaving || selectedColor === (profile?.color ?? "blue")}
                  className="text-sm font-medium bg-foreground text-surface px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {colorSaving ? "Saving…" : "Save colour"}
                </button>
                {colorFeedback && (
                  <p className="text-sm" style={{ color: "var(--color-success)" }}>{colorFeedback}</p>
                )}
              </div>
            </div>
          </section>

          {/* AI Provider section */}
          <section className="bg-surface border border-border rounded-xl divide-y divide-border">
            <div className="px-6 py-5">
              <h2 className="font-medium text-foreground text-base">AI Provider</h2>
              <p className="text-sm text-muted mt-0.5">
                Choose your provider and add your API key. Used when you trigger an AI response.
              </p>
            </div>

            {/* Provider picker */}
            <div className="px-6 py-5 flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Provider</p>
              <div className="grid grid-cols-3 gap-3">
                {PROVIDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSelectedProvider(opt.value); clearFeedback(); setKeyInput(""); }}
                    className={`flex flex-col gap-0.5 text-left px-4 py-3 rounded-xl border transition-all ${
                      selectedProvider === opt.value
                        ? "border-foreground/40 bg-background shadow-sm"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-xs text-muted">{opt.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Status + update trigger */}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted w-16 shrink-0">Status</span>
                {status === "loading" ? (
                  <span className="text-sm text-muted">Checking…</span>
                ) : (
                  <StatusBadge status={status} />
                )}
                {hasKey && storedProvider && (
                  <span className="text-xs text-muted px-2 py-0.5 rounded-md bg-background border border-border">
                    {PROVIDER_DISPLAY_NAME[storedProvider]}
                  </span>
                )}
              </div>
              {hasKey && !isEditing && (
                <button
                  onClick={() => { setIsEditing(true); clearFeedback(); }}
                  className="text-xs text-muted border border-border px-3 py-1.5 rounded-lg hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
                >
                  Update key
                </button>
              )}
            </div>

            {/* Key input form */}
            {(isEditing || !hasKey) && status !== "loading" && (
              <div className="px-6 py-5 flex flex-col gap-3">
                {(() => {
                  const opt = PROVIDER_OPTIONS.find((o) => o.value === selectedProvider)!;
                  return (
                    <>
                      <label htmlFor="api-key-input" className="text-sm font-medium text-foreground">
                        {hasKey ? `Replace ${opt.label} API key` : `Add ${opt.label} API key`}
                      </label>
                      <input
                        id="api-key-input"
                        type="password"
                        value={keyInput}
                        onChange={(e) => { setKeyInput(e.target.value); clearFeedback(); }}
                        placeholder={opt.placeholder}
                        autoComplete="off"
                        spellCheck={false}
                        autoFocus={isEditing && hasKey}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-foreground/20 font-mono"
                      />
                    </>
                  );
                })()}

                {feedback && (
                  <p className="text-sm" style={{ color: feedback.type === "success" ? "var(--color-success)" : "var(--color-error)" }}>
                    {feedback.message}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !keyInput.trim()}
                    className="text-sm font-medium bg-foreground text-surface px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving…" : "Save API key"}
                  </button>
                  {hasKey && isEditing && (
                    <button
                      onClick={() => { setIsEditing(false); setKeyInput(""); clearFeedback(); }}
                      className="text-sm text-muted px-4 py-2 rounded-lg hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isEditing && hasKey && feedback && (
              <div className="px-6 py-3">
                <p className="text-sm" style={{ color: feedback.type === "success" ? "var(--color-success)" : "var(--color-error)" }}>
                  {feedback.message}
                </p>
              </div>
            )}

            {/* Revoke */}
            {hasKey && (
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Revoke API key</p>
                  <p className="text-xs text-muted mt-0.5">
                    Removes your key from the server. AI responses will stop working.
                  </p>
                </div>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="text-sm px-4 py-2 rounded-lg hover-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0" style={{ color: "var(--color-error)", border: "1px solid var(--color-error-border)" }}
                >
                  {revoking ? "Revoking…" : "Revoke"}
                </button>
              </div>
            )}

            {/* Info box */}
            <div className="px-6 py-5">
              {(() => {
                const opt = PROVIDER_OPTIONS.find((o) => o.value === selectedProvider)!;
                return (
                  <div className="bg-background border border-border rounded-lg px-4 py-4 flex flex-col gap-2">
                    <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                      About your API key
                    </p>
                    <ul className="text-sm text-muted space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                        Get your key from{" "}
                        <a
                          href={opt.consoleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
                        >
                          {opt.consoleName}
                        </a>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                        Encrypted and stored server-side — never in your browser
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                        Only used when you trigger an AI response in a conversation
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                        You can revoke it from this page at any time
                      </li>
                    </ul>
                  </div>
                );
              })()}
            </div>
          </section>
          {/* Danger zone */}
          <section className="mt-6 bg-surface rounded-xl px-6 py-5" style={{ border: "2px solid var(--color-error-border)" }}>
            <p className="mb-4">
              <span className="text-base font-medium" style={{ color: "var(--color-error)" }}>⚠️ Danger zone</span>
              <span className="text-sm text-muted"> — Irreversible actions, proceed with care.</span>
            </p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Delete account</p>
                <p className="text-xs text-muted mt-0.5">
                  Permanently removes your account and all projects you created.
                </p>
              </div>
              <button
                onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(""); setDeleteError(null); }}
                className="text-sm px-4 py-2 rounded-lg shrink-0 transition-colors"
                style={{ color: "var(--color-error)", border: "1px solid var(--color-error-border)" }}
              >
                Delete account
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Delete confirmation modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) { setDeleteModalOpen(false); } }}
        >
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-xl">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-lg font-semibold text-foreground">Delete your account?</h2>
              <p className="text-sm text-muted">This cannot be undone. The following will be permanently deleted:</p>
              <ul className="text-sm text-muted mt-1 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                  Your account and profile
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                  All projects you created, including their conversations, messages, and files
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                  Your API key
                </li>
              </ul>
              <p className="text-sm text-muted mt-1">
                Files you uploaded to <span className="text-foreground">other people&apos;s projects</span> will remain accessible to those teams.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="delete-confirm" className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-semibold">DELETE</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(null); }}
                placeholder="DELETE"
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              {deleteError && (
                <p className="text-sm" style={{ color: "var(--color-error)" }}>{deleteError}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="text-sm px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--color-error)", color: "#fff" }}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ApiKeyStatus }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--color-success)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-success)" }} />
        API key set
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--color-error)" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-error)" }} />
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
