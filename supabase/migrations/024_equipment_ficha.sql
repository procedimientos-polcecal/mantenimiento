-- ══════════════════════════════════════════════════════
-- Migration 024: Ficha técnica del equipo (BD Equipos v3)
-- ══════════════════════════════════════════════════════
-- Campos técnicos por equipo, basados en la hoja EQUIPOS.

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS tipo_equipo              text,
  ADD COLUMN IF NOT EXISTS descripcion_proceso      text,
  ADD COLUMN IF NOT EXISTS marca                    text,
  ADD COLUMN IF NOT EXISTS modelo                   text,
  ADD COLUMN IF NOT EXISTS nro_serie                text,
  ADD COLUMN IF NOT EXISTS anio_fabricacion         integer,
  ADD COLUMN IF NOT EXISTS anio_instalacion         integer,
  ADD COLUMN IF NOT EXISTS tension_v                text,
  ADD COLUMN IF NOT EXISTS intensidad_nominal_a     numeric,
  ADD COLUMN IF NOT EXISTS rpm_motor                integer,
  ADD COLUMN IF NOT EXISTS fp_cos_phi               numeric,
  ADD COLUMN IF NOT EXISTS relacion_reduccion       text,
  ADD COLUMN IF NOT EXISTS rpm_salida               integer,
  ADD COLUMN IF NOT EXISTS rodamiento_motor_de      text,
  ADD COLUMN IF NOT EXISTS rodamiento_motor_nde     text,
  ADD COLUMN IF NOT EXISTS rodamiento_carga         text,
  ADD COLUMN IF NOT EXISTS rodamiento_otro          text,
  ADD COLUMN IF NOT EXISTS ubicacion_fisica         text,
  ADD COLUMN IF NOT EXISTS nivel_altura_m           numeric,
  ADD COLUMN IF NOT EXISTS origen_equipo            text,
  ADD COLUMN IF NOT EXISTS horas_marcha             numeric,
  ADD COLUMN IF NOT EXISTS proveedor_repuesto_critico text,
  ADD COLUMN IF NOT EXISTS fecha_ultimo_relevamiento  date,
  ADD COLUMN IF NOT EXISTS relevado_por             text,
  ADD COLUMN IF NOT EXISTS foto_registro_url        text;
