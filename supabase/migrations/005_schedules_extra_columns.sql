-- Relax NOT NULL constraints that block form submission
ALTER TABLE maintenance_schedules
  ALTER COLUMN checklist_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN created_by   DROP NOT NULL;

-- Add missing columns
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- Fix execution_status enum to match app values
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'completado';
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'parcial';
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'cancelado';

-- Add missing columns to maintenance_executions
ALTER TABLE maintenance_executions
  ALTER COLUMN schedule_id DROP NOT NULL;

ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS execution_status TEXT,
  ADD COLUMN IF NOT EXISTS executed_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duration_hours   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS observations     TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_snapshot  JSONB,
  ADD COLUMN IF NOT EXISTS checklist_responses JSONB;
