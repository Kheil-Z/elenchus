-- =============================================================================
-- Migration 008: Add OpenAI to the llm_provider enum
-- =============================================================================

ALTER TYPE public.llm_provider ADD VALUE 'openai';
