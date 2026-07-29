-- ══════════════════════════════════════════════════════
-- Migration 019: Fotos de referencia en avisos
-- ══════════════════════════════════════════════════════
-- Las fotos se guardan en el storage de Supabase (no en Google).

ALTER TABLE avisos
  ADD COLUMN IF NOT EXISTS reference_photos text[];
