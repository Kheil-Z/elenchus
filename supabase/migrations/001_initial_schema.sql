-- =============================================================================
-- Elenchus — initial schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- ─── users ───────────────────────────────────────────────────────────────────
-- Extends auth.users with app-specific profile data.
-- Row is auto-created by the trigger below on signup.

create table public.users (
  id                          uuid primary key references auth.users(id) on delete cascade,
  email                       text unique not null,
  display_name                text not null,
  color                       text not null default 'blue',
  anthropic_api_key_encrypted text,
  created_at                  timestamptz not null default now()
);

-- Auto-populate public.users when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'color', 'blue')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── projects ────────────────────────────────────────────────────────────────

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid not null references public.users(id),
  created_at  timestamptz not null default now()
);


-- ─── project_members ─────────────────────────────────────────────────────────

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.users(id)    on delete cascade,
  role       text not null default 'can_use'
             check (role in ('can_use', 'can_edit')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);


-- ─── conversations ────────────────────────────────────────────────────────────

create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id)   on delete cascade,
  name                text not null,
  creator_user_id     uuid not null references public.users(id),
  claude_mode         text not null default 'manual'
                      check (claude_mode in ('manual', 'smart', 'auto')),
  payer_mode          text not null default 'last_speaker'
                      check (payer_mode in ('last_speaker', 'round_robin', 'host', 'designated')),
  designated_payer_id uuid references public.users(id),
  token_budget        integer,
  hard_stop           boolean not null default false,
  created_at          timestamptz not null default now()
);


-- ─── conversation_members ─────────────────────────────────────────────────────
-- Optional override: if empty for a given conversation,
-- all project members can access it.

create table public.conversation_members (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.users(id)         on delete cascade,
  created_at      timestamptz not null default now(),
  unique (conversation_id, user_id)
);


-- ─── messages ────────────────────────────────────────────────────────────────

create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations(id) on delete cascade,
  role                text not null check (role in ('user', 'assistant')),
  content             text not null,
  author_user_id      uuid references public.users(id),   -- null for assistant messages
  author_display_name text not null,
  caller_user_id      uuid references public.users(id),   -- who typed @claude
  payer_user_id       uuid references public.users(id),   -- whose key was used
  model_used          text,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  created_at          timestamptz not null default now()
);


-- =============================================================================
-- Row-Level Security
-- =============================================================================

alter table public.users               enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.conversations       enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages            enable row level security;


-- ─── users ───────────────────────────────────────────────────────────────────
-- Read and update own row only.

create policy "users: read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id);


-- ─── projects ────────────────────────────────────────────────────────────────
-- Readable by project members.

create policy "projects: members can read"
  on public.projects for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = projects.id
        and user_id     = auth.uid()
    )
  );


-- ─── project_members ─────────────────────────────────────────────────────────
-- Readable by anyone in the same project.

create policy "project_members: readable within project"
  on public.project_members for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id    = auth.uid()
    )
  );


-- ─── conversations ────────────────────────────────────────────────────────────
-- Readable by project members.

create policy "conversations: project members can read"
  on public.conversations for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = conversations.project_id
        and user_id    = auth.uid()
    )
  );


-- ─── conversation_members ─────────────────────────────────────────────────────
-- Readable if you are in the conversation, or in the parent project.

create policy "conversation_members: readable by project or conversation member"
  on public.conversation_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.project_members  pm
      join public.conversations    c  on c.id = conversation_members.conversation_id
      where pm.project_id = c.project_id
        and pm.user_id    = auth.uid()
    )
  );


-- ─── messages ────────────────────────────────────────────────────────────────
-- Readable by project members of the conversation's parent project.

create policy "messages: readable by project members"
  on public.messages for select
  using (
    exists (
      select 1
      from public.project_members pm
      join public.conversations   c  on c.id = messages.conversation_id
      where pm.project_id = c.project_id
        and pm.user_id    = auth.uid()
    )
  );
