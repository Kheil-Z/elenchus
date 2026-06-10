-- Restrict which columns authenticated users can read from public.users.
-- The service role (used in all API routes) bypasses column-level grants,
-- so server-side reads of anthropic_api_key_encrypted are unaffected.
revoke select on public.users from authenticated;
grant select (id, display_name, color) on public.users to authenticated;

-- Extend read access: allow reading another user's (safe) columns when you
-- share at least one project with them.
-- Drop the narrow own-row-only policy and replace with a single policy that
-- covers both cases.
drop policy if exists "users: read own row" on public.users;

create policy "users: read own or co-member row"
  on public.users for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.project_members pm1
      join public.project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid()
        and pm2.user_id = users.id
    )
  );
