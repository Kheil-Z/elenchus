"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { PROJECT_EMOJIS } from "@/lib/types";

const EMOJIS = PROJECT_EMOJIS;

function randomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)] ?? "📁";
}

interface NewProjectModalProps {
  onClose: () => void;
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [emoji, setEmoji] = useState(randomEmoji);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleCreate() {
    if (!name.trim() || !user || creating) return;
    setCreating(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Not authenticated"); setCreating(false); return; }

    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, emoji }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to create project");
        setCreating(false);
        return;
      }
      onClose();
      router.push(`/project/${json.projectId}`);
    } catch {
      setError("Network error — please try again");
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-serif text-lg text-foreground tracking-tight">New project</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 flex flex-col gap-4">
          {/* Emoji + Name row */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <button
                onClick={() => setEmojiPickerOpen((o) => !o)}
                className="w-12 h-12 rounded-xl border border-border bg-background flex items-center justify-center text-2xl hover:border-foreground/20 transition-colors"
                title="Change emoji"
              >
                {emoji}
              </button>
              {emojiPickerOpen && (
                <div className="absolute top-full left-0 mt-1.5 bg-surface border border-border rounded-xl shadow-lg p-2 grid grid-cols-8 gap-1 z-10 w-[220px]">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(e); setEmojiPickerOpen(false); }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-base hover:bg-background transition-colors ${e === emoji ? "ring-1 ring-foreground/30" : ""}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleCreate(); }}
              placeholder="Project name…"
              maxLength={80}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-foreground/25 transition-colors"
            />
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
            maxLength={280}
            className="bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-foreground/25 transition-colors resize-none leading-relaxed"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 text-sm text-muted border border-border rounded-xl py-2.5 hover:bg-background hover:border-foreground/20 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="flex-1 text-sm font-medium text-surface rounded-xl py-2.5 transition-all disabled:opacity-40"
              style={{ backgroundColor: "var(--color-foreground)" }}
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
