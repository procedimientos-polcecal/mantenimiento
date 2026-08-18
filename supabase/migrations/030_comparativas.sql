-- ══════════════════════════════════════════════════════
-- Migration 030: Comparativas de proveedores (por OS)
-- ══════════════════════════════════════════════════════
-- Por cada OS se cargan varias cotizaciones (una por proveedor). El proveedor
-- elegido se marca con eleccion=true. Se almacenan en una planilla de Google
-- Sheets con UNA PESTAÑA POR SECTOR; esta tabla es el espejo local.

CREATE TABLE IF NOT EXISTS os_comparativas (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  os_number              integer,
  fecha                  date,
  area                   text,
  sector                 text,          -- sector (= pestaña de la planilla)
  equipo_raw             text,
  descripcion            text,
  proveedor              text,
  precio_unitario        text,          -- texto: a veces viene "U$D 286"
  iva                    numeric,
  precio_total           text,          -- texto: a veces viene en USD / con error
  vigencia_hasta         date,
  plazos                 text,
  condiciones_pago       text,
  otras_especificaciones text,
  eleccion               boolean NOT NULL DEFAULT false,
  sheets_tab             text,          -- pestaña (sector) de origen
  sheets_row             integer,
  synced_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheets_tab, sheets_row)
);

CREATE INDEX IF NOT EXISTS comp_os_idx     ON os_comparativas(os_number);
CREATE INDEX IF NOT EXISTS comp_sector_idx ON os_comparativas(sector);

ALTER TABLE os_comparativas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comp_read"  ON os_comparativas;
DROP POLICY IF EXISTS "comp_write" ON os_comparativas;
CREATE POLICY "comp_read"  ON os_comparativas FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp_write" ON os_comparativas FOR ALL    TO authenticated USING (is_admin());
