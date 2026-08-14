-- ══════════════════════════════════════════════════════
-- Migration 029: Operarios (opciones por posición, editables)
-- ══════════════════════════════════════════════════════
-- Cada posición (Operario 1/2/3) tiene su propia lista de opciones.

CREATE TABLE IF NOT EXISTS operarios (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot       integer NOT NULL CHECK (slot IN (1, 2, 3)),
  nombre     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot, nombre)
);

ALTER TABLE operarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operarios_read"  ON operarios;
DROP POLICY IF EXISTS "operarios_write" ON operarios;
CREATE POLICY "operarios_read"  ON operarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "operarios_write" ON operarios FOR ALL    TO authenticated USING (is_admin());

INSERT INTO operarios (slot, nombre) VALUES
  (1, 'Lopez'), (1, 'Agosta'), (1, 'Aguirre'), (1, 'Lucas'), (1, 'Ambos'),
  (2, 'Mendizabal'), (2, 'Echeverria'), (2, 'Garcia'),
  (3, 'Piparo'), (3, 'Picart')
ON CONFLICT (slot, nombre) DO NOTHING;
