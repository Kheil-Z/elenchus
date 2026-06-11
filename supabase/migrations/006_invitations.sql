-- Add invitation flow to project_members.
-- status: 'pending' = invited but not yet accepted, 'active' = full member
-- invited_by_name: snapshot of inviter's display name for invitation UI

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by_name text;

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_status_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_status_check CHECK (status IN ('pending', 'active'));
