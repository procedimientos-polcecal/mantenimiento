-- ══════════════════════════════════════════════════════
-- Migration 014: Daily work plans
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_plans (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha       DATE        NOT NULL,
  titulo      TEXT,
  notas       TEXT,
  created_by  UUID        REFERENCES app_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_plan_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  work_order_id   UUID REFERENCES work_orders(id),
  -- Campos copiados al momento de agregar (snapshot para impresión)
  ot_number       INTEGER,
  especialidad    TEXT,
  sector_raw      TEXT,
  equipo_raw      TEXT,
  descripcion     TEXT,
  repuesto        TEXT,
  fecha_ejecucion DATE,
  -- Asignación
  assigned_to     UUID REFERENCES app_users(id),
  assigned_name   TEXT,   -- nombre libre si no está en el sistema
  notas_item      TEXT,
  orden           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dp_fecha_idx  ON daily_plans(fecha DESC);
CREATE INDEX IF NOT EXISTS dpi_plan_idx  ON daily_plan_items(plan_id);

ALTER TABLE daily_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_read"  ON daily_plans;
DROP POLICY IF EXISTS "dp_write" ON daily_plans;
DROP POLICY IF EXISTS "dpi_read"  ON daily_plan_items;
DROP POLICY IF EXISTS "dpi_write" ON daily_plan_items;

CREATE POLICY "dp_read"   ON daily_plans      FOR SELECT TO authenticated USING (true);
CREATE POLICY "dp_write"  ON daily_plans      FOR ALL    TO authenticated USING (is_admin());
CREATE POLICY "dpi_read"  ON daily_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpi_write" ON daily_plan_items FOR ALL    TO authenticated USING (is_admin());
