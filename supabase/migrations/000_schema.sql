-- =============================================================================
-- Elenchus — complete schema
-- Run this once in the Supabase SQL editor on a fresh project.
-- =============================================================================


-- ─── Types ───────────────────────────────────────────────────────────────────

create type public.llm_provider as enum ('anthropic', 'gemini', 'openai');


-- ─── users ───────────────────────────────────────────────────────────────────
-- Mirrors auth.users; populated automatically on signup via trigger below.

create table public.users (
  id                    uuid        primary key references auth.users(id) on delete cascade,
  email                 text        unique not null,
  display_name          text        not null,
  color                 text        not null default 'blue',
  llm_provider          public.llm_provider,
  llm_api_key_encrypted text,
  created_at            timestamptz not null default now(),
  constraint llm_key_consistency check (
    (llm_provider is null) = (llm_api_key_encrypted is null)
  )
);

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
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  description   text,
  emoji         text        not null default '📁',
  system_prompt text,
  created_by    uuid        references public.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);


-- ─── project_members ─────────────────────────────────────────────────────────

create table public.project_members (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects(id) on delete cascade,
  user_id         uuid        not null references public.users(id)    on delete cascade,
  role            text        not null default 'can_use'
                              check (role in ('can_use', 'can_edit')),
  status          text        not null default 'active'
                              check (status in ('pending', 'active')),
  invited_by_name text,
  created_at      timestamptz not null default now(),
  unique (project_id, user_id)
);

-- Security-definer helper avoids recursive RLS when policies query project_members.
-- Requires status = 'active' so pending invitees cannot read project data.
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id    = auth.uid()
      and status     = 'active'
  );
$$;


-- ─── conversations ────────────────────────────────────────────────────────────

create table public.conversations (
  id                  uuid        primary key default gen_random_uuid(),
  project_id          uuid        not null references public.projects(id) on delete cascade,
  name                text        not null,
  creator_user_id     uuid        references public.users(id) on delete set null,
  claude_mode         text        not null default 'manual'
                                  check (claude_mode in ('manual', 'smart', 'auto')),
  payer_mode          text        not null default 'last_speaker'
                                  check (payer_mode in ('last_speaker', 'round_robin', 'host', 'designated')),
  designated_payer_id uuid        references public.users(id),
  token_budget        integer,
  hard_stop           boolean     not null default false,
  created_at          timestamptz not null default now()
);


-- ─── conversation_members ─────────────────────────────────────────────────────
-- Optional per-conversation access override.
-- When empty for a conversation, all project members can access it.

create table public.conversation_members (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  user_id         uuid        not null references public.users(id)         on delete cascade,
  created_at      timestamptz not null default now(),
  unique (conversation_id, user_id)
);


-- ─── messages ────────────────────────────────────────────────────────────────

create table public.messages (
  id                  uuid        primary key default gen_random_uuid(),
  conversation_id     uuid        not null references public.conversations(id) on delete cascade,
  role                text        not null check (role in ('user', 'assistant')),
  content             text        not null,
  author_user_id      uuid        references public.users(id),   -- null for assistant
  author_display_name text        not null,
  caller_user_id      uuid        references public.users(id),   -- who typed @mention
  payer_user_id       uuid        references public.users(id),   -- whose API key was charged
  model_used          text,
  input_tokens        integer     not null default 0,
  output_tokens       integer     not null default 0,
  created_at          timestamptz not null default now()
);


-- ─── documents ───────────────────────────────────────────────────────────────
-- File metadata only. Actual bytes live in Storage bucket "documents".
-- conversation_id = null means project-wide; non-null means scoped to that chat.

create table public.documents (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects(id)      on delete cascade,
  name            text        not null,
  storage_path    text        not null,
  size_bytes      bigint      not null default 0,
  mime_type       text,
  content         text,         -- extracted text (null for images / unreadable files)
  content_length  integer,      -- char count of content; null when extraction failed
  uploaded_by     uuid        references public.users(id)                  on delete set null,
  conversation_id uuid        references public.conversations(id)          on delete cascade,
  created_at      timestamptz not null default now()
);

create index documents_conversation_id_idx on public.documents(conversation_id);


-- ─── activity_log ─────────────────────────────────────────────────────────────
-- Append-only event log for the project Catch Up feed.

create table public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  user_id     uuid        references public.users(id) on delete set null,
  action      text        not null,
  target_type text,       -- 'conversation' | 'document' | 'member' | 'project'
  target_name text,
  target_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);


-- ─── project_member_state ────────────────────────────────────────────────────
-- Tracks when each user last viewed the project Catch Up tab.

create table public.project_member_state (
  project_id   uuid        not null references public.projects(id) on delete cascade,
  user_id      uuid        not null references public.users(id)    on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (project_id, user_id)
);


-- =============================================================================
-- Row-level security
-- =============================================================================

alter table public.users                enable row level security;
alter table public.projects             enable row level security;
alter table public.project_members      enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.documents            enable row level security;
alter table public.activity_log         enable row level security;
alter table public.project_member_state enable row level security;


-- ─── users ───────────────────────────────────────────────────────────────────
-- Own row always readable. Co-member rows readable only when the viewer is active.

create policy "users: read own or co-member row"
  on public.users for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.project_members pm1
      join public.project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid()
        and pm1.status  = 'active'
        and pm2.user_id = users.id
    )
  );

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id);


-- ─── projects ────────────────────────────────────────────────────────────────

create policy "projects: members can read"
  on public.projects for select
  using (public.is_project_member(id));


-- ─── project_members ─────────────────────────────────────────────────────────

create policy "project_members: readable within project"
  on public.project_members for select
  using (public.is_project_member(project_id));


-- ─── conversations ────────────────────────────────────────────────────────────

create policy "conversations: project members can read"
  on public.conversations for select
  using (
    exists (
      select 1 from public.project_members
      where project_id = conversations.project_id
        and user_id    = auth.uid()
        and status     = 'active'
    )
  );


-- ─── conversation_members ─────────────────────────────────────────────────────

create policy "conversation_members: readable by project or conversation member"
  on public.conversation_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.project_members pm
      join public.conversations   c on c.id = conversation_members.conversation_id
      where pm.project_id = c.project_id
        and pm.user_id    = auth.uid()
        and pm.status     = 'active'
    )
  );


-- ─── messages ────────────────────────────────────────────────────────────────

create policy "messages: readable by project members"
  on public.messages for select
  using (
    exists (
      select 1
      from public.project_members pm
      join public.conversations   c on c.id = messages.conversation_id
      where pm.project_id = c.project_id
        and pm.user_id    = auth.uid()
        and pm.status     = 'active'
    )
  );


-- ─── documents ───────────────────────────────────────────────────────────────

create policy "documents: project members can read"
  on public.documents for select
  using (public.is_project_member(project_id));


-- ─── activity_log ─────────────────────────────────────────────────────────────

create policy "activity_log: project members can read"
  on public.activity_log for select
  using (public.is_project_member(project_id));


-- ─── project_member_state ────────────────────────────────────────────────────

create policy "project_member_state: own row"
  on public.project_member_state for all
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());


-- =============================================================================
-- Grants
-- =============================================================================

-- authenticated: column-scoped access on users; broader access on other tables.
-- API routes use service_role which bypasses column-level grants entirely.

revoke select on public.users from authenticated;
revoke update on public.users from authenticated;
grant select (id, display_name, color) on public.users to authenticated;
grant update (display_name, color)     on public.users to authenticated;

grant select, insert, update on public.projects             to authenticated;
grant select, insert, update on public.project_members      to authenticated;
grant select, insert, update on public.conversations        to authenticated;
grant select, insert, update on public.conversation_members to authenticated;
grant select, insert, update on public.messages             to authenticated;
grant select, insert         on public.documents            to authenticated;
grant select                 on public.activity_log         to authenticated;
grant select, insert, update on public.project_member_state to authenticated;

grant all on public.users                to service_role;
grant all on public.projects             to service_role;
grant all on public.project_members      to service_role;
grant all on public.conversations        to service_role;
grant all on public.conversation_members to service_role;
grant all on public.messages             to service_role;
grant all on public.documents            to service_role;
grant all on public.activity_log         to service_role;
grant all on public.project_member_state to service_role;


-- =============================================================================
-- Storage: documents bucket
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Download: active project members only, matched via document record
create policy "documents: project members can download"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.project_members pm
    join public.documents       d  on d.project_id = pm.project_id
    where pm.user_id    = auth.uid()
      and pm.status     = 'active'
      and d.storage_path = name
  )
);

-- Upload: active project members; path format is {projectId}/{timestamp}-{filename}
create policy "documents: project members can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and exists (
    select 1 from public.project_members pm
    where pm.user_id    = auth.uid()
      and pm.status     = 'active'
      and pm.project_id = split_part(name, '/', 1)::uuid
  )
);

-- Delete: the user who originally uploaded the file
create policy "documents: uploader can delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and owner = auth.uid()
);
