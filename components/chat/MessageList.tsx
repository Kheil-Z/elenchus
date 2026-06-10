"use client";

import { useRef, useEffect, useState } from "react";
import type { ChatMessage, ContentSegment } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { DocPreviewModal } from "@/components/DocPreviewModal";

// ── Color tints per user ──────────────────────────────────────────────────────

const bubbleTint: Record<UserColor, { bg: string; border: string }> = {
  blue:   { bg: "#EFF6FF", border: "#DBEAFE" },
  green:  { bg: "#F0FDF4", border: "#DCFCE7" },
  purple: { bg: "#FAF5FF", border: "#F3E8FF" },
  coral:  { bg: "#FFF1F2", border: "#FFE4E6" },
  amber:  { bg: "#FFFBEB", border: "#FEF3C7" },
};

const nameColor: Record<UserColor, string> = {
  blue:   "#1D4ED8",
  green:  "#15803D",
  purple: "#7E22CE",
  coral:  "#B91C1C",
  amber:  "#92400E",
};

// ── Document chip ─────────────────────────────────────────────────────────────

function DocChip({
  id, filename, uploader, sizeBytes, mimeType, createdAt, onPreview,
}: {
  id?: string; filename: string; uploader?: string;
  sizeBytes?: number; mimeType?: string | null; createdAt?: string;
  onPreview?: (seg: DocPreviewArg) => void;
}) {
  const canPreview = !!id && !!onPreview;
  const inner = (
    <>
      <span aria-hidden>📄</span>
      <span className="font-medium">{filename}</span>
      {uploader && <span className="text-muted">· {uploader}</span>}
    </>
  );

  if (canPreview && onPreview) {
    return (
      <button
        onClick={() => onPreview({ id: id!, filename, uploader, sizeBytes, mimeType: mimeType ?? null, createdAt })}
        className="inline-flex items-center gap-1 bg-surface border border-border rounded-md px-1.5 py-px text-xs text-foreground mx-0.5 align-middle whitespace-nowrap hover:border-foreground/20 hover:bg-background transition-colors cursor-pointer"
        title="Click to preview"
      >
        {inner}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 bg-surface border border-border rounded-md px-1.5 py-px text-xs text-foreground mx-0.5 align-middle whitespace-nowrap">
      {inner}
    </span>
  );
}

// ── Inline token renderer (**bold**, @mentions, plain text) ──────────────────

function renderInline(token: string, key: string): React.ReactNode {
  if (/^\*\*[^*]+\*\*$/.test(token)) return <strong key={key}>{token.slice(2, -2)}</strong>;
  if (/^@[A-Za-z]+$/.test(token)) {
    if (token.toLowerCase() === "@claude")
      return (
        <span
          key={key}
          className="inline-flex items-center bg-blue-100 text-blue-700 font-semibold rounded-md px-1.5 py-0.5 text-[0.82em] mx-0.5 align-baseline"
        >
          {token}
        </span>
      );
    return (
      <span
        key={key}
        className="font-medium rounded px-1 py-0.5 align-baseline"
        style={{ backgroundColor: "rgba(0,0,0,0.05)", color: "inherit" }}
      >
        {token}
      </span>
    );
  }
  return token;
}

// ── Segment renderer — builds paragraphs, keeping doc chips inline ────────────

type DocPreviewArg = { id: string; filename: string; uploader?: string; sizeBytes?: number; mimeType?: string | null; createdAt?: string };

function renderSegments(segments: ContentSegment[], onDocPreview?: (doc: DocPreviewArg) => void) {
  // Each paragraph is an array of inline React nodes (text tokens + doc chips).
  const paragraphs: React.ReactNode[][] = [[]];

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (!seg) continue;

    if (seg.type === "doc") {
      paragraphs[paragraphs.length - 1]!.push(
        <DocChip
          key={`doc-${si}`}
          id={seg.id}
          filename={seg.filename}
          uploader={seg.uploader}
          sizeBytes={seg.sizeBytes}
          mimeType={seg.mimeType}
          createdAt={seg.createdAt}
          onPreview={onDocPreview}
        />
      );
    } else {
      const paras = seg.text.split("\n\n");
      paras.forEach((para, pi) => {
        if (pi > 0) paragraphs.push([]);
        const tokens = para.split(/(\*\*[^*]+\*\*|@[A-Za-z]+)/g);
        tokens.forEach((tok, ti) => {
          paragraphs[paragraphs.length - 1]!.push(renderInline(tok, `${si}-${pi}-${ti}`));
        });
      });
    }
  }

  return paragraphs.map((nodes, idx) => (
    <p key={idx} className={idx > 0 ? "mt-3" : ""}>
      {nodes}
    </p>
  ));
}

// ── Individual message ────────────────────────────────────────────────────────

function MessageBubble({ msg, isYou, onDocPreview }: { msg: ChatMessage; isYou: boolean; onDocPreview?: (doc: DocPreviewArg) => void }) {
  const isAssistant = msg.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex flex-row-reverse gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold select-none"
          style={{ backgroundColor: "#E8E5E0", color: "#6b6b6b" }}
        >
          Cl
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-row-reverse items-baseline gap-2 mb-2">
            <span className="text-[13px] font-semibold text-foreground">Claude</span>
            {msg.modelUsed && (
              <span className="text-[10px] text-muted border border-border rounded px-1.5 py-px">
                {msg.modelUsed}
              </span>
            )}
            <span className="text-[11px] text-muted">{msg.timestamp}</span>
            {msg.inputTokens && msg.outputTokens && (
              <span className="text-[10px] text-muted/60 mr-auto">
                {msg.inputTokens.toLocaleString()} in · {msg.outputTokens} out
              </span>
            )}
          </div>
          <div
            className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed text-foreground"
            style={{ backgroundColor: "#F1F0EE", border: "1px solid #E2E0DC" }}
          >
            {renderSegments(msg.segments, onDocPreview)}
          </div>
        </div>
      </div>
    );
  }

  const color = msg.authorColor!;
  const tint = bubbleTint[color];

  return (
    <div className="flex gap-3">
      <Avatar name={msg.authorName} color={color} size="sm" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[13px] font-semibold" style={{ color: nameColor[color] }}>
            {isYou ? "You" : msg.authorName}
          </span>
          <span className="text-[11px] text-muted">{msg.timestamp}</span>
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-foreground"
          style={{ backgroundColor: tint.bg, border: `1px solid ${tint.border}` }}
        >
          {renderSegments(msg.segments, onDocPreview)}
        </div>
      </div>
    </div>
  );
}

// ── Message list ──────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[];
  currentUserName?: string;
  loading?: boolean;
  sending?: boolean;
}

export function MessageList({ messages, currentUserName, loading, sending }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [docPreview, setDocPreview] = useState<DocPreviewArg | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <>
    {docPreview && (
      <DocPreviewModal
        id={docPreview.id}
        name={docPreview.filename}
        sizeBytes={docPreview.sizeBytes}
        mimeType={docPreview.mimeType}
        uploaderName={docPreview.uploader}
        createdAt={docPreview.createdAt}
        onClose={() => setDocPreview(null)}
      />
    )}
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-6 py-6 max-w-3xl mx-auto">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isYou={msg.authorName === currentUserName} onDocPreview={setDocPreview} />
        ))}
        {sending && (
          <div className="flex flex-row-reverse gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold select-none"
              style={{ backgroundColor: "#E8E5E0", color: "#6b6b6b" }}
            >
              Cl
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-row-reverse items-baseline gap-2 mb-2">
                <span className="text-[13px] font-semibold text-foreground">Claude</span>
              </div>
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-muted w-fit"
                style={{ backgroundColor: "#F1F0EE", border: "1px solid #E2E0DC" }}
              >
                <span className="animate-pulse">Thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
    </>
  );
}
