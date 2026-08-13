-- ══════════════════════════════════════════════════════
-- Migration 027: Repuestos necesarios por OT
-- ══════════════════════════════════════════════════════
-- Lista de repuestos que hacen falta para realizar una OT.
-- La disponibilidad se consulta EN VIVO contra la planilla de inventario.

CREATE TABLE IF NOT EXISTS work_order_parts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  codigo        text,
  cantidad      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wo_parts_idx ON work_order_parts(work_order_id);

ALTER TABLE work_order_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wo_parts_read"  ON work_order_parts;
DROP POLICY IF EXISTS "wo_parts_write" ON work_order_parts;
CREATE POLICY "wo_parts_read"  ON work_order_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo_parts_write" ON work_order_parts FOR ALL    TO authenticated USING (true);
