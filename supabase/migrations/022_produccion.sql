-- ══════════════════════════════════════════════════════
-- Migration 022: Planificación de producción semanal
-- ══════════════════════════════════════════════════════
-- Por cada semana y sector se guarda el estado de producción de los 7 días
-- (Lun..Dom): EN_PRODUCCION / PARCIAL / LIBRE. Sirve para ver qué sectores
-- quedan libres y decidir dónde meter reparaciones sin frenar el despacho.

CREATE TABLE IF NOT EXISTS production_plan (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start  date NOT NULL,                 -- lunes de la semana
  sector_id   uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  days        jsonb NOT NULL DEFAULT '["LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE"]',
  note        text,
  updated_by  uuid REFERENCES app_users(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, sector_id)
);

CREATE INDEX IF NOT EXISTS production_week_idx ON production_plan(week_start);

ALTER TABLE production_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prod_read"  ON production_plan;
DROP POLICY IF EXISTS "prod_write" ON production_plan;
CREATE POLICY "prod_read"  ON production_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_write" ON production_plan FOR ALL    TO authenticated USING (is_admin());
