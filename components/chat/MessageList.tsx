"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";
import { MarkdownHooks as Markdown } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ContentSegment } from "@/lib/chat-types";
import type { UserColor } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { DocPreviewModal } from "@/components/DocPreviewModal";

// ── Dark-mode detection ───────────────────────────────────────────────────────

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ── Color tints per user ──────────────────────────────────────────────────────

const bubbleTintLight: Record<UserColor, { bg: string; border: string }> = {
  blue:   { bg: "#EFF6FF", border: "#DBEAFE" },
  green:  { bg: "#F0FDF4", border: "#DCFCE7" },
  purple: { bg: "#FAF5FF", border: "#F3E8FF" },
  coral:  { bg: "#FFF1F2", border: "#FFE4E6" },
  amber:  { bg: "#FFFBEB", border: "#FEF3C7" },
  teal:   { bg: "#F0FDFA", border: "#CCFBF1" },
  rose:   { bg: "#FDF2F8", border: "#FCE7F3" },
  orange: { bg: "#FFF7ED", border: "#FFEDD5" },
  indigo: { bg: "#EEF2FF", border: "#E0E7FF" },
  sky:    { bg: "#F0F9FF", border: "#E0F2FE" },
  lime:   { bg: "#F7FEE7", border: "#ECFCCB" },
};

const bubbleTintDark: Record<UserColor, { bg: string; border: string }> = {
  blue:   { bg: "rgba(59, 130, 246, 0.12)",  border: "rgba(59, 130, 246, 0.22)" },
  green:  { bg: "rgba(34, 197, 94, 0.12)",   border: "rgba(34, 197, 94, 0.22)" },
  purple: { bg: "rgba(168, 85, 247, 0.12)",  border: "rgba(168, 85, 247, 0.22)" },
  coral:  { bg: "rgba(248, 113, 113, 0.12)", border: "rgba(248, 113, 113, 0.22)" },
  amber:  { bg: "rgba(245, 158, 11, 0.12)",  border: "rgba(245, 158, 11, 0.22)" },
  teal:   { bg: "rgba(20, 184, 166, 0.12)",  border: "rgba(20, 184, 166, 0.22)" },
  rose:   { bg: "rgba(236, 72, 153, 0.12)",  border: "rgba(236, 72, 153, 0.22)" },
  orange: { bg: "rgba(249, 115, 22, 0.12)",  border: "rgba(249, 115, 22, 0.22)" },
  indigo: { bg: "rgba(99, 102, 241, 0.12)",  border: "rgba(99, 102, 241, 0.22)" },
  sky:    { bg: "rgba(14, 165, 233, 0.12)",  border: "rgba(14, 165, 233, 0.22)" },
  lime:   { bg: "rgba(132, 204, 22, 0.12)",  border: "rgba(132, 204, 22, 0.22)" },
};

const nameColorLight: Record<UserColor, string> = {
  blue:   "#1D4ED8",
  green:  "#15803D",
  purple: "#7E22CE",
  coral:  "#B91C1C",
  amber:  "#92400E",
  teal:   "#0F766E",
  rose:   "#9D174D",
  orange: "#C2410C",
  indigo: "#4338CA",
  sky:    "#0369A1",
  lime:   "#3F6212",
};

const nameColorDark: Record<UserColor, string> = {
  blue:   "#93C5FD",
  green:  "#86EFAC",
  purple: "#D8B4FE",
  coral:  "#FCA5A5",
  amber:  "#FCD34D",
  teal:   "#5EEAD4",
  rose:   "#FBCFE8",
  orange: "#FDBA74",
  indigo: "#C7D2FE",
  sky:    "#BAE6FD",
  lime:   "#D9F99D",
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

function renderInline(token: string, key: string): ReactNode {
  if (/^\*\*[^*]+\*\*$/.test(token)) return <strong key={key}>{token.slice(2, -2)}</strong>;
  if (/^@[A-Za-z]+$/.test(token)) {
    if (token.toLowerCase() === "@claude")
      return (
        <span
          key={key}
          className="inline-flex items-center font-semibold rounded-md px-1.5 py-0.5 text-[0.82em] mx-0.5 align-baseline"
          style={{ backgroundColor: "color-mix(in oklch, var(--color-user-blue) 15%, transparent)", color: "var(--color-user-blue)" }}
        >
          {token}
        </span>
      );
    return (
      <span
        key={key}
        className="font-medium rounded px-1 py-0.5 align-baseline"
        style={{ backgroundColor: "color-mix(in oklch, var(--color-foreground) 8%, transparent)", color: "inherit" }}
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

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:          ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        h1:         ({ children }) => <h1 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h1>,
        h2:         ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>,
        h3:         ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h3>,
        ul:         ({ children }) => <ul className="list-disc list-outside pl-4 mb-3 last:mb-0 space-y-1">{children}</ul>,
        ol:         ({ children }) => <ol className="list-decimal list-outside pl-4 mb-3 last:mb-0 space-y-1">{children}</ol>,
        li:         ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
        em:         ({ children }) => <em className="italic">{children}</em>,
        hr:         ()             => <hr className="border-t border-border my-3" />,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-foreground/20 pl-3 text-muted italic mb-3 last:mb-0">{children}</blockquote>,
        a:          ({ href, children }) => (
          <a href={href ?? "#"} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-70 transition-opacity">
            {children}
          </a>
        ),
        pre: ({ children }) => (
          <pre
            className="rounded-lg px-3 py-2.5 overflow-x-auto text-xs font-mono my-3 whitespace-pre"
            style={{ backgroundColor: "color-mix(in oklch, var(--color-foreground) 6%, transparent)", border: "1px solid var(--color-border)" }}
          >
            {children}
          </pre>
        ),
        code: ({ className, children }) => {
          if (className?.startsWith("language-") || String(children).includes("\n")) {
            return <code className={className}>{children}</code>;
          }
          return (
            <code
              className="rounded px-1 py-0.5 text-[0.85em] font-mono"
              style={{ backgroundColor: "color-mix(in oklch, var(--color-foreground) 8%, transparent)" }}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
}

function MessageBubble({ msg, isYou, dark, onDocPreview }: { msg: ChatMessage; isYou: boolean; dark: boolean; onDocPreview?: (doc: DocPreviewArg) => void }) {
  const isAssistant = msg.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex flex-row-reverse gap-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold select-none"
          style={{ backgroundColor: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          {msg.authorName.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-row-reverse items-baseline gap-2 mb-2">
            <span className="text-[13px] font-semibold text-foreground">{msg.authorName}</span>
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
            className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-foreground"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <MarkdownContent
              content={msg.segments
                .filter((s): s is { type: "text"; text: string } => s.type === "text")
                .map((s) => s.text)
                .join("")}
            />
          </div>
        </div>
      </div>
    );
  }

  const color = msg.authorColor!;
  const tint = dark ? bubbleTintDark[color] : bubbleTintLight[color];
  const nameCol = dark ? nameColorDark[color] : nameColorLight[color];

  return (
    <div className="flex gap-3">
      <Avatar name={msg.authorName} color={color} size="sm" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[13px] font-semibold" style={{ color: nameCol }}>
            {isYou ? "You" : msg.authorName}
          </span>
          <span className="text-[11px] text-muted">{msg.timestamp}</span>
        </div>
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground"
          style={{ backgroundColor: tint.bg, border: `1px solid ${tint.border}` }}
        >
          {msg.segments.some((s) => s.type === "doc")
            ? renderSegments(msg.segments, onDocPreview)
            : <MarkdownContent content={msg.segments.filter((s): s is { type: "text"; text: string } => s.type === "text").map((s) => s.text).join("")} />}
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
  mentionsOnly?: boolean;
  aiName?: string;
}

function messageContainsMention(msg: ChatMessage, name: string): boolean {
  const lower = name.toLowerCase();
  return msg.segments.some(
    (seg) => seg.type === "text" && seg.text.toLowerCase().includes(`@${lower}`)
  );
}

export function MessageList({ messages, currentUserName, loading, sending, mentionsOnly, aiName = "AI" }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [docPreview, setDocPreview] = useState<DocPreviewArg | null>(null);
  const dark = useDarkMode();

  const visibleMessages =
    mentionsOnly && currentUserName
      ? messages.filter((m) => messageContainsMention(m, currentUserName))
      : messages;

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
        {mentionsOnly && visibleMessages.length === 0 && !sending && (
          <p className="text-sm text-muted text-center py-8">No messages mentioning you yet.</p>
        )}
        {visibleMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} isYou={msg.authorName === currentUserName} dark={dark} onDocPreview={setDocPreview} />
        ))}
        {sending && (
          <div className="flex flex-row-reverse gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold select-none"
              style={{ backgroundColor: "var(--color-surface)", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
            >
              {aiName.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-row-reverse items-baseline gap-2 mb-2">
                <span className="text-[13px] font-semibold text-foreground">{aiName}</span>
              </div>
              <div
                className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-muted w-fit"
                style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
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
