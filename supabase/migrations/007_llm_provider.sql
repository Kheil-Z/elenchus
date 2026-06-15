-- =============================================================================
-- Migration 007: LLM provider support
--
-- Replaces the Anthropic-specific `anthropic_api_key_encrypted` column with
-- two provider-agnostic columns:
--   llm_provider           — which provider the key belongs to
--   llm_api_key_encrypted  — the encrypted key (same AES-256-GCM format)
--
-- Existing keys are migrated automatically: any row that has a value in
-- anthropic_api_key_encrypted gets it copied to llm_api_key_encrypted and
-- llm_provider set to 'anthropic'. The old column is then dropped.
-- =============================================================================

-- ── 1. Create the provider enum ──────────────────────────────────────────────

create type public.llm_provider as enum ('anthropic', 'gemini');


-- ── 2. Add new columns ───────────────────────────────────────────────────────

alter table public.users
  add column llm_provider          public.llm_provider,
  add column llm_api_key_encrypted text;


-- ── 3. Migrate existing Anthropic keys ───────────────────────────────────────

update public.users
set
  llm_provider          = 'anthropic',
  llm_api_key_encrypted = anthropic_api_key_encrypted
where anthropic_api_key_encrypted is not null;


-- ── 4. Drop the old column ───────────────────────────────────────────────────

alter table public.users
  drop column anthropic_api_key_encrypted;


-- ── 5. Add a constraint: provider and key must be set together or not at all ─

alter table public.users
  add constraint llm_key_consistency check (
    (llm_provider is null) = (llm_api_key_encrypted is null)
  );
