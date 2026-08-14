-- ══════════════════════════════════════════════════════
-- Migration 028: Contratistas (opciones editables)
-- ══════════════════════════════════════════════════════
-- Lista de contratistas seleccionable al registrar una OT.
-- Se administra desde Configuración.

CREATE TABLE IF NOT EXISTS contratistas (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre     text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contratistas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contratistas_read"  ON contratistas;
DROP POLICY IF EXISTS "contratistas_write" ON contratistas;
CREATE POLICY "contratistas_read"  ON contratistas FOR SELECT TO authenticated USING (true);
CREATE POLICY "contratistas_write" ON contratistas FOR ALL    TO authenticated USING (is_admin());

INSERT INTO contratistas (nombre) VALUES ('PIPARO'), ('CANDIA')
ON CONFLICT (nombre) DO NOTHING;
