-- ═══════════════════════════════════════════════════════════════
-- DELTA DE INTEGRACIÓN — a aplicar sobre el ERP (módulo mantenimiento)
-- Tablas/columnas que esta app tiene y el ERP todavía no.
-- FKs re-apuntadas a: equipos / sectores / usuarios / ordenes_trabajo.
--
-- ⚠ RLS QUITADA a propósito: definirla según el patrón del ERP
--   (usuario_modulos WHERE modulo='mantenimiento' × nivel_acceso).
--   Ver INTEGRACION.md §7 (permisos).
-- ⚠ 'OS aparte': se crean ordenes_servicio / os_comparativas propias.
-- ═══════════════════════════════════════════════════════════════


-- ── 017_avisos ─────────────────────────────────────────────
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
  sector_id     uuid references sectores(id),
  equipo_raw    text,
  equipo_code   text,
  equipment_id  uuid references equipos(id),
  descripcion   text,
  urgencia      text,                                 -- "🟡 Media", "🔴 Alta", etc.
  quien_aviso   text,
  ot_asignada   text,                                 -- "si" / N° OT / vacío
  work_order_id uuid references ordenes_trabajo(id) ON DELETE SET NULL,
  observaciones text,
  app_created   boolean NOT NULL DEFAULT false,
  sheets_row    integer,
  created_by    uuid references usuarios(id),
  synced_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avisos_equipment_idx ON avisos(equipment_id);
CREATE INDEX IF NOT EXISTS avisos_wo_idx        ON avisos(work_order_id);
CREATE INDEX IF NOT EXISTS avisos_urgencia_idx  ON avisos(urgencia);

-- RLS


-- ── 018_ot_frecuencia ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 018: Frecuencia, próxima fecha y fotos en OTs
-- ══════════════════════════════════════════════════════
-- Campos rescatados del viejo formulario de mantenimiento, ahora en la OT.

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS frecuencia       text,     -- MENSUAL, SEMANAL, etc. (o null)
  ADD COLUMN IF NOT EXISTS proxima_fecha    date,
  ADD COLUMN IF NOT EXISTS reference_photos text[];


-- ── 019_avisos_photos ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 019: Fotos de referencia en avisos
-- ══════════════════════════════════════════════════════
-- Las fotos se guardan en el storage de Supabase (no en Google).

ALTER TABLE avisos
  ADD COLUMN IF NOT EXISTS reference_photos text[];


-- ── 021_equipment_parts ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 021: Repuestos por equipo (catálogo)
-- ══════════════════════════════════════════════════════
-- Qué repuestos puede consumir cada equipo. Después se pueden
-- asignar a una OT o a un Aviso de ese equipo.

CREATE TABLE IF NOT EXISTS equipment_parts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id  uuid NOT NULL references equipos(id) ON DELETE CASCADE,
  name          text NOT NULL,
  code          text,              -- código de repuesto (opcional)
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parts_equipment_idx ON equipment_parts(equipment_id);


-- Los avisos también pueden llevar repuestos asignados (como las OTs)
ALTER TABLE avisos ADD COLUMN IF NOT EXISTS repuesto text;


-- ── 022_produccion ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 022: Planificación de producción semanal
-- ══════════════════════════════════════════════════════
-- Por cada semana y sector se guarda el estado de producción de los 7 días
-- (Lun..Dom): EN_PRODUCCION / PARCIAL / LIBRE. Sirve para ver qué sectores
-- quedan libres y decidir dónde meter reparaciones sin frenar el despacho.

CREATE TABLE IF NOT EXISTS production_plan (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start  date NOT NULL,                 -- lunes de la semana
  sector_id   uuid NOT NULL references sectores(id) ON DELETE CASCADE,
  days        jsonb NOT NULL DEFAULT '["LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE"]',
  note        text,
  updated_by  uuid references usuarios(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, sector_id)
);

CREATE INDEX IF NOT EXISTS production_week_idx ON production_plan(week_start);



-- ── 023_ot_orden ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 023: Orden manual de OTs (priorización)
-- ══════════════════════════════════════════════════════
-- Permite arrastrar las OTs para fijar un orden propio, además del
-- orden automático por prioridad/estado/criticidad/antigüedad.

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS orden_manual integer;

CREATE INDEX IF NOT EXISTS wo_orden_manual_idx ON ordenes_trabajo(orden_manual);


-- ── 024_equipment_ficha ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 024: Ficha técnica del equipo (BD Equipos v3)
-- ══════════════════════════════════════════════════════
-- Campos técnicos por equipo, basados en la hoja EQUIPOS.

ALTER TABLE equipos
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


-- ── 025_tipos_componentes ─────────────────────────────────────────────
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

ALTER TABLE equipos ADD COLUMN IF NOT EXISTS tipo_id text REFERENCES equipment_types(tipo_id);


-- ── Componentes por equipo (hoja COMPONENTES) ───────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_components (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id       uuid NOT NULL references equipos(id) ON DELETE CASCADE,
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



-- ── 026_ordenes_servicio ─────────────────────────────────────────────
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
  sector_id          uuid references sectores(id),
  equipo_raw         text,
  equipo_code        text,
  equipment_id       uuid references equipos(id),
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
  created_by         uuid references usuarios(id),
  synced_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS os_area_idx      ON ordenes_servicio(area);
CREATE INDEX IF NOT EXISTS os_estado_idx    ON ordenes_servicio(estado);
CREATE INDEX IF NOT EXISTS os_equipment_idx ON ordenes_servicio(equipment_id);



-- ── 027_wo_parts ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 027: Repuestos necesarios por OT
-- ══════════════════════════════════════════════════════
-- Lista de repuestos que hacen falta para realizar una OT.
-- La disponibilidad se consulta EN VIVO contra la planilla de inventario.

CREATE TABLE IF NOT EXISTS work_order_parts (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL references ordenes_trabajo(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  codigo        text,
  cantidad      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wo_parts_idx ON work_order_parts(work_order_id);



-- ── 028_contratistas ─────────────────────────────────────────────
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


INSERT INTO contratistas (nombre) VALUES ('PIPARO'), ('CANDIA')
ON CONFLICT (nombre) DO NOTHING;


-- ── 029_operarios ─────────────────────────────────────────────
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


INSERT INTO operarios (slot, nombre) VALUES
  (1, 'Lopez'), (1, 'Agosta'), (1, 'Aguirre'), (1, 'Lucas'), (1, 'Ambos'),
  (2, 'Mendizabal'), (2, 'Echeverria'), (2, 'Garcia'),
  (3, 'Piparo'), (3, 'Picart')
ON CONFLICT (slot, nombre) DO NOTHING;


-- ── 030_comparativas ─────────────────────────────────────────────
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



-- ── 031_os_fecha_pedido ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 031: Seguimiento de OS — fecha de pedido
-- ══════════════════════════════════════════════════════
-- Se registra cuándo se pide el servicio (fecha_pedido) y cuándo se recibe/
-- termina (se reutiliza fecha_realizacion). Permite ver la demora.

ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS fecha_pedido date;


-- ── 033_produccion_extra ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 033: Planificación de producción — info extra
-- ══════════════════════════════════════════════════════
-- Por día (7): motivo de parada y turnos. Por sector/semana: responsable.

ALTER TABLE production_plan
  ADD COLUMN IF NOT EXISTS motivos     jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS turnos      jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS responsable text;


-- ── 036_ot_requiere_parada_sector ─────────────────────────────────────────────
-- ══════════════════════════════════════════════════════
-- Migration 036: OT — "requiere parar el sector"
-- ══════════════════════════════════════════════════════
-- Marca en la OT si el trabajo necesita que se pare el sector. Se muestra
-- como alerta (mientras la OT esté pendiente) en el listado de OT, en la
-- planificación de producción y en las tarjetas de sector del dashboard.

ALTER TABLE ordenes_trabajo
  ADD COLUMN IF NOT EXISTS requiere_parada_sector boolean NOT NULL DEFAULT false;

