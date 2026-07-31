-- ══════════════════════════════════════════════════════
-- Migration 021: Repuestos por equipo (catálogo)
-- ══════════════════════════════════════════════════════
-- Qué repuestos puede consumir cada equipo. Después se pueden
-- asignar a una OT o a un Aviso de ese equipo.

CREATE TABLE IF NOT EXISTS equipment_parts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id  uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  name          text NOT NULL,
  code          text,              -- código de repuesto (opcional)
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parts_equipment_idx ON equipment_parts(equipment_id);

ALTER TABLE equipment_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "parts_read"  ON equipment_parts;
DROP POLICY IF EXISTS "parts_write" ON equipment_parts;
CREATE POLICY "parts_read"  ON equipment_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "parts_write" ON equipment_parts FOR ALL    TO authenticated USING (is_admin());

-- Los avisos también pueden llevar repuestos asignados (como las OTs)
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS repuesto text;
