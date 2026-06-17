"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { RecentChatItem } from "@/components/RecentChatItem";
import { RollingWord } from "@/components/RollingWord";
import { DemoChat } from "@/components/DemoChat";
import { useAuth } from "@/lib/auth-context";
import type { UserColor } from "@/lib/types";

// ── Static demo data ──────────────────────────────────────────────────────────

const PROJECTS = [
  {
    emoji: "📊",
    name: "Q3 Strategy",
    description: "OKR alignment, competitor positioning, and go-to-market planning.",
    members: [
      { name: "Sam Lee", color: "amber" as UserColor },
      { name: "Jordan Park", color: "coral" as UserColor },
      { name: "Taylor Wu", color: "green" as UserColor },
      { name: "Morgan Ali", color: "purple" as UserColor },
      { name: "Priya Singh", color: "blue" as UserColor },
    ],
    docCount: 7,
    chatCount: 12,
    lastActive: "1d ago",
  },
  {
    emoji: "🎨",
    name: "Product Redesign",
    description: "Onboarding flow redesign and design system updates for Q3.",
    members: [
      { name: "Alex Kim", color: "blue" as UserColor },
      { name: "Ben Clarke", color: "green" as UserColor },
      { name: "Clara Ng", color: "purple" as UserColor },
    ],
    docCount: 3,
    chatCount: 5,
    lastActive: "2h ago",
  },
  {
    emoji: "⚙️",
    name: "API Architecture",
    description: "Auth middleware refactor for session token compliance.",
    members: [
      { name: "Alex Kim", color: "blue" as UserColor },
      { name: "Riley Chen", color: "green" as UserColor },
    ],
    docCount: 4,
    chatCount: 8,
    lastActive: "3h ago",
  },
  {
    emoji: "✍️",
    name: "Brand Voice Guide",
    description: "Tone, vocabulary, and style documentation across channels.",
    members: [
      { name: "Clara Ng", color: "purple" as UserColor },
      { name: "Ben Clarke", color: "green" as UserColor },
      { name: "Sam Lee", color: "amber" as UserColor },
    ],
    docCount: 2,
    chatCount: 3,
    lastActive: "5d ago",
  },
];

const RECENT_CHATS = [
  {
    title: "Mapping the onboarding flow",
    project: "Product Redesign",
    participants: [
      { name: "Alex Kim", color: "blue" as UserColor },
      { name: "Ben Clarke", color: "green" as UserColor },
    ],
    preview: "Here's a 4-step flow based on the brief and user interviews...",
    time: "2h ago",
  },
  {
    title: "Competitor positioning matrix",
    project: "Q3 Strategy",
    participants: [
      { name: "Jordan Park", color: "coral" as UserColor },
      { name: "Sam Lee", color: "amber" as UserColor },
    ],
    preview: "The key differentiator against Notion is early team-invite placement...",
    time: "1d ago",
  },
  {
    title: "Auth middleware refactor plan",
    project: "API Architecture",
    participants: [
      { name: "Alex Kim", color: "blue" as UserColor },
      { name: "Riley Chen", color: "green" as UserColor },
    ],
    preview: "Riley's right — the session token approach doesn't meet the new compliance requirements...",
    time: "3h ago",
  },
  {
    title: "Interview synthesis · 12 users",
    project: "Product Redesign",
    participants: [{ name: "Clara Ng", color: "purple" as UserColor }],
    preview: "Across all 12 interviews, the clearest theme was templates-first onboarding...",
    time: "5h ago",
  },
  {
    title: "OKR alignment for H2",
    project: "Q3 Strategy",
    participants: [
      { name: "Sam Lee", color: "amber" as UserColor },
      { name: "Taylor Wu", color: "green" as UserColor },
      { name: "Morgan Ali", color: "purple" as UserColor },
    ],
    preview: "Taking both frameworks into account, here's where the team has consensus...",
    time: "2d ago",
  },
];

// ── How-it-works steps ────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Bring your own key",
    body: "Each person adds their AI provider API key (Anthropic, Google, or OpenAI). Keys are encrypted and stored server-side — never in your browser.",
  },
  {
    step: "02",
    title: "Share a thread",
    body: "Invite collaborators to a project. Every message is attributed — the AI always knows who said what.",
  },
  {
    step: "03",
    title: "Call the AI together",
    body: "Type @claude to trigger a response. Each call goes out under the sender's own key. Pay only for what you use.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [selectedChat, setSelectedChat] = useState<0 | 1 | 2>(1);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/projects");
    }
  }, [user, isLoading, router]);

  if (isLoading || user) return null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-8 pt-20 pb-16 max-w-5xl mx-auto w-full flex flex-col items-center gap-8">
          {/* Row 1: Elenchus · tagline — centered via parent items-center */}
          <div className="flex flex-col md:flex-row items-end gap-3 md:gap-5">
            <h1 className="font-serif text-[96px] leading-none text-foreground tracking-tight shrink-0">
              Elenchus
            </h1>
            <span className="hidden md:block w-px h-14 bg-foreground/20 mb-[10px] shrink-0" />
            {/*
              Reserve the width of the longest word ("conversations") with an invisible
              placeholder so the row width never changes and Elenchus never shifts.
            */}
            <p className="font-serif text-[40px] leading-none text-foreground tracking-tight mb-[10px] whitespace-nowrap">
              Collaborate on AI{" "}
              <span className="relative inline-block">
                <span className="invisible select-none pointer-events-none" aria-hidden="true">
                  conversations
                </span>
                <span className="absolute left-0 top-0">
                  <RollingWord />
                </span>
              </span>
            </p>
          </div>

          {/* Row 2: explanation */}
          <p className="text-[20px] text-muted leading-relaxed w-full max-w-xl">
            Stop copy-pasting AI replies. <br /> One thread — your team,
            your AI, everyone in the same room.
          </p>

          {/* Row 3: CTAs */}
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/auth/signup" className="bg-foreground text-surface text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
              Get started
            </a>
            <a href="/auth/login" className="text-sm text-muted border border-border bg-surface px-5 py-2.5 rounded-lg hover:text-foreground transition-colors">
              Sign in
            </a>
            <a
              href="https://github.com/Kheil-Z/elenchus"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted border border-border bg-surface px-5 py-2.5 rounded-lg hover:text-foreground transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
              </svg>
              Star on GitHub
            </a>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="px-8 py-14 border-t border-border max-w-5xl mx-auto w-full">
          <h2 className="font-serif text-2xl text-foreground mb-10 text-center">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="flex flex-col gap-3">
                <span className="text-xs font-mono text-muted/60">{step}</span>
                <h3 className="font-medium text-foreground">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section className="px-8 py-12 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-serif text-2xl text-foreground mb-6">Projects</h2>

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">

              {/* Left: 2×2 project mini-grid — click any card to preview its chat */}
              <div className="grid grid-cols-2 gap-3">
                {PROJECTS.slice(0, 3).map((p, i) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedChat(i as 0 | 1 | 2)}
                    className={`text-left w-full rounded-xl transition-all duration-150 ${
                      selectedChat === i
                        ? "ring-2 ring-foreground/30 shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                        : "opacity-60 hover:opacity-90"
                    }`}
                  >
                    <ProjectCard {...p} />
                  </button>
                ))}

                {/* New project card — links to sign up */}
                <a
                  href="/auth/signup"
                  className="bg-surface rounded-xl border border-dashed border-border p-4 flex flex-col items-center justify-center gap-2 hover:border-foreground/20 hover:bg-background transition-all duration-150 opacity-60 hover:opacity-100"
                >
                  <div className="w-8 h-8 rounded-full border border-dashed border-border flex items-center justify-center">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted">New project</span>
                </a>
              </div>

              {/* Right: demo chat */}
              <DemoChat chatId={selectedChat} />
            </div>
          </div>
        </section>

        {/* Recent chats */}
        <section className="px-8 py-12 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-foreground">Recent chats</h2>
            </div>

            <div className="bg-surface rounded-xl border border-border divide-y divide-border overflow-hidden">
              {RECENT_CHATS.map((chat) => (
                <RecentChatItem key={chat.title} {...chat} />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-8 py-8 mt-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <span className="font-serif text-base text-foreground">Elenchus</span>
          <div className="flex items-center gap-6">
            <span>MIT License</span>
            <a
              href="https://github.com/Kheil-Z/elenchus"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
          <span className="text-xs">Vercel + Supabase · $0 to start</span>
        </div>
      </footer>
    </div>
  );
}
