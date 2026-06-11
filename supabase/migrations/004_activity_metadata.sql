-- Add metadata column to activity_log for storing extra context per event.
-- e.g. document scope (project-wide vs chat-specific) on upload / scope-change.

alter table public.activity_log
  add column if not exists metadata jsonb;
