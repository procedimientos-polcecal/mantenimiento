-- ══════════════════════════════════════════════════════
-- Migration 006: Comprehensive schema fixes
-- ══════════════════════════════════════════════════════

-- 1. Replace schedule_type enum with app values
ALTER TABLE maintenance_schedules ALTER COLUMN schedule_type TYPE TEXT;
DROP TYPE IF EXISTS schedule_type;
CREATE TYPE schedule_type AS ENUM (
  'DIARIO','SEMANAL','QUINCENAL','MENSUAL',
  'TRIMESTRAL','SEMESTRAL','ANUAL','PERSONALIZADO','FECHA_FIJA'
);
ALTER TABLE maintenance_schedules
  ALTER COLUMN schedule_type TYPE schedule_type USING 'MENSUAL'::schedule_type;

-- 2. Add 'completed' to schedule_status
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'completed';

-- 3. Relax NOT NULL on maintenance_schedules
ALTER TABLE maintenance_schedules
  ALTER COLUMN checklist_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN created_by   DROP NOT NULL;

-- 4. Add missing columns to maintenance_schedules
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- 5. Relax NOT NULL on maintenance_executions
ALTER TABLE maintenance_executions
  ALTER COLUMN equipment_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN schedule_id  DROP NOT NULL,
  ALTER COLUMN checklist_responses DROP NOT NULL;

-- 6. Add missing columns to maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS execution_status TEXT,
  ADD COLUMN IF NOT EXISTS executed_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duration_hours   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS observations     TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB;

-- 7. Relax NOT NULL on equipment_checklists
ALTER TABLE equipment_checklists
  ALTER COLUMN maintenance_type DROP NOT NULL,
  ALTER COLUMN created_by       DROP NOT NULL;

-- 8. Add missing columns to equipment_checklists
ALTER TABLE equipment_checklists
  ADD COLUMN IF NOT EXISTS name     TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
