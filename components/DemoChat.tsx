import { Avatar } from "./Avatar";
import { TypingIndicator } from "./TypingIndicator";
import type { UserColor } from "@/lib/types";

const colorText: Record<UserColor, string> = {
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

const AI_CONFIG = {
  claude: { letter: "C", bg: "var(--color-foreground)", fg: "var(--color-surface)", name: "Claude" },
  gemini: { letter: "G", bg: "#1A73E8",                fg: "#fff",                  name: "Gemini" },
  openai: { letter: "O", bg: "#10A37F",                fg: "#fff",                  name: "ChatGPT" },
};

type UserMsg = {
  kind: "user";
  name: string;
  color: UserColor;
  isYou?: boolean;
  time: string;
  text: string;
  file?: string;
};

type AIMsg = {
  kind: "ai";
  provider: keyof typeof AI_CONFIG;
  model: string;
  time: string;
  paragraphs: string[];
};

type Msg = UserMsg | AIMsg;

interface ChatData {
  project: { emoji: string; name: string };
  document?: string;
  avatars: { name: string; color: UserColor }[];
  tokens: { name: string; color: string; pct: string }[];
  messages: Msg[];
}

const CHATS: ChatData[] = [
  // ── 0: Q3 Strategy — Gemini, document uploaded ───────────────────────────────
  {
    project: { emoji: "📊", name: "Q3 Strategy" },
    document: "Q2 Market Analysis.pdf",
    avatars: [
      { name: "Sam",    color: "amber"  },
      { name: "Jordan", color: "coral"  },
      { name: "You",    color: "purple" },
    ],
    tokens: [
      { name: "Sam",    color: "#92400E", pct: "41%" },
      { name: "Jordan", color: "#B91C1C", pct: "33%" },
      { name: "You",    color: "#7E22CE", pct: "26%" },
    ],
    messages: [
      {
        kind: "user", name: "Sam", color: "amber", time: "14:02",
        text: "Here's the Q2 market analysis. We're retaining enterprise well but losing SMBs at month 3 — churn spike lines up exactly with first invoice.",
        file: "q2_market_analysis.pdf",
      },
      {
        kind: "user", name: "Jordan", color: "coral", time: "14:05",
        text: "Matches the pipeline data. They love the demo but our onboarding is too heavyweight for small teams. They don't want to set up a workspace before they can do anything.",
      },
      {
        kind: "user", name: "You", color: "purple", isYou: true, time: "14:07",
        text: "@gemini — Sam's doc and Jordan's point both trace back to the same thing. What's the fastest GTM pivot we can make this quarter?",
      },
      {
        kind: "ai", provider: "gemini", model: "gemini-2.0-flash", time: "14:07",
        paragraphs: [
          "The data tells a clear story: your enterprise motion works, but it's too heavy for SMBs. The invoice timing isn't a pricing problem — it's a value realisation problem.",
          "Fastest pivot: a self-serve tier with a 5-minute activation path. Let them send their first message before naming anything. Sam — your retention curve shows SMBs who reach week 2 convert at roughly the same rate as enterprise. The bottleneck is week 1, and it's entirely fixable.",
        ],
      },
    ],
  },

  // ── 1: Product Redesign — Claude ─────────────────────────────────────────────
  {
    project: { emoji: "🎨", name: "Product Redesign" },
    avatars: [
      { name: "Albert", color: "blue"  },
      { name: "Marie",  color: "green" },
      { name: "You",    color: "amber" },
    ],
    tokens: [
      { name: "Albert", color: "#1D4ED8", pct: "48%" },
      { name: "Marie",  color: "#15803D", pct: "35%" },
      { name: "You",    color: "#92400E", pct: "17%" },
    ],
    messages: [
      {
        kind: "user", name: "Albert", color: "blue", time: "10:42",
        text: "I went through the drop-off data — we lose 42% of new users at the workspace setup step.",
      },
      {
        kind: "user", name: "Marie", color: "green", time: "10:44",
        text: "The 12 user interviews back that up. Most people don't understand why they need a \"workspace\" before they can send their first message.",
      },
      {
        kind: "user", name: "You", color: "amber", isYou: true, time: "10:45",
        text: "@claude — Albert and Marie just laid out the issue. What's the fastest fix we can ship this sprint?",
      },
      {
        kind: "ai", provider: "claude", model: "claude-sonnet-4-6", time: "10:45",
        paragraphs: [
          "Good context from both of you. The root issue is a concept mismatch: users expect to start messaging immediately, but hit \"workspace\" — an abstraction they have no mental model for yet.",
          "Fastest fix this sprint: rename it to \"project\" everywhere and defer naming. Let them send their first message before the setup step. Albert, this should recover a meaningful share of that 42%. Marie, it maps directly to the confusion theme across your interviews.",
        ],
      },
    ],
  },

  // ── 2: API Architecture — Claude + OpenAI, AI asks @Riley ────────────────────
  {
    project: { emoji: "⚙️", name: "API Architecture" },
    avatars: [
      { name: "Alex",  color: "blue"  },
      { name: "Riley", color: "green" },
      { name: "You",   color: "amber" },
    ],
    tokens: [
      { name: "Alex",  color: "#1D4ED8", pct: "55%" },
      { name: "You",   color: "#92400E", pct: "45%" },
    ],
    messages: [
      {
        kind: "user", name: "Alex", color: "blue", time: "16:10",
        text: "We need real-time sync for shared projects. I'm leaning WebSockets but Riley flagged a concern with the auth layer.",
      },
      {
        kind: "user", name: "Riley", color: "green", time: "16:12",
        text: "Our middleware adds ~140ms per handshake. At scale that's going to hurt WebSocket reconnect loops badly.",
      },
      {
        kind: "user", name: "You", color: "amber", isYou: true, time: "16:13",
        text: "@claude — given Riley's constraint, SSE or WebSockets?",
      },
      {
        kind: "ai", provider: "claude", model: "claude-sonnet-4-6", time: "16:13",
        paragraphs: [
          "SSE is the better fit. WebSockets re-run auth on every reconnect — your 140ms overhead stacks. SSE authenticates once per stream, so the penalty is paid once.",
          "@Riley — what's your p99 under peak load? That'll tell us whether you need a connection-pooling layer or if a single auth-once design holds.",
        ],
      },
      {
        kind: "user", name: "Riley", color: "green", time: "16:15",
        text: "p99 is ~280ms at peak. Drops to about 90ms if we skip the session token refresh on each check.",
      },
      {
        kind: "user", name: "Alex", color: "blue", time: "16:16",
        text: "@chatgpt — does that change anything?",
      },
      {
        kind: "ai", provider: "openai", model: "gpt-4o", time: "16:16",
        paragraphs: [
          "SSE still wins, but Riley's 280ms p99 means you should patch the middleware before scaling. Cache the session token for 30s and you're at 90ms — that's a clean baseline for SSE without pooling. Ship the middleware fix first, then the real-time layer.",
        ],
      },
    ],
  },
];

function renderText(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    /^@\w+$/.test(part) ? (
      <span key={i} className="font-medium" style={{ color: "#3B82F6" }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function DemoChat({ chatId = 1 }: { chatId?: 0 | 1 | 2 }) {
  const chat = CHATS[chatId];
  if (!chat) return null;

  return (
    <div className="bg-surface rounded-xl border border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0">
        <span className="text-base leading-none">{chat.project.emoji}</span>
        <span className="text-sm font-medium text-foreground">{chat.project.name}</span>
        <div className="ml-auto flex -space-x-1.5">
          {chat.avatars.map((a) => (
            <Avatar key={a.name} name={a.name} color={a.color} size="xs" className="ring-1 ring-surface" />
          ))}
        </div>
      </div>

      {/* Context bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 flex-wrap bg-background/60">
        {chat.document && (
          <>
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-60">
                <path d="M2 1h6l2 2v8H2V1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              {chat.document}
            </span>
            <span className="text-border select-none">·</span>
          </>
        )}
        <span className="text-[11px] text-muted">Context: ~2,400 tokens</span>
        <span className="text-border select-none">·</span>
        {chat.tokens.map(({ name, color, pct }) => (
          <span key={name} className="flex items-center gap-1 text-[11px] text-muted">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {name} {pct}
          </span>
        ))}
      </div>

      {/* Thread */}
      <div className="flex flex-col gap-5 p-4">
        {chat.messages.map((msg, i) => {
          if (msg.kind === "user") {
            return (
              <div key={i} className="flex gap-3">
                <Avatar name={msg.name} color={msg.color} size="sm" className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: colorText[msg.color] }}>
                      {msg.isYou ? "You" : msg.name}
                    </span>
                    <span className="text-[11px] text-muted">{msg.time}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{renderText(msg.text)}</p>
                  {msg.file && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-50 shrink-0">
                        <path d="M2 1h6l2 2v8H2V1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                      <span className="text-[11px] text-muted">{msg.file}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const ai = AI_CONFIG[msg.provider];
          return (
            <div key={i} className="flex gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold select-none"
                style={{ backgroundColor: ai.bg, color: ai.fg }}
              >
                {ai.letter}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-foreground">{ai.name}</span>
                  <span className="text-[10px] text-muted border border-border rounded px-1.5 py-px">
                    {msg.model}
                  </span>
                  <span className="text-[11px] text-muted">{msg.time}</span>
                </div>
                {msg.paragraphs.map((p, j) => (
                  <p key={j} className={`text-sm text-foreground leading-relaxed ${j > 0 ? "mt-2" : ""}`}>
                    {renderText(p)}
                  </p>
                ))}
              </div>
            </div>
          );
        })}

        <TypingIndicator />
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 border-t border-border shrink-0 mt-auto">
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2.5 border border-border">
          <Avatar name="You" color={chat.avatars.find((a) => a.name === "You")?.color ?? "blue"} size="xs" className="shrink-0" />
          <span className="text-sm text-muted/50 flex-1 select-none">Message as You…</span>
          <div className="w-6 h-6 rounded-md bg-foreground/10 flex items-center justify-center shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-muted"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
