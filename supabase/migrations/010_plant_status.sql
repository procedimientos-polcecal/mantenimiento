-- ══════════════════════════════════════════════════════
-- Migration 010: Plant status + status log
-- ══════════════════════════════════════════════════════

-- Enum for plant status
CREATE TYPE plant_status AS ENUM ('ACTIVA', 'PARADA', 'EN_REPARACION');

-- Add status column to plants
ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS status plant_status NOT NULL DEFAULT 'ACTIVA';

-- Log table for plant status changes
CREATE TABLE IF NOT EXISTS plant_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  old_status  plant_status,
  new_status  plant_status NOT NULL,
  reason      TEXT,
  changed_by  UUID REFERENCES app_users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for plant_status_log
ALTER TABLE plant_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psl_read"  ON plant_status_log;
DROP POLICY IF EXISTS "psl_write" ON plant_status_log;
CREATE POLICY "psl_read"  ON plant_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "psl_write" ON plant_status_log FOR ALL    TO authenticated USING (is_admin());
