-- ══════════════════════════════════════════════════════
-- Migration 012: Sector status + log
-- ══════════════════════════════════════════════════════

-- Reuse plant_status enum (ACTIVA / PARADA / EN_REPARACION)
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS status plant_status NOT NULL DEFAULT 'ACTIVA';

CREATE TABLE IF NOT EXISTS sector_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id   UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  old_status  plant_status,
  new_status  plant_status NOT NULL,
  reason      TEXT,
  changed_by  UUID REFERENCES app_users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sector_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ssl_read"  ON sector_status_log;
DROP POLICY IF EXISTS "ssl_write" ON sector_status_log;
CREATE POLICY "ssl_read"  ON sector_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssl_write" ON sector_status_log FOR ALL    TO authenticated USING (is_admin());
