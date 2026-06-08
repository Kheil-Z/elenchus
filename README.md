# Elenchus

A multiplayer Claude workspace. Multiple collaborators share a single conversation thread, each using their own Anthropic API key (BYOK). Think "multiplayer Claude" — a thin coordination layer that handles shared state, user attribution, and per-user billing.

**Architecture:** API keys live in each user's browser `localStorage`. The browser calls the Anthropic API directly — no key ever touches the server. Supabase stores and syncs the shared `messages[]` array in real time.

---

## Setup

**Prerequisites:** Node 20 (`nvm use`), pnpm

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env and fill in Supabase credentials
cp .env.example .env.local

# 3. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
elenchus/
├── app/               # Next.js App Router pages and layouts
├── components/        # Shared UI components (Button, Card, Header, …)
├── lib/               # Utilities: supabase client, anthropic BYOK helpers, types
├── public/            # Static assets
└── styles/            # (reserved for global style overrides)
```

**Key files:**
- `lib/types.ts` — shared TypeScript types (Message, Project, Member, …)
- `lib/anthropic.ts` — localStorage key helpers (BYOK; no server involvement)
- `lib/supabase.ts` — Supabase client singleton
- `app/globals.css` — Tailwind v4 design tokens (colors, fonts)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database & realtime | Supabase |
| AI | Anthropic API (client-side BYOK) |
| Package manager | pnpm |
| Fonts | Instrument Serif (headings) + DM Sans (body) |

---

## Deployment

**Vercel + Supabase hosted = $0 to start.**

1. Push to GitHub
2. Import repo in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables
3. Deploy

Self-host option: Docker Compose with Supabase self-hosted + any Node host.

---

## License

MIT
