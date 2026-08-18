-- ══════════════════════════════════════════════════════
-- Migration 033: Planificación de producción — info extra
-- ══════════════════════════════════════════════════════
-- Por día (7): motivo de parada y turnos. Por sector/semana: responsable.

ALTER TABLE production_plan
  ADD COLUMN IF NOT EXISTS motivos     jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS turnos      jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS responsable text;
