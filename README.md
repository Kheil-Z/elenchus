# Elenchus

**Multiplayer AI workspace.** Multiple people share one conversation thread, each bringing their own API key. @mention Claude, Gemini, or ChatGPT — whoever you tag responds, billed to the person who called them.

**[Live demo](https://elenchus-blush.vercel.app/)** — hosted on Supabase free tier, so new account creation may be rate-limited.

---

## Tour

**Real-time multiplayer chat** — two users in the same conversation, one @mentions Claude. Each user has their own API key and can have a different provider; the token cost is attributed to whoever triggered the call. The provider indicator is visible at the bottom of the input.

![Multiplayer chat with @mention](docs/screenshot-chat.png)

---

**Projects and documents** — a project groups conversations, members, uploaded files, and an activity feed. Documents can be scoped to a single conversation or shared project-wide. Inside a chat, you control when files are sent to the AI (Always or Never). Token spend is broken down per user so everyone can see who is using what.

![Project view and document sidebar](docs/screenshot-projects_docs.png)

---

**Settings** — each user sets their own display name, avatar colour, and API key. Keys are encrypted at rest. You can revoke a key or switch providers at any time without affecting other members.

![Settings page](docs/screenshot-settings.png)

---

## Features

- **Multiplayer conversations** — shared thread, real-time sync, messages attributed to each person
- **BYOK per user** — each member adds their own API key; you never pay for anyone else
- **Multi-provider** — Anthropic (Claude), Google (Gemini), OpenAI (ChatGPT); each user picks their own
- **Vision + documents** — attach images and PDFs; images sent as vision inputs, PDFs extracted or sent natively to Claude
- **Project documents** — upload files project-wide or scoped to a single conversation; control when the AI sees them
- **Custom system prompts** — per-project instructions for the AI
- **Activity feed** — catch up on what happened while you were away, with unread indicators

---

## Self-hosting

### Prerequisites

- Node 22+ and pnpm
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works) — or any Node-compatible host

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
5. Go to **Authentication → Email Templates** and update the sender name so confirmation emails don't reference Supabase

### 3. Set environment variables

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role secret |
| `ENCRYPTION_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

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
5. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL and add it to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`) — without this, email confirmation links will not work

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

See [PRIVACY.md](PRIVACY.md) or the in-app [privacy policy](https://elenchus-blush.vercel.app/privacy).

---

## License

[MIT](LICENSE) © Kheil-Z
