-- =============================================================================
-- Elenchus — project features: documents, activity log, member state
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- =============================================================================

-- ─── emoji column (added post-launch) ─────────────────────────────────────────
alter table public.projects
  add column if not exists emoji text not null default '📁';


-- ─── documents ────────────────────────────────────────────────────────────────
-- File metadata. Actual files live in Supabase Storage bucket "documents".
-- Create that bucket in the Supabase dashboard before uploading.

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  name         text not null,
  storage_path text not null,
  size_bytes   bigint not null default 0,
  mime_type    text,
  uploaded_by  uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents: project members can read"
  on public.documents for select
  using (public.is_project_member(project_id));

grant select, insert on public.documents to authenticated;
grant all on public.documents to service_role;


-- ─── activity_log ─────────────────────────────────────────────────────────────
-- Append-only log of notable project events.

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  action      text not null,
  target_type text,   -- 'conversation' | 'document' | 'member' | 'project'
  target_name text,
  target_id   text,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "activity_log: project members can read"
  on public.activity_log for select
  using (public.is_project_member(project_id));

grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;


-- ─── project_member_state ────────────────────────────────────────────────────
-- Tracks when each user last viewed a project's Catch Up tab.

create table public.project_member_state (
  project_id   uuid not null references public.projects(id) on delete cascade,
  user_id      uuid not null references public.users(id)    on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_member_state enable row level security;

create policy "project_member_state: own row"
  on public.project_member_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.project_member_state to authenticated;
grant all on public.project_member_state to service_role;
