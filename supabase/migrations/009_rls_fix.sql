-- ══════════════════════════════════════════════════════
-- Migration 009: Fix RLS across all tables
-- ══════════════════════════════════════════════════════

-- Helper function to check admin role (avoids recursion in app_users policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE id = auth.uid()
    AND role IN ('admin_sistema', 'administrador')
  );
$$;

-- ── app_users ────────────────────────────────────────
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_all" ON app_users;
DROP POLICY IF EXISTS "users_read_own" ON app_users;
DROP POLICY IF EXISTS "admins_write"   ON app_users;

CREATE POLICY "users_read_all" ON app_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_write" ON app_users
  FOR ALL TO authenticated USING (is_admin());

-- ── plants ───────────────────────────────────────────
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plants_read"  ON plants;
DROP POLICY IF EXISTS "plants_write" ON plants;
CREATE POLICY "plants_read"  ON plants FOR SELECT TO authenticated USING (true);
CREATE POLICY "plants_write" ON plants FOR ALL    TO authenticated USING (is_admin());

-- ── sectors ──────────────────────────────────────────
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sectors_read"  ON sectors;
DROP POLICY IF EXISTS "sectors_write" ON sectors;
CREATE POLICY "sectors_read"  ON sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_write" ON sectors FOR ALL    TO authenticated USING (is_admin());

-- ── equipment ────────────────────────────────────────
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_read"  ON equipment;
DROP POLICY IF EXISTS "equipment_write" ON equipment;
CREATE POLICY "equipment_read"  ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_write" ON equipment FOR ALL    TO authenticated USING (is_admin());

-- ── equipment_status_log ─────────────────────────────
ALTER TABLE equipment_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status_log_read"  ON equipment_status_log;
DROP POLICY IF EXISTS "status_log_write" ON equipment_status_log;
CREATE POLICY "status_log_read"  ON equipment_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_log_write" ON equipment_status_log FOR ALL    TO authenticated USING (is_admin());

-- ── equipment_checklists ─────────────────────────────
ALTER TABLE equipment_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklists_read"  ON equipment_checklists;
DROP POLICY IF EXISTS "checklists_write" ON equipment_checklists;
CREATE POLICY "checklists_read"  ON equipment_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklists_write" ON equipment_checklists FOR ALL    TO authenticated USING (is_admin());

-- ── maintenance_schedules ────────────────────────────
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_read"   ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_write"  ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_insert" ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_update" ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_delete" ON maintenance_schedules;
CREATE POLICY "schedules_read"   ON maintenance_schedules FOR SELECT TO authenticated USING (true);
-- Any authenticated user can update (needed when recording executions advances next_date)
CREATE POLICY "schedules_update" ON maintenance_schedules FOR UPDATE TO authenticated USING (true);
-- Only admins can create or delete schedules
CREATE POLICY "schedules_insert" ON maintenance_schedules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "schedules_delete" ON maintenance_schedules FOR DELETE TO authenticated USING (is_admin());

-- ── maintenance_executions ───────────────────────────
ALTER TABLE maintenance_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "executions_read"  ON maintenance_executions;
DROP POLICY IF EXISTS "executions_write" ON maintenance_executions;
-- All authenticated users can read and insert executions
CREATE POLICY "executions_read"   ON maintenance_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "executions_insert" ON maintenance_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "executions_update" ON maintenance_executions FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "executions_delete" ON maintenance_executions FOR DELETE TO authenticated USING (is_admin());
