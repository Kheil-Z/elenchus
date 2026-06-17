# Elenchus

**Multiplayer AI workspace.** Multiple people share one conversation thread, each using their own API key. @mention Claude, Gemini, or ChatGPT — whoever you tag responds, billed to the person who called them.

> [Demo GIF goes here]

---

## Features

- **Multiplayer conversations** — shared thread, real-time updates, messages attributed to each person
- **BYOK per user** — each member adds their own API key; you never pay for anyone else
- **Multi-provider** — Anthropic (Claude), Google (Gemini), OpenAI (ChatGPT); switch per message
- **Vision + documents** — attach images and PDFs; images sent as vision inputs, PDFs extracted or sent natively to Claude
- **Project documents** — upload files project-wide or scoped to a single conversation
- **Custom system prompts** — per-project instructions for the AI
- **Activity feed** — see what your team has been up to

---

## Self-hosting

### Prerequisites

- Node 20+ and pnpm
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works) — or any Node host

### 1. Clone and install

```bash
git clone https://github.com/Kheil-Z/elenchus.git
cd elenchus
pnpm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Once provisioned, open **SQL Editor → New query**
3. Paste and run the entire contents of [`supabase/migrations/000_schema.sql`](supabase/migrations/000_schema.sql)
4. Go to **Authentication → Providers → Email** and confirm it is enabled
5. Go to **Authentication → Email Templates** and update the sender name so it doesn't reference Supabase

### 3. Set environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role secret |
| `ENCRYPTION_KEY` | Generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 4. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push your repo to GitHub
2. Import it at [vercel.com](https://vercel.com) — it auto-detects Next.js
3. Add the four environment variables from step 3 in Vercel's project settings
4. Deploy
5. In Supabase → **Authentication → URL Configuration**, set **Site URL** and add your Vercel URL to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`) — without this, email confirmation links break

---

## Project structure

```
elenchus/
├── app/
│   ├── (protected)/       # Authenticated pages (projects, chat, settings)
│   ├── api/               # Server-side API routes (LLM calls, uploads, etc.)
│   ├── auth/              # Login / signup pages
│   └── privacy/           # Privacy policy (public)
├── components/            # Shared UI components
├── lib/                   # Types, Supabase client, LLM layer, utilities
└── supabase/
    └── migrations/        # Single schema file — run once on a fresh project
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database + auth | Supabase (Postgres + RLS) |
| Storage | Supabase Storage |
| AI providers | Anthropic, Google Gemini, OpenAI |
| Hosting | Vercel |

---

## Privacy

See [PRIVACY.md](PRIVACY.md) or the in-app [privacy policy](/privacy).

---

## License

[MIT](LICENSE) © Kheil-Z
