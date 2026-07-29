-- ══════════════════════════════════════════════════════
-- Migration 017: Avisos (integración con hoja de Google Sheets)
-- ══════════════════════════════════════════════════════
-- Un aviso (N° OA) reporta que algo necesita mantenimiento.
-- Luego, de un aviso puede generarse una orden de trabajo (OT).

CREATE TABLE IF NOT EXISTS avisos (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  oa_number     text UNIQUE,                          -- N° OA ("A1", "A2"...)
  fecha         date,
  sector_raw    text,
  sector_id     uuid REFERENCES sectors(id),
  equipo_raw    text,
  equipo_code   text,
  equipment_id  uuid REFERENCES equipment(id),
  descripcion   text,
  urgencia      text,                                 -- "🟡 Media", "🔴 Alta", etc.
  quien_aviso   text,
  ot_asignada   text,                                 -- "si" / N° OT / vacío
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  observaciones text,
  app_created   boolean NOT NULL DEFAULT false,
  sheets_row    integer,
  created_by    uuid REFERENCES app_users(id),
  synced_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avisos_equipment_idx ON avisos(equipment_id);
CREATE INDEX IF NOT EXISTS avisos_wo_idx        ON avisos(work_order_id);
CREATE INDEX IF NOT EXISTS avisos_urgencia_idx  ON avisos(urgencia);

-- RLS
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avisos_read"  ON avisos;
DROP POLICY IF EXISTS "avisos_write" ON avisos;
CREATE POLICY "avisos_read"  ON avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "avisos_write" ON avisos FOR ALL    TO authenticated USING (is_admin());
