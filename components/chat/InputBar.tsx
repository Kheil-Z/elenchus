"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/components/Avatar";
import type { UserColor } from "@/lib/types";

const sendColor: Record<UserColor, string> = {
  blue:   "#3B82F6",
  green:  "#22C55E",
  purple: "#A855F7",
  coral:  "#F87171",
  amber:  "#F59E0B",
};

interface Member {
  name: string;
  color: UserColor;
}

interface InputBarProps {
  currentUser: { name: string; color: UserColor };
  members?: Member[];
}

export function InputBar({ currentUser, members = [] }: InputBarProps) {
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [selectedDelegate, setSelectedDelegate] = useState<Member | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasClaudeMention = value.includes("@claude");
  const canSend = value.trim().length > 0 || attachedFiles.length > 0;
  const others = members.filter((m) => m.name !== currentUser.name);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend) return;
      setValue("");
      setAttachedFiles([]);
      setSelectedDelegate(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
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

  const firstName = (name: string) => name.split(" ")[0];

  return (
    <div className="px-5 pt-3 pb-2 border-t border-border bg-surface shrink-0">

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

      {/* Claude mention hint */}
      {hasClaudeMention && !selectedDelegate && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0" />
          Claude will respond using your API key
        </div>
      )}

      {/* Composer */}
      <div className="bg-background rounded-xl border border-border focus-within:border-foreground/20 transition-colors">

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
          <Avatar
            name={currentUser.name}
            color={currentUser.color}
            size="sm"
            className="shrink-0 mb-0.5"
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message as ${firstName(currentUser.name)}…`}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-foreground placeholder:text-muted/40 focus:outline-none leading-relaxed"
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
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* Split send button */}
          <div className="relative flex items-stretch shrink-0 mb-0.5">
            {/* Main send */}
            <button
              disabled={!canSend}
              className="w-7 h-8 rounded-l-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ backgroundColor: sendColor[currentUser.color] }}
              aria-label="Send"
            >
              {selectedDelegate ? (
                <Avatar name={selectedDelegate.name} color={selectedDelegate.color} size="xs" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 10V2M2 6l4-4 4 4"
                    stroke="white"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
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
                  stroke="white"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
      </div>

      {/* Bottom row: hint + quick actions */}
      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-muted/40">
          Enter to send · Shift+Enter for new line · @claude to call Claude
        </p>
        <div className="flex items-center gap-1.5">
          <button className="text-[10px] text-muted hover:text-foreground border border-border hover:border-foreground/20 rounded-md px-2 py-1 transition-colors">
            Weigh in
          </button>
          <button className="text-[10px] text-muted hover:text-foreground border border-border hover:border-foreground/20 rounded-md px-2 py-1 transition-colors">
            Summarize
          </button>
        </div>
      </div>
    </div>
  );
}
