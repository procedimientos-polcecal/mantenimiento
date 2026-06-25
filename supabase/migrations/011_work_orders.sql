-- ══════════════════════════════════════════════════════
-- Migration 011: Work orders (OT) from Google Sheets
-- ══════════════════════════════════════════════════════

CREATE TYPE ot_estado  AS ENUM ('REALIZADO', 'EN_PROCESO', 'POR_HACER', 'ATRASADO');
CREATE TYPE ot_tipo    AS ENUM ('PROGRAMADO', 'CORRECTIVO', 'PREDICTIVO', 'MEJORA');
CREATE TYPE ot_quien   AS ENUM ('INTERNO', 'CONTRATADO', 'MIXTO');

CREATE TABLE IF NOT EXISTS work_orders (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  ot_number     INTEGER     NOT NULL UNIQUE,          -- N° OT
  fecha         DATE,                                  -- FECHA de creación
  sector_raw    TEXT,                                  -- SECTOR (texto tal como viene de Sheets)
  equipo_raw    TEXT,                                  -- EQUIPO (texto: "PO-A1-07 – Rompedora de cono")
  equipo_code   TEXT,                                  -- código extraído: "PO-A1-07"
  equipment_id  UUID        REFERENCES equipment(id),  -- link resuelto
  especialidad  TEXT,
  tipo          TEXT,
  quien         TEXT,
  descripcion   TEXT,
  repuesto      TEXT,
  fecha_ejecucion DATE,
  fecha_cierre    DATE,
  estado        TEXT        NOT NULL DEFAULT 'POR_HACER',
  contratista   TEXT,
  horas         NUMERIC,
  operario_1    TEXT,
  operario_2    TEXT,
  operario_3    TEXT,
  prioridad     TEXT,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wo_equipment_idx ON work_orders(equipment_id);
CREATE INDEX IF NOT EXISTS wo_estado_idx    ON work_orders(estado);
CREATE INDEX IF NOT EXISTS wo_code_idx      ON work_orders(equipo_code);

-- RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wo_read"  ON work_orders;
DROP POLICY IF EXISTS "wo_write" ON work_orders;
CREATE POLICY "wo_read"  ON work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_write" ON work_orders FOR ALL    TO authenticated USING (is_admin());
