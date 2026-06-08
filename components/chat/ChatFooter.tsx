interface ChatFooterProps {
  tokenCount: number;
  model: string;
  apiKeySet: boolean;
}

export function ChatFooter({ tokenCount, model, apiKeySet }: ChatFooterProps) {
  return (
    <div className="h-9 px-5 border-t border-border bg-surface flex items-center gap-3 shrink-0">
      <span className="flex items-center gap-1.5 text-[11px] text-muted">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: apiKeySet ? "#4ADE80" : "#F87171" }}
        />
        {apiKeySet ? "API key set" : "No API key — set one to send"}
      </span>

      <span className="text-border select-none">·</span>
      <span className="text-[11px] text-muted">{model}</span>

      <span className="text-border select-none">·</span>
      <span className="text-[11px] text-muted">
        ~{tokenCount.toLocaleString()} tokens in context
      </span>
    </div>
  );
}
