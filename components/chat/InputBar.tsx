"use client";

import { useState, useRef, useMemo } from "react";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

const sendColor: Record<UserColor, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  purple: "#A855F7",
  coral:  "#F87171",
  amber:  "#F59E0B",
  teal:   "#14B8A6",
  rose:   "#EC4899",
  orange: "#F97316",
  indigo: "#6366F1",
  sky:    "#0EA5E9",
  lime:   "#84CC16",
};

interface Member {
  name: string;
  color: UserColor;
}

interface InputBarProps {
  currentUser: { name: string; color: UserColor };
  members?: Member[];
  apiKeyStatus?: "active" | "not_set" | "error";
  onSend?: (msg: string, files: File[]) => Promise<void>;
  sending?: boolean;
  aiMention?: string;
  aiName?: string;
}

type MentionOption =
  | { key: string; type: "ai";   label: string; mention: string }
  | { key: string; type: "user"; label: string; mention: string; color: UserColor }
  | { key: string; type: "all";  label: string; mention: string };

export function InputBar({ currentUser, members = [], apiKeyStatus, onSend, sending, aiMention = "@claude", aiName = "Claude" }: InputBarProps) {
  const [value, setValue]               = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<Member | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx]     = useState(0);

  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
  const mentionStart   = useRef(0);

  const firstName = (name: string) => name.split(" ")[0];
  const others    = members.filter((m) => m.name !== currentUser.name);

  // All possible @ options
  const allOptions = useMemo<MentionOption[]>(() => [
    { key: "ai",  type: "ai",  label: aiName,  mention: aiMention },
    ...others.map((m) => ({
      key:     m.name,
      type:    "user" as const,
      label:   firstName(m.name) ?? m.name,
      mention: `@${firstName(m.name) ?? m.name}`,
      color:   m.color,
    })),
    { key: "all", type: "all", label: "all", mention: "@all" },
  ], [aiName, aiMention, others]);

  const filteredOptions = useMemo(() =>
    mentionQuery === null
      ? []
      : allOptions.filter((o) =>
          mentionQuery === "" || o.label.toLowerCase().startsWith(mentionQuery.toLowerCase())
        ),
    [mentionQuery, allOptions]
  );

  // ── Mention insertion ──────────────────────────────────────────────────────

  function insertMention(mention: string) {
    const el = textareaRef.current;
    if (!el || mentionQuery === null) return;
    const before   = value.slice(0, mentionStart.current);
    const after    = value.slice(mentionStart.current + 1 + mentionQuery.length);
    const newValue = `${before}${mention} ${after}`;
    setValue(newValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = mentionStart.current + mention.length + 1;
      el.setSelectionRange(pos, pos);
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    });
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  function applyFormat(type: "bold" | "italic" | "list") {
    const el = textareaRef.current;
    if (!el) return;
    const start  = el.selectionStart;
    const end    = el.selectionEnd;
    const before   = value.slice(0, start);
    const selected = value.slice(start, end);
    const after    = value.slice(end);

    if (type === "bold") {
      const inner = selected || "bold text";
      setValue(`${before}**${inner}**${after}`);
      requestAnimationFrame(() => { el.selectionStart = start + 2; el.selectionEnd = start + 2 + inner.length; el.focus(); });
    } else if (type === "italic") {
      const inner = selected || "italic text";
      setValue(`${before}*${inner}*${after}`);
      requestAnimationFrame(() => { el.selectionStart = start + 1; el.selectionEnd = start + 1 + inner.length; el.focus(); });
    } else if (type === "list") {
      const lineStart = before.lastIndexOf("\n") + 1;
      if (value.slice(lineStart).startsWith("- ")) {
        setValue(value.slice(0, lineStart) + value.slice(lineStart + 2));
        requestAnimationFrame(() => { el.selectionStart = Math.max(lineStart, start - 2); el.selectionEnd = Math.max(lineStart, end - 2); el.focus(); });
      } else {
        setValue(value.slice(0, lineStart) + "- " + value.slice(lineStart));
        requestAnimationFrame(() => { el.selectionStart = start + 2; el.selectionEnd = end + 2; el.focus(); });
      }
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    setValue(newValue);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";

    // Detect active @ mention session
    const cursor = el.selectionStart ?? newValue.length;
    const before = newValue.slice(0, cursor);
    const match  = before.match(/@(\w*)$/);
    if (match) {
      mentionStart.current = cursor - match[0].length;
      setMentionQuery(match[1] ?? "");
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Mention navigation takes priority
    if (mentionQuery !== null && filteredOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => (i + 1) % filteredOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => (i - 1 + filteredOptions.length) % filteredOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredOptions[mentionIdx]?.mention ?? "");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend || sending) return;
      await doSend();
    }
  }

  async function doSend() {
    const msg   = value.trim();
    const files = attachedFiles;
    setValue("");
    setAttachedFiles([]);
    setSelectedDelegate(null);
    setMentionQuery(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (onSend && (msg || files.length > 0)) await onSend(msg, files);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function selectDelegate(member: Member | null) {
    setSelectedDelegate(member);
    setDelegateOpen(false);
  }

  const hasAiMention = value.toLowerCase().includes(aiMention.toLowerCase());
  const canSend = value.trim().length > 0 || attachedFiles.length > 0;

  return (
    <div className="border-t border-border bg-surface shrink-0">
    <div className="px-5 pt-3 pb-2 max-w-3xl mx-auto">

      {/* Delegation hint */}
      {selectedDelegate && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <Avatar name={selectedDelegate.name} color={selectedDelegate.color} size="xs" />
          <span>
            <span className="font-medium text-foreground">{firstName(selectedDelegate.name)}</span>
            &apos;s key will be used for this call
          </span>
          <button
            onClick={() => setSelectedDelegate(null)}
            className="ml-auto text-muted/60 hover:text-foreground transition-colors"
            aria-label="Cancel delegation"
          >
            ×
          </button>
        </div>
      )}

      {/* AI mention hint */}
      {hasAiMention && !selectedDelegate && (
        <div className="mb-2 flex items-center gap-1.5 text-xs">
          {apiKeyStatus === "not_set" || apiKeyStatus === "error" ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
              <span className="text-amber-700">
                No API key set —{" "}
                <a href="/settings" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
                  add one in settings
                </a>
              </span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block shrink-0" />
              <span className="text-muted">API key set · {aiName} will respond using your key</span>
            </>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="relative bg-background rounded-xl border border-border focus-within:border-foreground/20 transition-colors">

        {/* @ mention dropdown */}
        {mentionQuery !== null && filteredOptions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-52 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20">
            {filteredOptions.map((opt, i) => (
              <button
                key={opt.key}
                onMouseDown={(e) => { e.preventDefault(); insertMention(opt.mention); }}
                className="w-full px-3 py-2 flex items-center gap-2.5 text-xs text-left transition-colors"
                style={{ backgroundColor: i === mentionIdx ? "var(--color-background)" : undefined }}
              >
                {opt.type === "ai" && (
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                    style={{ backgroundColor: "var(--color-foreground)", color: "var(--color-background)" }}
                  >
                    AI
                  </span>
                )}
                {opt.type === "user" && (
                  <Avatar name={opt.label} color={opt.color} size="xs" />
                )}
                {opt.type === "all" && (
                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-border text-muted text-[9px]">
                    ∀
                  </span>
                )}
                <span className="text-foreground font-medium">{opt.mention}</span>
                <span className="text-muted ml-auto">
                  {opt.type === "ai"   && aiName}
                  {opt.type === "user" && "mention"}
                  {opt.type === "all"  && "everyone"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Attached file chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1">
            {attachedFiles.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-surface border border-border rounded-md px-2 py-1 text-xs text-foreground"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0 text-muted">
                  <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="3" y1="4" x2="8" y2="4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <line x1="3" y1="6" x2="7" y2="6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                <span className="max-w-[120px] truncate">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted hover:text-foreground transition-colors ml-0.5 leading-none"
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-3 px-3 py-2.5">
          <Avatar name={currentUser.name} color={currentUser.color} size="sm" className="shrink-0 mb-0.5" />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder={`Message as ${firstName(currentUser.name)}…`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted/40 focus:outline-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: "22px", maxHeight: "180px" }}
          />

          {/* Attach */}
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-border/60 transition-colors text-muted hover:text-foreground mb-0.5"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M11.5 5.8L6.3 11C5.3 12 3.7 12 2.7 11C1.7 10 1.7 8.4 2.7 7.4L7.9 2.2C8.5 1.6 9.5 1.6 10.1 2.2C10.7 2.8 10.7 3.8 10.1 4.4L5.2 9.3C4.9 9.6 4.5 9.6 4.2 9.3C3.9 9 3.9 8.6 4.2 8.3L8.8 3.7"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Split send button */}
          <div className="relative flex items-stretch shrink-0 mb-0.5">
            <button
              disabled={!canSend || sending}
              onClick={async () => { if (!canSend || sending) return; await doSend(); }}
              className="w-7 h-8 rounded-l-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: sendColor[currentUser.color] }}
              aria-label="Send"
            >
              {sending ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                  <path d="M6 2a4 4 0 0 1 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : selectedDelegate ? (
                <Avatar name={selectedDelegate.name} color={selectedDelegate.color} size="xs" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 10V2M2 6l4-4 4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            {/* Chevron */}
            <button
              onClick={() => setDelegateOpen((o) => !o)}
              aria-label="Choose who runs this call"
              className="w-5 h-8 rounded-r-lg flex items-center justify-center transition-all"
              style={{
                backgroundColor: sendColor[currentUser.color],
                borderLeft: "1px solid rgba(255,255,255,0.25)",
                opacity: canSend ? 1 : 0.3,
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path
                  d={delegateOpen ? "M1 5.5L4 2.5L7 5.5" : "M1 2.5L4 5.5L7 2.5"}
                  stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Delegation dropdown */}
            {delegateOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-10">
                <button
                  onClick={() => selectDelegate(null)}
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 text-xs hover:bg-background transition-colors text-left"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: sendColor[currentUser.color] }}
                  >
                    {selectedDelegate === null && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={selectedDelegate === null ? "font-medium text-foreground" : "text-muted"}>
                    Use my key
                  </span>
                </button>

                {others.length > 0 && (
                  <div className="border-t border-border">
                    {others.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => selectDelegate(m)}
                        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-xs hover:bg-background transition-colors text-left"
                      >
                        <Avatar name={m.name} color={m.color} size="xs" />
                        <span className={selectedDelegate?.name === m.name ? "font-medium text-foreground" : "text-muted"}>
                          Ask {firstName(m.name)} to run this
                        </span>
                        {selectedDelegate?.name === m.name && (
                          <svg className="ml-auto shrink-0" width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3.5 6L6.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 px-3 pb-2 pt-0.5 border-t border-border/40">
          {([
            { type: "bold"   as const, title: "Bold",        node: <span className="text-[11px] font-bold leading-none">B</span> },
            { type: "italic" as const, title: "Italic",      node: <span className="text-[12px] italic font-serif leading-none">I</span> },
            { type: "list"   as const, title: "Bullet list", node: (
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <circle cx="1.5" cy="2.5" r="1" fill="currentColor" />
                <line x1="4" y1="2.5" x2="10" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="1.5" cy="5.5" r="1" fill="currentColor" />
                <line x1="4" y1="5.5" x2="10" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="1.5" cy="8.5" r="1" fill="currentColor" />
                <line x1="4" y1="8.5" x2="10" y2="8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )},
          ] as const).map(({ type, title, node }) => (
            <button
              key={type}
              onMouseDown={(e) => { e.preventDefault(); applyFormat(type); }}
              title={title}
              className="w-6 h-6 flex items-center justify-center rounded text-muted/40 hover:text-muted hover:bg-border/60 transition-colors"
            >
              {node}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row: hint + quick actions */}
      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-muted/40">
          Enter to send · Shift+Enter for new line · @ to mention
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setValue(`${aiMention} weigh in on this discussion`); textareaRef.current?.focus(); }}
            className="text-[10px] text-muted hover:text-foreground border border-border hover:border-foreground/20 rounded-md px-2 py-1 transition-colors"
          >
            Weigh in
          </button>
          <button
            onClick={() => { setValue(`${aiMention} summarize the conversation so far`); textareaRef.current?.focus(); }}
            className="text-[10px] text-muted hover:text-foreground border border-border hover:border-foreground/20 rounded-md px-2 py-1 transition-colors"
          >
            Summarize
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
