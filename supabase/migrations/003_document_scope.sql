-- =============================================================================
-- Elenchus — document scope: add optional conversation_id to documents
-- Run in Supabase SQL Editor after 002_project_features.sql
-- =============================================================================

-- Add conversation_id: null = project-wide, non-null = scoped to that conversation only
alter table public.documents
  add column if not exists conversation_id uuid
    references public.conversations(id) on delete cascade;

create index if not exists documents_conversation_id_idx
  on public.documents(conversation_id);
