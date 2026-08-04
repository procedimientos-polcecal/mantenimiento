-- ══════════════════════════════════════════════════════
-- Migration 025: Tipos de equipo (referencia) y componentes por equipo
-- ══════════════════════════════════════════════════════

-- ── Tipos de equipo (hoja TIPO_EQUIPO) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_types (
  tipo_id                   text PRIMARY KEY,
  categoria                 text,
  nombre_tipo               text,
  descripcion_funcion       text,
  accionamiento             text,
  potencia_kw_tipica        text,
  tension_v                 text,
  velocidad_rpm_tipica      text,
  tiene_reductor            text,
  relacion_reduccion        text,
  tipo_correa               text,
  cant_correas              text,
  rodamiento_lado_motor     text,
  rodamiento_lado_carga     text,
  rodamiento_intermedio     text,
  lubricante_tipo           text,
  lubricante_marca_ref      text,
  frecuencia_lubricacion    text,
  tiene_filtro_aceite       text,
  tiene_filtro_aire         text,
  tiene_filtro_hidraulico   text,
  insumo_especial_1         text,
  insumo_especial_2         text,
  temperatura_max_rodamiento_c text,
  vibracion_max_mm_s        text,
  amperaje_nominal_a        text,
  freq_inspeccion_visual    text,
  freq_lubricacion          text,
  freq_revision_mayor       text,
  notas_tecnicas            text
);

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS tipo_id text REFERENCES equipment_types(tipo_id);

ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "types_read"  ON equipment_types;
DROP POLICY IF EXISTS "types_write" ON equipment_types;
CREATE POLICY "types_read"  ON equipment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "types_write" ON equipment_types FOR ALL    TO authenticated USING (is_admin());

-- ── Componentes por equipo (hoja COMPONENTES) ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_components (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id       uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  componente_id      text UNIQUE,                 -- COMP-0001 del origen
  nombre             text NOT NULL,
  categoria          text,
  especificacion     text,
  material           text,
  cantidad           text,
  proveedor_critico  text,
  criticidad         text,
  foto_url           text,
  fecha_relevamiento date,
  relevado_por       text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS components_equipment_idx ON equipment_components(equipment_id);

ALTER TABLE equipment_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "components_read"  ON equipment_components;
DROP POLICY IF EXISTS "components_write" ON equipment_components;
CREATE POLICY "components_read"  ON equipment_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "components_write" ON equipment_components FOR ALL    TO authenticated USING (is_admin());
