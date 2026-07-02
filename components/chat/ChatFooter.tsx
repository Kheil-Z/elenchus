"use client";

import { useState, useRef, useEffect } from "react";
import { PROVIDER_MODELS } from "@/lib/llm";
import type { LLMProvider } from "@/lib/types/database";

interface ChatFooterProps {
  tokenCount: number;
  model: string;
  provider: LLMProvider | null;
  apiKeySet: boolean;
  onModelChange?: (model: string) => void;
}

export function ChatFooter({ tokenCount, model, provider, apiKeySet, onModelChange }: ChatFooterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const models = provider ? PROVIDER_MODELS[provider] : [];

  return (
    <div className="h-9 px-5 border-t border-border bg-surface flex items-center gap-3 shrink-0">
      {/* API key status */}
      <span className="flex items-center gap-1.5 text-[11px] text-muted">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: apiKeySet ? "#4ADE80" : "#F87171" }}
        />
        {apiKeySet ? "API key set" : (
          <>
            No API key set
            <a href="/settings" className="ml-1.5 underline underline-offset-2 hover:opacity-70 transition-opacity">
              Set one
            </a>
          </>
        )}
      </span>

      <span className="text-border select-none">·</span>

      {/* Model picker — free-text for custom endpoints, dropdown otherwise */}
      {provider === "custom" ? (
        <input
          type="text"
          value={model}
          onChange={(e) => onModelChange?.(e.target.value)}
          placeholder="model name (e.g. llama3)"
          spellCheck={false}
          className="font-mono text-[11px] text-foreground bg-transparent border-b border-border focus:border-foreground/40 focus:outline-none placeholder:text-muted/50 w-44 transition-colors"
        />
      ) : (
      <div className="relative" ref={ref}>
        <button
          onClick={() => { if (models.length > 0) setOpen((o) => !o); }}
          disabled={models.length === 0}
          className="group text-[11px] text-muted hover:text-foreground transition-colors flex items-center gap-1 disabled:cursor-default disabled:hover:text-muted"
        >
          <span className="font-mono">{model}</span>
          {models.length > 0 && (
            <svg
              width="8" height="8" viewBox="0 0 8 8" fill="none"
              className="shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
            >
              <path
                d={open ? "M1 5.5L4 2.5L7 5.5" : "M1 2.5L4 5.5L7 2.5"}
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute bottom-full left-0 mb-2 min-w-[200px] bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-20">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => { onModelChange?.(m.id); setOpen(false); }}
                className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-background transition-colors text-left"
              >
                <div className="w-3 shrink-0 flex items-center justify-center">
                  {m.id === model && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4L3.5 6L6.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs ${m.id === model ? "font-medium text-foreground" : "text-foreground"}`}>
                    {m.name}
                  </span>
                  <span className="text-[10px] text-muted font-mono">{m.id}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      <span className="text-border select-none">·</span>

      <span className="text-[11px] text-muted">
        ~{tokenCount.toLocaleString()} tokens in context
      </span>
    </div>
  );
}
