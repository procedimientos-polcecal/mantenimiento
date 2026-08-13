-- ══════════════════════════════════════════════════════
-- Migration 026: Órdenes de Servicio (OS)
-- ══════════════════════════════════════════════════════
-- Pedidos de servicio/compra externa por área. Se sincronizan con una
-- planilla de Google Sheets que tiene una pestaña por área.

CREATE TABLE IF NOT EXISTS ordenes_servicio (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  os_number          integer UNIQUE,
  fecha              date,
  area               text,
  sector_raw         text,
  sector_id          uuid REFERENCES sectors(id),
  equipo_raw         text,
  equipo_code        text,
  equipment_id       uuid REFERENCES equipment(id),
  descripcion        text,
  fecha_requerimiento date,
  detalle_extra      text,
  imagen             text,
  prioridad          text,
  empresa            text,
  comparativa        text,
  proveedor_elegido  text,
  estado             text,
  cuit               text,
  tiene_orden_compra text,
  costo              numeric,
  fecha_realizacion  date,
  observaciones      text,
  app_created        boolean NOT NULL DEFAULT false,
  sheets_tab         text,          -- pestaña (área) de origen
  sheets_row         integer,
  created_by         uuid REFERENCES app_users(id),
  synced_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_area_idx      ON ordenes_servicio(area);
CREATE INDEX IF NOT EXISTS os_estado_idx    ON ordenes_servicio(estado);
CREATE INDEX IF NOT EXISTS os_equipment_idx ON ordenes_servicio(equipment_id);

ALTER TABLE ordenes_servicio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "os_read"  ON ordenes_servicio;
DROP POLICY IF EXISTS "os_write" ON ordenes_servicio;
CREATE POLICY "os_read"  ON ordenes_servicio FOR SELECT TO authenticated USING (true);
CREATE POLICY "os_write" ON ordenes_servicio FOR ALL    TO authenticated USING (is_admin());
