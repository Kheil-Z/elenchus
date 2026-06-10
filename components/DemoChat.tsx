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

type UserMsg = {
  kind: "user";
  name: string;
  color: UserColor;
  isYou?: boolean;
  time: string;
  text: string;
};

type ClaudeMsg = {
  kind: "claude";
  model: string;
  time: string;
  paragraphs: string[];
};

type Msg = UserMsg | ClaudeMsg;

const MESSAGES: Msg[] = [
  {
    kind: "user",
    name: "Albert",
    color: "blue",
    time: "10:42",
    text: "I went through the drop-off data — we lose 42% of new users at the workspace setup step.",
  },
  {
    kind: "user",
    name: "Marie",
    color: "green",
    time: "10:44",
    text: 'The 12 user interviews back that up. Most people don\'t understand why they need a "workspace" before they can send their first message.',
  },
  {
    kind: "user",
    name: "You",
    color: "amber",
    isYou: true,
    time: "10:45",
    text: "@claude — Albert and Marie just laid out the issue. What's the fastest fix we can ship this sprint?",
  },
  {
    kind: "claude",
    model: "claude-sonnet-4-6",
    time: "10:45",
    paragraphs: [
      "Good context from both of you. The root issue is a concept mismatch: users expect to start messaging immediately, but hit \"workspace\" — an abstraction they have no mental model for yet.",
      "Fastest fix this sprint: rename it to \"project\" everywhere and defer naming. Let them send their first message before the setup step. Albert, this should recover a meaningful share of that 42%. Marie, it maps directly to the confusion theme across your interviews.",
    ],
  },
];

function renderText(text: string) {
  return text.split(/(@claude)/gi).map((part, i) =>
    /^@claude$/i.test(part) ? (
      <span key={i} className="font-medium" style={{ color: "#3B82F6" }}>
        {part}
      </span>
    ) : (
      part
    )
  );
}

export function DemoChat() {
  return (
    <div className="bg-surface rounded-xl border border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5 shrink-0">
        <span className="text-base leading-none">🎨</span>
        <span className="text-sm font-medium text-foreground">Product Redesign</span>
        <div className="ml-auto flex -space-x-1.5">
          <Avatar name="Albert" color="blue"  size="xs" className="ring-1 ring-surface" />
          <Avatar name="Marie"  color="green" size="xs" className="ring-1 ring-surface" />
          <Avatar name="You"    color="amber" size="xs" className="ring-1 ring-surface" />
        </div>
      </div>

      {/* Token context bar */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 flex-wrap bg-background/60">
        <span className="text-[11px] text-muted">Context: ~2,400 tokens</span>
        <span className="text-border select-none">·</span>
        {[
          { name: "Albert", color: "#1D4ED8", pct: "48%" },
          { name: "Marie",  color: "#15803D", pct: "35%" },
          { name: "You",    color: "#92400E", pct: "17%" },
        ].map(({ name, color, pct }) => (
          <span key={name} className="flex items-center gap-1 text-[11px] text-muted">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {name} {pct}
          </span>
        ))}
      </div>

      {/* Thread */}
      <div className="flex flex-col gap-5 p-4">
        {MESSAGES.map((msg, i) => {
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
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-surface select-none">
                C
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-foreground">Claude</span>
                  <span className="text-[10px] text-muted border border-border rounded px-1.5 py-px">
                    {msg.model}
                  </span>
                  <span className="text-[11px] text-muted">{msg.time}</span>
                </div>
                {msg.paragraphs.map((p, j) => (
                  <p key={j} className={`text-sm text-foreground leading-relaxed ${j > 0 ? "mt-2" : ""}`}>
                    {p}
                  </p>
                ))}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        <TypingIndicator />
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 border-t border-border shrink-0 mt-auto">
        <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2.5 border border-border">
          <Avatar name="You" color="amber" size="xs" className="shrink-0" />
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
