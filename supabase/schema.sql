-- ═══════════════════════════════════════════════════════════════
-- SCHEMA CONSOLIDADO — app de Mantenimiento (migraciones 001..036)
-- Generado por concatenación de supabase/migrations/*.sql en orden.
-- OJO: 'ALTER TYPE ... ADD VALUE' (032) puede requerir correrse por
-- separado si el editor lo envuelve en transacción. Si falla ahí,
-- corré esa línea aparte y seguí.
-- ═══════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════
-- ║ 001_initial_schema.sql
-- ╚══════════════════════════════════════════════════════════════
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Plants
create table plants (
  id uuid primary key default uuid_generate_v4(),
  name text not null check (name in ('POLCECAL', 'POLYSAN', 'AMBOS')),
  created_at timestamptz not null default now()
);

insert into plants (name) values ('POLCECAL'), ('POLYSAN'), ('AMBOS');

-- Sectors
create table sectors (
  id uuid primary key default uuid_generate_v4(),
  plant_id uuid not null references plants(id),
  name text not null,
  created_at timestamptz not null default now()
);

-- Equipment status and criticality enums
create type equipment_status as enum (
  'OPERATIVO', 'EN_MANTENIMIENTO', 'EN_REPARACION',
  'STANDBY', 'FUERA_DE_SERVICIO', 'DADO_DE_BAJA'
);

create type criticality_level as enum ('ALTA', 'MEDIA', 'BAJA');

-- Equipment
create table equipment (
  id uuid primary key default uuid_generate_v4(),
  sector_id uuid not null references sectors(id),
  name text not null,
  code text not null unique,
  power_kw numeric(10,2),
  description text,
  status equipment_status not null default 'OPERATIVO',
  criticality criticality_level not null default 'MEDIA',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users (extends Supabase auth.users)
create type user_role as enum ('gerente', 'administrador', 'operario', 'admin_sistema');

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role user_role not null default 'operario',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Maintenance types
create type maintenance_type as enum (
  'Lubricacion', 'Inspeccion', 'Limpieza',
  'Ajuste', 'Reemplazo', 'Revision_electrica', 'Otro'
);

-- Equipment checklists
create table equipment_checklists (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id),
  maintenance_type maintenance_type not null,
  version integer not null default 1,
  items jsonb not null default '[]'::jsonb,
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

-- Maintenance schedules
create type schedule_type as enum ('fixed_interval', 'specific_date');
create type schedule_status as enum ('active', 'paused', 'cancelled');

create table maintenance_schedules (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id),
  checklist_id uuid not null references equipment_checklists(id),
  maintenance_type maintenance_type not null,
  schedule_type schedule_type not null,
  interval_days integer,
  next_date date not null,
  assigned_to uuid not null references app_users(id),
  status schedule_status not null default 'active',
  created_by uuid not null references app_users(id),
  created_at timestamptz not null default now()
);

-- Maintenance executions
create type execution_status as enum ('pending', 'in_progress', 'completed', 'not_done');

create table maintenance_executions (
  id uuid primary key default uuid_generate_v4(),
  schedule_id uuid not null references maintenance_schedules(id),
  equipment_id uuid not null references equipment(id),
  assigned_to uuid not null references app_users(id),
  started_at timestamptz,
  completed_at timestamptz,
  status execution_status not null default 'pending',
  checklist_responses jsonb not null default '[]'::jsonb,
  notes_start text,
  notes_end text,
  photos_start text[] not null default '{}',
  photos_end text[] not null default '{}',
  drive_folder_url text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Equipment status log
create table equipment_status_log (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id),
  old_status equipment_status,
  new_status equipment_status not null,
  changed_by uuid not null references app_users(id),
  changed_at timestamptz not null default now(),
  reason text
);

-- Auto-update updated_at on equipment
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger equipment_updated_at
  before update on equipment
  for each row execute function update_updated_at();

-- Indexes for performance
create index on equipment(sector_id);
create index on equipment(status);
create index on equipment(code);
create index on maintenance_schedules(equipment_id);
create index on maintenance_schedules(assigned_to);
create index on maintenance_schedules(next_date);
create index on maintenance_schedules(status);
create index on maintenance_executions(schedule_id);
create index on maintenance_executions(assigned_to);
create index on maintenance_executions(status);
create index on equipment_status_log(equipment_id);

-- Row Level Security
alter table plants enable row level security;
alter table sectors enable row level security;
alter table equipment enable row level security;
alter table app_users enable row level security;
alter table equipment_checklists enable row level security;
alter table maintenance_schedules enable row level security;
alter table maintenance_executions enable row level security;
alter table equipment_status_log enable row level security;

-- RLS policies: authenticated users can read everything
create policy "authenticated read plants" on plants for select to authenticated using (true);
create policy "authenticated read sectors" on sectors for select to authenticated using (true);
create policy "authenticated read equipment" on equipment for select to authenticated using (true);
create policy "authenticated read app_users" on app_users for select to authenticated using (true);
create policy "authenticated read checklists" on equipment_checklists for select to authenticated using (true);
create policy "authenticated read schedules" on maintenance_schedules for select to authenticated using (true);
create policy "authenticated read executions" on maintenance_executions for select to authenticated using (true);
create policy "authenticated read status_log" on equipment_status_log for select to authenticated using (true);

-- RLS policies: authenticated users can write (role enforcement in app layer)
create policy "authenticated write equipment" on equipment for all to authenticated using (true);
create policy "authenticated write checklists" on equipment_checklists for all to authenticated using (true);
create policy "authenticated write schedules" on maintenance_schedules for all to authenticated using (true);
create policy "authenticated write executions" on maintenance_executions for all to authenticated using (true);
create policy "authenticated write status_log" on equipment_status_log for all to authenticated using (true);
create policy "authenticated write app_users" on app_users for all to authenticated using (true);


-- ╔══════════════════════════════════════════════════════════════
-- ║ 002_seed_equipment.sql
-- ╚══════════════════════════════════════════════════════════════
﻿-- Sectors
INSERT INTO sectors (id, plant_id, name) VALUES
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Trituración1'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Trituración2'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Trituración3'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Calcinación'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Hidratación'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Moliendacal'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLCECAL'), 'Despachocal'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Filler1'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Despachofiller1'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Filler2'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Despachofiller2'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Planta02'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'POLYSAN'), 'Filler3'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'AMBOS'), 'Compresores'),
  (uuid_generate_v4(), (SELECT id FROM plants WHERE name = 'AMBOS'), 'Equiposmoviles');
-- Equipment
INSERT INTO equipment (sector_id, name, code, power_kw, description, status, criticality, notes) VALUES
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Acarreador de placas', 'PO-A1-01', 11, 'Alimenta piedra bruta desde la tolva al triturador de mandíbulas.', 'OPERATIVO', 'MEDIA', 'Procesa caliza, dolomita y chocolata.'),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Rompedora de mandibulas', 'PO-A1-02', 55, 'Tritura piedra de gran tamaño y la descarga a la cinta', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 0', 'PO-A1-03', NULL, 'Recibe material desde la rompemandíbulas y lo lleva hacia la cinta', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-A1-04', 75, 'Transporta el material triturado hacia la cinta 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-A1-05', 75, 'Eleva el material hasta la zaranda vibratoria 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 1', 'PO-A1-06', 185, 'Clasifica el material por tamaño: grueso (→ RC1) y fino (→ producto o retrituración).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Rompedora de cono', 'PO-A1-07', 55, 'Tritura el material grueso proveniente de la zaranda 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-A1-08', 55, 'Recibe el material de la rompedora de cono  y lo transporta hacia CT4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 4', 'PO-A1-09', 55, 'Conduce material retriturado hacia CT5.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 5', 'PO-A1-10', 55, 'Conduce el material retriturado hacia CT2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 6', 'PO-A1-11', 55, 'Lleva piedra 2 (35–50 mm) desde la zaranda 1 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 7', 'PO-A1-12', 55, 'Conduce piedra 3 (20–35 mm) desde la zaranda 1 al acopio de producto.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 8', 'PO-A1-13', 55, 'Transporta fracción 0–20 mm desde zaranda 1 a zaranda 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 2', 'PO-A1-14', 55, 'Clasifica el material intermedio (10-20mm, binder, arena).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 9', 'PO-A1-15', 22, 'Lleva material (10-20 mm) desde zaranda 2 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 10', 'PO-A1-16', 4, 'Lleva binder (6-10 mm) desde zaranda 2 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 11', 'PO-A1-17', 4, 'Lleva arena (0-6 mm) desde zaranda 2 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador', 'PO-A1-18', 22, '-', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 12', 'PO-A1-19', 4, 'Recibe material (binder, arena sucia, etc) desde la tolva.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 13', 'PO-A1-20', 4, 'Transporta el material desde CT12 hacia la zaranda de alta frecuencia.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 3', 'PO-A1-21', 55, 'Realiza la clasificación final de finos (arena 0–5 mm y arena 5-10 mm).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 14', 'PO-A1-22', 4, 'Lleva arena (5-10 mm) desde zaranda 3 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 15', 'PO-A1-23', 4, 'Lleva arena (0-5 mm) desde zaranda 3 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Alimentador vibratorio', 'PO-A2-01', NULL, 'Regula y dosifica el ingreso de piedra desde la tolva hacia la rompemandíbulas.', 'OPERATIVO', 'MEDIA', 'Procesa dolomita.'),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Rompedor de mandibulas', 'PO-A2-02', NULL, 'Tritura el material grueso mediante compresión para reducir su gran tamaño.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-A2-03', NULL, 'Transporta el material triturado desde la mandíbula hacia la CT2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-A2-04', NULL, 'Lleva piedra 1 (0-200 mm) al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-A2-05', NULL, 'Transporta el material triturado desde el alimentador hacia la zaranda vibratoria.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 1', 'PO-A2-06', NULL, 'Realiza la clasificación de piedra 2 y piedra 3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 4', 'PO-A2-07', NULL, 'Lleva piedra 2 (25-80 mm) desde zaranda 1 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 5', 'PO-A2-08', NULL, 'Lleva piedra 3 (0-25 mm) desde zaranda 1 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Alimentador vibratorio', 'PO-A3-01', 11, 'Regula y dosifica el ingreso de piedra desde la tolva hacia la rompemandíbulas.', 'OPERATIVO', 'MEDIA', 'Procesa caliza y chocolata.'),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Rompedor de mandibulas', 'PO-A3-02', 55, 'Tritura el material grueso mediante compresión para reducir su gran tamaño.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-A3-03', 75, 'Recibe el material de la rompedora de mandíbulas y lo transporta  CT2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-A3-04', 75, 'Transporta el material triturado a la zaranda vibratoria 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 1', 'PO-A3-05', 9, 'Realiza la clasificación de los gruesos (binder, piedra 10-40mm, o +40mm)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-A3-06', 75, 'Recibe material +40mm de zaranda vibratoria 1 y transporta a rompedor de impacto.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Rompedor de impacto', 'PO-A3-07', 110, 'Recibe material +35mm y +40mm y lo tritura mediante impacto de alta velocidad.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 4', 'PO-A3-08', 55, 'Lleva piedra (0-40 mm) desde rompedor de impacto al acopio correspondiente.', 'OPERATIVO', 'MEDIA', 'Producto utilizado para filler.'),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 5', 'PO-A3-09', 55, 'Lleva piedra (10-40 mm) desde zaranda 1 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 6', 'PO-A3-10', 55, 'Lleva binder (0-10 mm) desde zaranda 1 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 7', 'PO-A3-11', 55, 'Recibe el material fino del alimentador vibratorio y lo transporta a CT8.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 8', 'PO-A3-12', 55, 'Transporta el material triturado hacia la zaranda vibratoria 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Zaranda vibratoria 2', 'PO-A3-13', 9, 'Realiza la clasificación de los gruesos (estabilizador, piedra 7-25mm, o +25mm)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 9', 'PO-A3-14', 55, 'Recibe material +35 mm de zaranda vibratoria 2 y transporta a rompedor de impacto.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 10', 'PO-A3-15', 55, 'Lleva piedra (7-35 mm) desde zaranda 2 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', 'Producto utilizado para filler.'),
  ((SELECT id FROM sectors WHERE name = 'Trituración3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 11', 'PO-A3-16', 55, 'Lleva estabilizador (0-7 mm) desde zaranda 2 al acopio correspondiente.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-B1-01', 55, 'Transporta el carbón desde la tolva de descarga hacia la tolva de carbón, donde se pesa la cantidad necesaria.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Tolva de piedra', 'PO-B1-02', NULL, 'Almacena temporalmente la piedra antes de ingresar temporalmente al sistema de alimentación de hornos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Tolva de carbón', 'PO-B1-03', NULL, 'Contiene el carbón utilizado como combustible en el proceso de calcinación.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Alimentador hornos', 'PO-B1-04', 10, 'Dosifica y alimenta de forma controlada la mezcla de piedra y corbón hacia los hornos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 1', 'PO-B1-05', NULL, 'Revestimiento de alta resistencia térmica que protege el interior del horno.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 1', 'PO-B1-06', 22, 'Asegura la descarga continua de cal viva desde el horno 1 a la cadena de arrastre 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 1', 'PO-B1-07', 55, 'Extrae la cal viva del horno 1 y lo transfiere a la CT5.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre 2, 3 y 5.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 1', 'PO-B1-08', 185, 'Inyecta aire para la combustión de horno 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 2', 'PO-B1-09', NULL, 'Revestimiento de alta resistencia térmica que protege el interior del horno.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 2', 'PO-B1-10', 22, 'Asegura la descarga continua de cal viva desde el horno 2 a la cadena de arrastre 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 2', 'PO-B1-11', 55, 'Extrae la cal viva del horno 2 y lo transfiere a la CT3.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre, 1, 3 y 5.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 2', 'PO-B1-12', 15, 'Inyecta aire para la combustión de horno 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 3', 'PO-B1-13', NULL, 'Revestimiento de alta resistencia térmica que protege el interior del horno.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 3', 'PO-B1-14', 22, 'Asegura la descarga continua de cal viva desde el horno 3 a la cadena de arrastre 3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 3', 'PO-B1-15', 55, 'Extrae la cal viva del horno 3 y lo transfiere a la CT3.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre, 1, 2 y 5.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 3', 'PO-B1-16', 15, 'Inyecta aire para la combustión de horno 3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 4', 'PO-B1-17', NULL, 'Revestimiento de alta resistencia térmica que protege el interior del horno.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 4', 'PO-B1-18', 22, 'Asegura la descarga continua de cal viva desde el horno 4 a la cadena de arrastre 4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 4', 'PO-B1-19', 75, 'Extrae la cal viva del horno 4 y lo transfiere a la CT2.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre 6.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 4', 'PO-B1-20', 15, 'Inyecta aire para la combustión de horno 4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 5', 'PO-B1-21', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 5', 'PO-B1-22', 22, 'Asegura la descarga continua de cal viva desde el horno 5 a la cadena de arrastre 5.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 5', 'PO-B1-23', 55, 'Extrae la cal viva del horno 5 y lo transfiere a la CT2.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre 1, 2 y 3.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 5', 'PO-B1-24', 15, 'Inyecta aire para la combustión de horno 5.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Refractario 6', 'PO-B1-25', NULL, 'Revestimiento de alta resistencia térmica que protege el interior del horno.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Vibrador 6', 'PO-B1-26', 22, 'Asegura la descarga continua de cal viva desde el horno 6 a la cadena de arrastre 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cadena de arrastre 6', 'PO-B1-27', 55, 'Extrae la cal viva del horno 6 y lo transfiere a la CT2.', 'OPERATIVO', 'MEDIA', 'Igual a cadena de arrastre 4.'),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador 6', 'PO-B1-28', 15, 'Inyecta aire para la combustión de horno 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-B1-29', NULL, 'Transporta la cal viva del horno 4, 5 y 6 a la CT3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-B1-30', NULL, 'Transporta la cal viva del horno 2 y 3, y de la CT2, a la CT4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 4', 'PO-B1-31', NULL, 'Transporta la cal viva de la CT3 al elevador 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 5', 'PO-B1-32', NULL, 'Transporta la cal viva del horno 1 al elevador 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Calcinación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Elevador', 'PO-B1-33', 15, 'Eleva el material descargado de los hornos hacia el almacenamiento.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-C1-01', 22, 'Translada el material de la tolva 1  a la CT3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-C1-02', 22, 'Translada el material de la tolva 2 a CT3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-C1-03', 22, 'Transalada el material de CT1 y CT2 a molino de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Molinos a martillos', 'PO-C1-04', 55, 'Muele el material hasta granulometría fina mediante impacto de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Bomba centrifuga', 'PO-C1-05', 55, '-', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Elevador', 'PO-C1-06', 185, 'Eleva el material desde el molino de martillos al sin fin 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Alimentador hidratadora', 'PO-C1-07', 4, 'Dosifica  la cal viva y el agua hacia el sistema de hidratación.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin doble', 'PO-C1-08', 15, 'Transporta la cal viva mientras incorpora agua de manera uniforme, hidratando la cal.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin', 'PO-C1-09', NULL, 'Recibe la cal hidratada del sin fin doble y lo distribuye en los silos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Hidratación' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Bomba sumergible', 'PO-C1-10', NULL, 'Eleva el agua desde la cantera hacia el tanque de almacenamiento de la misma.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 1', 'PO-D1-01', NULL, 'Recibe el material del silo 1 y lo transporta al sin fin 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 2', 'PO-D1-02', NULL, 'Recibe el material del silo 3 y lo transporta al sin fin 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 3', 'PO-D1-03', NULL, 'Recibe el material del silo 5 y lo transporta al sin fin 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 4', 'PO-D1-04', NULL, 'Recibe el material del silo 6 y lo transporta al sin fin 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 5', 'PO-D1-05', NULL, 'Recibe el material del silo 7 y lo transporta al sin fin 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 6', 'PO-D1-06', NULL, 'Recibe el material de los sin fin anteriores y lo transporta al elevador 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Elevador 1', 'PO-D1-07', NULL, 'Eleva el material desde el sin fin 6 hacia el separador dinámico 7 o el sin fin 7.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Separador dinámico 1', 'PO-D1-08', NULL, 'Separa los finos (va para producto terminado) de los gruesos (va para sin fin 8 para retrituración).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 7', 'PO-D1-09', NULL, 'Recibe el material del elevador 1 y lo transporta a separador dinámico 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Separador dinámico 2', 'PO-D1-10', NULL, 'Separa los finos (va para producto terminado) de los gruesos (va para tolva de pesaje para retrituración).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 8', 'PO-D1-11', NULL, 'Recibe el material del separador dinámico 1 y lo transporta a tolva de pesaje.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Tolva de pesaje', 'PO-D1-12', NULL, 'Acumula y dosifica el material controlando su  peso.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 9', 'PO-D1-13', NULL, 'Recibe el material pesado de la tolva y lo transporta a molino de bolas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Molino de bolas', 'PO-D1-14', NULL, 'Muele el material hasta granulometría más fina mediante golpe de bolas internas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 10', 'PO-D1-15', NULL, 'Recibe el material del molino de bolas y lo transporta a sin fin 11.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 11', 'PO-D1-16', NULL, 'Recibe el matrial del sin fin 11 y lo transporta al elevador 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Elevador 2', 'PO-D1-17', NULL, 'Eleva el material desde separadores dinámicos hacia el despacho (granel o bolsas) o silo 1 y 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 12', 'PO-D1-18', NULL, 'Recibe el material del silo 2 y lo transporta a elevador 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Elevador 3', 'PO-D1-19', NULL, 'Eleva el material desde separadores dinámicos hacia silos 8 y 9 de planta de filler 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Filtro de manga', 'PO-D1-20', NULL, 'Separa el polvo del aire mediante mangas filtrantes, reteniendo el material fino y liberando aire impio.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Ventilador', 'PO-D1-21', NULL, 'Aporta el flujo de aire necesario para mover el aire cagrado de polvo hacia el filtro.', 'OPERATIVO', 'MEDIA', 'Perteneciente al filtro de manga.'),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Válvula rotativa', 'PO-D1-22', NULL, 'Descarga el material retenido en el filtro de manera continua y controlada.', 'OPERATIVO', 'MEDIA', 'Perteneciente al filtro de manga.'),
  ((SELECT id FROM sectors WHERE name = 'Moliendacal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Fluidor', 'PO-D1-23', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Embolsadora', 'PO-D2-01', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 1', 'PO-D2-02', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 2', 'PO-D2-03', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 3', 'PO-D2-04', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Cinta transportadora 4', 'PO-D2-05', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 1', 'PO-D2-06', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachocal' AND plant_id = (SELECT id FROM plants WHERE name = 'POLCECAL')), 'Sin fin 2', 'PO-D2-07', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de alimentación', 'PY-A1-01', NULL, 'Recibe el material de entrada y regula su descarga hacia la cadena de arrastre.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cadena de arraste', 'PY-A1-02', NULL, 'Transporta el material desde la tolva hasta la primera cinta transportadora.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 1', 'PY-A1-03', 22, 'Transporta el material desde la cadena de arrastre hacia la CT2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 2', 'PY-A1-04', 22, 'Transporta el material desde CT1 hacia el molino a martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Rompedora a martillos', 'PY-A1-05', 55, 'Muele el material hasta granulometría fina mediante impacto de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 1', 'PY-A1-06', 11, 'Eleva el material desde el molino a martillos al separador dinámico.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Separador dinámico', 'PY-A1-07', 15, 'Separa los finos (va para elevador 2) de los gruesos (va para dos cámaras del molino de bolas).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Molino de bolas', 'PY-A1-08', 110, 'Realiza la molienda fina del material por impacto y fricción en un tambor giratorio con bolas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin', 'PY-A1-09', 4, 'Recibe el 50% material grueso del separador y lo envía a una de las cámaras del molino de bolas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ciclón desempolvador', 'PY-A1-10', 11, 'Separa el polvo del aire por acción centrífuga, recuperando el material fino.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador 1', 'PY-A1-11', NULL, 'Toma el aire filtrado del ciclón y lo ingresa al molino, cerrando el ciclo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Filtro de mangas', 'PY-A1-12', NULL, 'Separa el polvo del aire a través de mangas filtrantes, recuperando el material retenido.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvulas rotativas', 'PY-A1-13', NULL, 'Regula la descarga de material sólido entre el filtro de mangas y el sin fin.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador 2', 'PY-A1-14', NULL, 'Genera la aspiración necesaria para el funcionamiento del filtro de mangas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 2', 'PY-A1-15', NULL, 'Eleva el producto terminado hacia la separación en los silos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 1', 'PY-A1-16', NULL, 'Controla el flujo de material con compuerta neumática en la salida del elevador 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 2', 'PY-A1-17', NULL, 'Controla el flujo de material con compuerta neumática en la entrada del silo 3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 3', 'PY-A1-18', NULL, 'Controla el flujo de material con compuerta neumática en el fluidor.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 4', 'PY-A1-19', NULL, 'Controla el flujo de material con compuerta neumática en la entrada del silo 4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 5', 'PY-A1-20', NULL, 'Controla el flujo de material con compuerta neumática en el fluidor.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 6', 'PY-A1-21', NULL, 'Controla el flujo de material con compuerta neumática en la entrada del silo 5.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 1', 'PY-A2-01', NULL, 'Regula la descarga del material del silo 1 al fluidor 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 2', 'PY-A2-02', NULL, 'Regula la descarga del material del silo 2 al fluidor 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 3', 'PY-A2-03', NULL, 'Regula la descarga del material del silo 3 al fluidor 3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 4', 'PY-A2-04', NULL, 'Regula la descarga del material del silo 4 al fluidor 4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 5', 'PY-A2-05', NULL, 'Regula la descarga del material del silo 5 al fluidor 5.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 6', 'PY-A2-06', NULL, 'Regula la descarga del material del silo 6 al fluidor 6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 1', 'PY-A2-07', NULL, 'Inyecta aire y transporta el material del silo 1 y 2 al fluidor 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 2', 'PY-A2-08', NULL, 'Inyecta aire y transporta el material del silo 1, 2 y 3 al elevador.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 3', 'PY-A2-09', NULL, 'Inyecta aire y transporta el material del silo 4 al elevador.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 4', 'PY-A2-10', NULL, 'Inyecta aire y transporta el material del silo 5 al elevador.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 5', 'PY-A2-11', NULL, 'Inyecta aire y transporta el material del silo 6 al elevador.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 1', 'PY-A2-12', NULL, 'Eleva el material hacia la carga de camiones.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 6', 'PY-A2-13', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 7', 'PY-A2-14', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 2', 'PY-A2-15', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de embolsadora', 'PY-A2-16', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Embolsadora', 'PY-A2-17', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 1', 'PY-A2-18', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 2', 'PY-A2-19', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 3', 'PY-A2-20', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin retorno', 'PY-A2-21', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 8', 'PY-A2-22', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Filtro de mangas', 'PY-A2-23', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller1' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador', 'PY-A2-24', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de alimentación 1', 'PY-B1-01', NULL, 'Recibe el material de entrada y regula su descarga hacia la CT1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 1', 'PY-B1-02', NULL, 'Recibe el material de la tolva de alimentación 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 2', 'PY-B1-03', NULL, 'Transporta el material desde la CT1 hacia la tolva de almentación 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de alimentación 2', 'PY-B1-04', NULL, 'Recibe el material de la CT2 y regula su descarga hacia la CT3.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 3', 'PY-B1-05', NULL, 'Transporta el material desde la tolva de alimentación 2 hacia el molino a martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Molino a martillos', 'PY-B1-06', NULL, 'Muele el material hasta granulometría fina mediante impacto de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 4', 'PY-B1-07', NULL, 'Transporta el material desde el molino a martillos hacia la válvula rotativa del molino vertical.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 1', 'PY-B1-08', NULL, 'Regula la descarga de material sólido entre la CT3 y el molino vertical.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Molino vertical', 'PY-B1-09', NULL, 'Realiza la molienda fina del material.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Separador estático', 'PY-B1-10', NULL, 'Separa los finos (va para el ciclón) de los gruesos (se queda en el molino hasta volverse fino).', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador 1', 'PY-B1-11', NULL, 'Toma el aire filtrado del ciclón y lo ingresa al molino, cerrando el ciclo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ciclón desempolvador', 'PY-B1-12', NULL, 'Separa el polvo del aire por acción centrífuga, recuperando el material fino.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 2', 'PY-B1-13', NULL, 'Regula la descarga de material sólido entre el ciclón y el fluidor.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 1', 'PY-B1-14', NULL, 'Inyecta aire y permitir el transporte del material desde el ciclón y el filtro de mangas hacia el elevador .', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Filtro de mangas', 'PY-B1-15', NULL, 'Separa el polvo del aire a través de mangas filtrantes, recuperando el material retenido.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin', 'PY-B1-16', NULL, 'Recibe el material del filtro de mangas y lo transporta hacia la válvula rotativa del mismo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 3', 'PY-B1-17', NULL, 'Regula la descarga de material sólido entre el filtro de mangas y el fluidor.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador 2', 'PY-B1-18', NULL, 'Genera la aspiración necesaria para el funcionamiento del filtro de mangas.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ventilador 3', 'PY-B1-19', NULL, 'Suministra el flujo de aire al sistema de fluidificación del silo, permitiendo la descarga uniforme del material.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador', 'PY-B1-20', NULL, 'Eleva el material desde el fluidor 1 hacia el fluidor 2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 1', 'PY-B1-21', NULL, 'Controla el flujo de material con compuerta neumática en la entrada del silo 7.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula cuchilla 2', 'PY-B1-22', NULL, 'Controla el flujo de material con compuerta neumática en la entrada del silo 8.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 1', 'PY-B2-01', NULL, 'Regula la descarga del material desde el silo 7 hacia el fluidor del mismo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 2', 'PY-B2-02', 4, 'Regula la descarga del material desde el silo 8 hacia el fluidor del mismo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 3', 'PY-B2-03', NULL, 'Regula la descarga del material desde el silo 9 hacia el fluidor del mismo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Válvula rotativa 4', 'PY-B2-04', NULL, 'Regula la descarga del material desde el silo 10 hacia el fluidor del mismo.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 1', 'PY-B2-05', NULL, 'Inyecta aire en la base del silo 7 para fluidificar el material y permitir su descarga continua y controlada.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 2', 'PY-B2-06', NULL, 'Inyecta aire en la base del silo 8 para fluidificar el material y permitir su descarga continua y controlada.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 3', 'PY-B2-07', NULL, 'Inyecta aire en la base del silo 9 para fluidificar el material y permitir su descarga continua y controlada.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Fluidor 4', 'PY-B2-08', NULL, 'Inyecta aire en la base del silo 10 para fluidificar el material y permitir su descarga continua y controlada.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Despachofiller2' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador', 'PY-B2-09', 55, 'Eleva el material hacia la carga de camiones.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de alimentación', 'PY-C1-01', NULL, 'Recibe el material de entrada y regula su descarga hacia la CT1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 1', 'PY-C1-02', 4, 'Transalada del material desde la tolva de alimentación hasta el molino a martillos.', 'OPERATIVO', 'MEDIA', 'Descarga dolomita, caliza o chocolata.'),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Molino a martillos', 'PY-C1-03', 55, 'Muele el material hasta granulometría fina mediante impacto de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 1', 'PY-C1-04', 55, 'Eleva el material molido hasta el sin fin 1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin 1', 'PY-C1-05', 22, 'Distribuye el material desde el elevador hacia la zaranda vibratoria.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Zaranda vibratoria', 'PY-C1-06', 55, 'Clasifica el material molido según tamaño de partícula y envía o a sin fin 3, sin fin 2 o CT2.', 'OPERATIVO', 'MEDIA', 'Malla 6 y malla 12'),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin 2', 'PY-C1-07', 22, 'Recibe el material rechazado de la zaranda y lo envía al molino a martillos para reproceso.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Sin fin 3', 'PY-C1-08', 22, 'Recibe el material de la zaranda y lo envía al sin fin 2 o CT2.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 2', 'PY-C1-09', 4, 'Recibe el material del sin fin 2 y lo transporta a silo 3 y 4.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 3', 'PY-C1-10', 4, 'Recibe el material del silo 1 y 2 y envia la carga al elevador 2 para bolsas o a la CT5 para granel.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 4', 'PY-C1-11', 4, 'Recibe material del silo 3 y envia hacia la carga a granel o ensacadora.', 'OPERATIVO', 'MEDIA', 'El silo 3 tiene la opción de descargar directamente a bolsones.'),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 5', 'PY-C1-12', NULL, 'Recibe el material del silo 4 y lo transporta a la CT5 para la carga a granel.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 6', 'PY-C1-13', 4, 'Transporta parte del material hacia la carga a granel.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Elevador 2', 'PY-C1-14', 55, 'Eleva parte del material descargado de las CT3 y CT4  hasta la CT6.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 7', 'PY-C1-15', 4, 'Conduce el material desde el elevador 2 hasta la ensecadora.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Ensacadora', 'PY-C1-16', 1, 'Introduce el material en el saco.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cosedora de sacos', 'PY-C1-17', 1, 'Sella los sacos llenos tras el proceso de ensecado.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Planta02' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 8', 'PY-C1-18', 22, 'Transporta los sacos cerrados hacia la zona de paletizado o almacenamiento.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Tolva de alimentación', 'PY-D1-01', NULL, 'Recibe el material de entrada y regula su descarga hacia la CT1.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 1', 'PY-D1-02', NULL, 'Transalada del material desde la tolva de alimentación hasta la rompedora a martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Rompedora a martillos', 'PY-D1-03', NULL, 'Muele el material hasta granulometría fina mediante impacto de martillos.', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Filler3' AND plant_id = (SELECT id FROM plants WHERE name = 'POLYSAN')), 'Cinta transportadora 2', 'PY-D1-04', NULL, 'Translada el material desde la rompedora a martillos hasta el sin fin 11 de molienda de cal', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Compresores' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Compresor 1', 'C1', NULL, 'Sullar LS-10', 'OPERATIVO', 'MEDIA', 'Dos son de 20 y dos de 30.'),
  ((SELECT id FROM sectors WHERE name = 'Compresores' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Compresor 2', 'C2', NULL, 'Sullar LS-10', 'FUERA_DE_SERVICIO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Compresores' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Compresor 3', 'C3', NULL, 'Sullar LS-10', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Compresores' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Compresor 4', 'C4', NULL, 'Sullar LS-10', 'EN_REPARACION', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Compresores' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Compresor 5', 'C5', NULL, 'Atlas Copco G22P', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Retroexcavadora 1', 'EM1', NULL, 'Caterpillar 320 B (0320BC5M5)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Retroexcavadora 2', 'EM2', NULL, 'Caterpillar 320 C (BMZ00183)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Retroexcavadora 3', 'EM3', NULL, 'Doosan 225 (DOOSAN DX 225 CLK)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Retroexcavadora 4', 'EM4', NULL, 'Doosan 225 (DOOSAN DX225CLA-7M)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Cargadora frontal 1', 'EM5', NULL, 'Doosan SD 300 (DXCCWLBCCN)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Cargadora frontal 2', 'EM6', NULL, 'Caterpillar 950 G (0950GH)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Cargadora frontal 3', 'EM7', NULL, 'Liu Gong 856 H (lg856hzasl)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Camión volcador 1', 'EM8', NULL, 'Scania 420 4x4', 'EN_REPARACION', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Camión volcador 2', 'EM9', NULL, 'Scani 420 8x4', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Autoelevador 1', 'EM10', NULL, 'Toyota (628FD25)', 'EN_REPARACION', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Autoelevador 2', 'EM11', NULL, 'Toyota (628FD25)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Autoelevador 3', 'EM12', NULL, 'XCMG (XCBDT25)', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Camioneta 2', 'EM13', NULL, 'Ford Ranger 3.0', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Carretón', 'EM14', NULL, NULL, 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Camión regador', 'EM15', NULL, 'Mercedes Benz 1114', 'OPERATIVO', 'MEDIA', NULL),
  ((SELECT id FROM sectors WHERE name = 'Equiposmoviles' AND plant_id = (SELECT id FROM plants WHERE name = 'AMBOS')), 'Camioneta 1', 'EM16', NULL, 'Amarok', 'OPERATIVO', 'MEDIA', NULL);


-- ╔══════════════════════════════════════════════════════════════
-- ║ 003_last_executed.sql
-- ╚══════════════════════════════════════════════════════════════
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 004_checklist_storage.sql
-- ╚══════════════════════════════════════════════════════════════
-- Storage bucket for execution photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'execution-photos',
  'execution-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload execution photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'execution-photos');

CREATE POLICY "Authenticated users can view execution photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'execution-photos');

CREATE POLICY "Authenticated users can delete own photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'execution-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photo_urls and checklist columns to executions if missing
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS checklist_responses JSONB;

-- Ensure equipment_checklists has is_active flag
ALTER TABLE equipment_checklists
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS name TEXT;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 005_schedules_extra_columns.sql
-- ╚══════════════════════════════════════════════════════════════
-- Relax NOT NULL constraints that block form submission
ALTER TABLE maintenance_schedules
  ALTER COLUMN checklist_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN created_by   DROP NOT NULL;

-- Add missing columns
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- Fix execution_status enum to match app values
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'completado';
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'parcial';
ALTER TYPE execution_status ADD VALUE IF NOT EXISTS 'cancelado';

-- Add missing columns to maintenance_executions
ALTER TABLE maintenance_executions
  ALTER COLUMN schedule_id DROP NOT NULL;

ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS execution_status TEXT,
  ADD COLUMN IF NOT EXISTS executed_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duration_hours   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS observations     TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_snapshot  JSONB,
  ADD COLUMN IF NOT EXISTS checklist_responses JSONB;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 006_schema_fixes.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 006: Comprehensive schema fixes
-- ══════════════════════════════════════════════════════

-- 1. Replace schedule_type enum with app values
ALTER TABLE maintenance_schedules ALTER COLUMN schedule_type TYPE TEXT;
DROP TYPE IF EXISTS schedule_type;
CREATE TYPE schedule_type AS ENUM (
  'DIARIO','SEMANAL','QUINCENAL','MENSUAL',
  'TRIMESTRAL','SEMESTRAL','ANUAL','PERSONALIZADO','FECHA_FIJA'
);
ALTER TABLE maintenance_schedules
  ALTER COLUMN schedule_type TYPE schedule_type USING 'MENSUAL'::schedule_type;

-- 2. Add 'completed' to schedule_status
ALTER TYPE schedule_status ADD VALUE IF NOT EXISTS 'completed';

-- 3. Relax NOT NULL on maintenance_schedules
ALTER TABLE maintenance_schedules
  ALTER COLUMN checklist_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN created_by   DROP NOT NULL;

-- 4. Add missing columns to maintenance_schedules
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

-- 5. Relax NOT NULL on maintenance_executions
ALTER TABLE maintenance_executions
  ALTER COLUMN equipment_id DROP NOT NULL,
  ALTER COLUMN assigned_to  DROP NOT NULL,
  ALTER COLUMN schedule_id  DROP NOT NULL,
  ALTER COLUMN checklist_responses DROP NOT NULL;

-- 6. Add missing columns to maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS executed_by      UUID REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS execution_status TEXT,
  ADD COLUMN IF NOT EXISTS executed_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS duration_hours   NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS observations     TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS checklist_snapshot JSONB;

-- 7. Relax NOT NULL on equipment_checklists
ALTER TABLE equipment_checklists
  ALTER COLUMN maintenance_type DROP NOT NULL,
  ALTER COLUMN created_by       DROP NOT NULL;

-- 8. Add missing columns to equipment_checklists
ALTER TABLE equipment_checklists
  ADD COLUMN IF NOT EXISTS name     TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 007_add_executed_by.sql
-- ╚══════════════════════════════════════════════════════════════
-- Add executed_by column to maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES app_users(id);

-- Add reference_photos column to maintenance_schedules
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS reference_photos JSONB DEFAULT '[]';


-- ╔══════════════════════════════════════════════════════════════
-- ║ 008_rls_app_users.sql
-- ╚══════════════════════════════════════════════════════════════
-- Confirm unconfirmed users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "users_read_own"  ON app_users;
DROP POLICY IF EXISTS "users_read_all"  ON app_users;
DROP POLICY IF EXISTS "admins_write"    ON app_users;

-- Anyone authenticated can read all users (needed for assignment lists)
CREATE POLICY "users_read_all"
  ON app_users FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "admins_write"
  ON app_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin_sistema', 'administrador')
    )
  );


-- ╔══════════════════════════════════════════════════════════════
-- ║ 009_rls_fix.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 009: Fix RLS across all tables
-- ══════════════════════════════════════════════════════

-- Helper function to check admin role (avoids recursion in app_users policies)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users
    WHERE id = auth.uid()
    AND role IN ('admin_sistema', 'administrador')
  );
$$;

-- ── app_users ────────────────────────────────────────
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_all" ON app_users;
DROP POLICY IF EXISTS "users_read_own" ON app_users;
DROP POLICY IF EXISTS "admins_write"   ON app_users;

CREATE POLICY "users_read_all" ON app_users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins_write" ON app_users
  FOR ALL TO authenticated USING (is_admin());

-- ── plants ───────────────────────────────────────────
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plants_read"  ON plants;
DROP POLICY IF EXISTS "plants_write" ON plants;
CREATE POLICY "plants_read"  ON plants FOR SELECT TO authenticated USING (true);
CREATE POLICY "plants_write" ON plants FOR ALL    TO authenticated USING (is_admin());

-- ── sectors ──────────────────────────────────────────
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sectors_read"  ON sectors;
DROP POLICY IF EXISTS "sectors_write" ON sectors;
CREATE POLICY "sectors_read"  ON sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "sectors_write" ON sectors FOR ALL    TO authenticated USING (is_admin());

-- ── equipment ────────────────────────────────────────
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_read"  ON equipment;
DROP POLICY IF EXISTS "equipment_write" ON equipment;
CREATE POLICY "equipment_read"  ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_write" ON equipment FOR ALL    TO authenticated USING (is_admin());

-- ── equipment_status_log ─────────────────────────────
ALTER TABLE equipment_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status_log_read"  ON equipment_status_log;
DROP POLICY IF EXISTS "status_log_write" ON equipment_status_log;
CREATE POLICY "status_log_read"  ON equipment_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_log_write" ON equipment_status_log FOR ALL    TO authenticated USING (is_admin());

-- ── equipment_checklists ─────────────────────────────
ALTER TABLE equipment_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklists_read"  ON equipment_checklists;
DROP POLICY IF EXISTS "checklists_write" ON equipment_checklists;
CREATE POLICY "checklists_read"  ON equipment_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklists_write" ON equipment_checklists FOR ALL    TO authenticated USING (is_admin());

-- ── maintenance_schedules ────────────────────────────
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_read"   ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_write"  ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_insert" ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_update" ON maintenance_schedules;
DROP POLICY IF EXISTS "schedules_delete" ON maintenance_schedules;
CREATE POLICY "schedules_read"   ON maintenance_schedules FOR SELECT TO authenticated USING (true);
-- Any authenticated user can update (needed when recording executions advances next_date)
CREATE POLICY "schedules_update" ON maintenance_schedules FOR UPDATE TO authenticated USING (true);
-- Only admins can create or delete schedules
CREATE POLICY "schedules_insert" ON maintenance_schedules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "schedules_delete" ON maintenance_schedules FOR DELETE TO authenticated USING (is_admin());

-- ── maintenance_executions ───────────────────────────
ALTER TABLE maintenance_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "executions_read"  ON maintenance_executions;
DROP POLICY IF EXISTS "executions_write" ON maintenance_executions;
-- All authenticated users can read and insert executions
CREATE POLICY "executions_read"   ON maintenance_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "executions_insert" ON maintenance_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "executions_update" ON maintenance_executions FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "executions_delete" ON maintenance_executions FOR DELETE TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 010_plant_status.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 010: Plant status + status log
-- ══════════════════════════════════════════════════════

-- Enum for plant status
CREATE TYPE plant_status AS ENUM ('ACTIVA', 'PARADA', 'EN_REPARACION');

-- Add status column to plants
ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS status plant_status NOT NULL DEFAULT 'ACTIVA';

-- Log table for plant status changes
CREATE TABLE IF NOT EXISTS plant_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  old_status  plant_status,
  new_status  plant_status NOT NULL,
  reason      TEXT,
  changed_by  UUID REFERENCES app_users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for plant_status_log
ALTER TABLE plant_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psl_read"  ON plant_status_log;
DROP POLICY IF EXISTS "psl_write" ON plant_status_log;
CREATE POLICY "psl_read"  ON plant_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "psl_write" ON plant_status_log FOR ALL    TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 011_work_orders.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 012_sector_status.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 012: Sector status + log
-- ══════════════════════════════════════════════════════

-- Reuse plant_status enum (ACTIVA / PARADA / EN_REPARACION)
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS status plant_status NOT NULL DEFAULT 'ACTIVA';

CREATE TABLE IF NOT EXISTS sector_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sector_id   UUID NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  old_status  plant_status,
  new_status  plant_status NOT NULL,
  reason      TEXT,
  changed_by  UUID REFERENCES app_users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sector_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ssl_read"  ON sector_status_log;
DROP POLICY IF EXISTS "ssl_write" ON sector_status_log;
CREATE POLICY "ssl_read"  ON sector_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "ssl_write" ON sector_status_log FOR ALL    TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 013_work_orders_v2.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 013: Work orders v2 — bidirectional + auto-status
-- ══════════════════════════════════════════════════════

-- Track which OT were created from the app (vs imported from Sheets)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS app_created   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheets_row    INTEGER,          -- row index in Google Sheet (for write-back)
  ADD COLUMN IF NOT EXISTS sector_id     UUID REFERENCES sectors(id),
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS created_at_app TIMESTAMPTZ;

-- Function: auto-update equipment status when an OT changes state
CREATE OR REPLACE FUNCTION sync_equipment_status_from_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eq_id UUID;
  new_eq_status equipment_status;
BEGIN
  eq_id := NEW.equipment_id;
  IF eq_id IS NULL THEN RETURN NEW; END IF;

  -- Map OT estado → equipment status
  CASE NEW.estado
    WHEN 'REALIZADO'   THEN new_eq_status := 'OPERATIVO';
    WHEN 'EN_PROCESO'  THEN new_eq_status := 'EN_MANTENIMIENTO';
    ELSE RETURN NEW;  -- ATRASADO / POR_HACER: no tocar el equipo
  END CASE;

  -- Only update if status actually changed
  UPDATE equipment SET status = new_eq_status
  WHERE id = eq_id AND status <> new_eq_status;

  -- Log the change
  IF FOUND THEN
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, reason)
    SELECT eq_id, status, new_eq_status,
           'Actualizado automáticamente por OT #' || NEW.ot_number
    FROM equipment WHERE id = eq_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ot_auto_equipment_status ON work_orders;
CREATE TRIGGER ot_auto_equipment_status
  AFTER INSERT OR UPDATE OF estado ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_equipment_status_from_ot();


-- ╔══════════════════════════════════════════════════════════════
-- ║ 014_daily_plans.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 014: Daily work plans
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_plans (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha       DATE        NOT NULL,
  titulo      TEXT,
  notas       TEXT,
  created_by  UUID        REFERENCES app_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_plan_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  work_order_id   UUID REFERENCES work_orders(id),
  -- Campos copiados al momento de agregar (snapshot para impresión)
  ot_number       INTEGER,
  especialidad    TEXT,
  sector_raw      TEXT,
  equipo_raw      TEXT,
  descripcion     TEXT,
  repuesto        TEXT,
  fecha_ejecucion DATE,
  -- Asignación
  assigned_to     UUID REFERENCES app_users(id),
  assigned_name   TEXT,   -- nombre libre si no está en el sistema
  notas_item      TEXT,
  orden           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dp_fecha_idx  ON daily_plans(fecha DESC);
CREATE INDEX IF NOT EXISTS dpi_plan_idx  ON daily_plan_items(plan_id);

ALTER TABLE daily_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_read"  ON daily_plans;
DROP POLICY IF EXISTS "dp_write" ON daily_plans;
DROP POLICY IF EXISTS "dpi_read"  ON daily_plan_items;
DROP POLICY IF EXISTS "dpi_write" ON daily_plan_items;

CREATE POLICY "dp_read"   ON daily_plans      FOR SELECT TO authenticated USING (true);
CREATE POLICY "dp_write"  ON daily_plans      FOR ALL    TO authenticated USING (is_admin());
CREATE POLICY "dpi_read"  ON daily_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpi_write" ON daily_plan_items FOR ALL    TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 015_fix_status_log_trigger.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 015: Fix equipment_status_log changed_by nullable
--                + fix auto-status trigger
-- ══════════════════════════════════════════════════════

-- Allow NULL changed_by (system-generated changes from triggers)
ALTER TABLE equipment_status_log
  ALTER COLUMN changed_by DROP NOT NULL;

-- Fix trigger: don't read status back from updated row (race condition)
CREATE OR REPLACE FUNCTION sync_equipment_status_from_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eq_id          UUID;
  new_eq_status  equipment_status;
  cur_eq_status  equipment_status;
BEGIN
  eq_id := NEW.equipment_id;
  IF eq_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.estado
    WHEN 'REALIZADO'  THEN new_eq_status := 'OPERATIVO';
    WHEN 'EN_PROCESO' THEN new_eq_status := 'EN_MANTENIMIENTO';
    ELSE RETURN NEW;
  END CASE;

  SELECT status INTO cur_eq_status FROM equipment WHERE id = eq_id;
  IF cur_eq_status = new_eq_status THEN RETURN NEW; END IF;

  UPDATE equipment SET status = new_eq_status WHERE id = eq_id;

  INSERT INTO equipment_status_log (equipment_id, old_status, new_status, reason, changed_by)
  VALUES (
    eq_id,
    cur_eq_status,
    new_eq_status,
    'Actualizado automáticamente por OT #' || NEW.ot_number,
    NULL
  );

  RETURN NEW;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 016_wo_schedule_link.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 016: Vínculo mantenimiento ↔ orden de trabajo
-- ══════════════════════════════════════════════════════
-- Una OT puede originarse en (o vincularse a) un mantenimiento programado.
-- Relación: un maintenance_schedule → muchas work_orders.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wo_schedule_idx ON work_orders(schedule_id);


-- ╔══════════════════════════════════════════════════════════════
-- ║ 017_avisos.sql
-- ╚══════════════════════════════════════════════════════════════
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
  sector_id     uuid REFERENCES sectors(id),
  equipo_raw    text,
  equipo_code   text,
  equipment_id  uuid REFERENCES equipment(id),
  descripcion   text,
  urgencia      text,                                 -- "🟡 Media", "🔴 Alta", etc.
  quien_aviso   text,
  ot_asignada   text,                                 -- "si" / N° OT / vacío
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  observaciones text,
  app_created   boolean NOT NULL DEFAULT false,
  sheets_row    integer,
  created_by    uuid REFERENCES app_users(id),
  synced_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS avisos_equipment_idx ON avisos(equipment_id);
CREATE INDEX IF NOT EXISTS avisos_wo_idx        ON avisos(work_order_id);
CREATE INDEX IF NOT EXISTS avisos_urgencia_idx  ON avisos(urgencia);

-- RLS
ALTER TABLE avisos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avisos_read"  ON avisos;
DROP POLICY IF EXISTS "avisos_write" ON avisos;
CREATE POLICY "avisos_read"  ON avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "avisos_write" ON avisos FOR ALL    TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 018_ot_frecuencia.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 018: Frecuencia, próxima fecha y fotos en OTs
-- ══════════════════════════════════════════════════════
-- Campos rescatados del viejo formulario de mantenimiento, ahora en la OT.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS frecuencia       text,     -- MENSUAL, SEMANAL, etc. (o null)
  ADD COLUMN IF NOT EXISTS proxima_fecha    date,
  ADD COLUMN IF NOT EXISTS reference_photos text[];


-- ╔══════════════════════════════════════════════════════════════
-- ║ 019_avisos_photos.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 019: Fotos de referencia en avisos
-- ══════════════════════════════════════════════════════
-- Las fotos se guardan en el storage de Supabase (no en Google).

ALTER TABLE avisos
  ADD COLUMN IF NOT EXISTS reference_photos text[];


-- ╔══════════════════════════════════════════════════════════════
-- ║ 020_executions_to_ot.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 020: Ejecuciones cuelgan de OTs (no de programados)
-- ══════════════════════════════════════════════════════
-- Se retira el módulo de mantenimiento programado; la ejecución
-- ahora se registra contra una orden de trabajo (OT).

-- schedule_id pasa a ser opcional (las ejecuciones viejas lo conservan)
ALTER TABLE maintenance_executions ALTER COLUMN schedule_id DROP NOT NULL;

-- Nueva referencia a la OT
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS exec_wo_idx ON maintenance_executions(work_order_id);


-- ╔══════════════════════════════════════════════════════════════
-- ║ 021_equipment_parts.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 022_produccion.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 022: Planificación de producción semanal
-- ══════════════════════════════════════════════════════
-- Por cada semana y sector se guarda el estado de producción de los 7 días
-- (Lun..Dom): EN_PRODUCCION / PARCIAL / LIBRE. Sirve para ver qué sectores
-- quedan libres y decidir dónde meter reparaciones sin frenar el despacho.

CREATE TABLE IF NOT EXISTS production_plan (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start  date NOT NULL,                 -- lunes de la semana
  sector_id   uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  days        jsonb NOT NULL DEFAULT '["LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE","LIBRE"]',
  note        text,
  updated_by  uuid REFERENCES app_users(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, sector_id)
);

CREATE INDEX IF NOT EXISTS production_week_idx ON production_plan(week_start);

ALTER TABLE production_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prod_read"  ON production_plan;
DROP POLICY IF EXISTS "prod_write" ON production_plan;
CREATE POLICY "prod_read"  ON production_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_write" ON production_plan FOR ALL    TO authenticated USING (is_admin());


-- ╔══════════════════════════════════════════════════════════════
-- ║ 023_ot_orden.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 023: Orden manual de OTs (priorización)
-- ══════════════════════════════════════════════════════
-- Permite arrastrar las OTs para fijar un orden propio, además del
-- orden automático por prioridad/estado/criticidad/antigüedad.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS orden_manual integer;

CREATE INDEX IF NOT EXISTS wo_orden_manual_idx ON work_orders(orden_manual);


-- ╔══════════════════════════════════════════════════════════════
-- ║ 024_equipment_ficha.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 025_tipos_componentes.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 026_ordenes_servicio.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 027_wo_parts.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 028_contratistas.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 029_operarios.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 030_comparativas.sql
-- ╚══════════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════════
-- ║ 031_os_fecha_pedido.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 031: Seguimiento de OS — fecha de pedido
-- ══════════════════════════════════════════════════════
-- Se registra cuándo se pide el servicio (fecha_pedido) y cuándo se recibe/
-- termina (se reutiliza fecha_realizacion). Permite ver la demora.

ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS fecha_pedido date;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 032_role_jefe_produccion.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 032: Rol "Jefe de Producción"
-- ══════════════════════════════════════════════════════
-- Nuevo rol que puede editar la Planificación de producción (además de
-- admin_sistema). No es admin general: is_admin() NO lo incluye, así que
-- no gana permisos de escritura sobre el resto de las tablas (RLS).
-- La edición de la planificación se gatea en la API (cliente admin).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'jefe_produccion';


-- ╔══════════════════════════════════════════════════════════════
-- ║ 033_produccion_extra.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 033: Planificación de producción — info extra
-- ══════════════════════════════════════════════════════
-- Por día (7): motivo de parada y turnos. Por sector/semana: responsable.

ALTER TABLE production_plan
  ADD COLUMN IF NOT EXISTS motivos     jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS turnos      jsonb NOT NULL DEFAULT '["","","","","","",""]',
  ADD COLUMN IF NOT EXISTS responsable text;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 034_ot_no_fuerza_mantenimiento.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 034: Iniciar una OT ya no fuerza "En mantenimiento"
-- ══════════════════════════════════════════════════════
-- Que una OT pase a EN_PROCESO no implica que el equipo deje de estar
-- operativo. Se quita ese mapeo automático; el estado del equipo al iniciar
-- una OT lo decide la persona (desde la app). Se mantiene REALIZADO→OPERATIVO.

CREATE OR REPLACE FUNCTION sync_equipment_status_from_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eq_id          UUID;
  new_eq_status  equipment_status;
  cur_eq_status  equipment_status;
BEGIN
  eq_id := NEW.equipment_id;
  IF eq_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.estado
    WHEN 'REALIZADO' THEN new_eq_status := 'OPERATIVO';
    ELSE RETURN NEW;   -- EN_PROCESO y demás ya no cambian el estado del equipo
  END CASE;

  SELECT status INTO cur_eq_status FROM equipment WHERE id = eq_id;
  IF cur_eq_status = new_eq_status THEN RETURN NEW; END IF;

  UPDATE equipment SET status = new_eq_status WHERE id = eq_id;

  INSERT INTO equipment_status_log (equipment_id, old_status, new_status, reason, changed_by)
  VALUES (
    eq_id,
    cur_eq_status,
    new_eq_status,
    'Actualizado automáticamente por OT #' || NEW.ot_number,
    NULL
  );

  RETURN NEW;
END;
$$;


-- ╔══════════════════════════════════════════════════════════════
-- ║ 035_equipos_unificar_mantenimiento.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 035: Unificar estado de equipos "En reparación" en "En mantenimiento"
-- ══════════════════════════════════════════════════════
-- Se deja de usar EN_REPARACION como estado de equipo: los que estaban en ese
-- estado pasan a EN_MANTENIMIENTO. (El valor del enum se conserva por
-- compatibilidad con el historial; ya no se ofrece como opción en la app.)

UPDATE equipment SET status = 'EN_MANTENIMIENTO' WHERE status = 'EN_REPARACION';


-- ╔══════════════════════════════════════════════════════════════
-- ║ 036_ot_requiere_parada_sector.sql
-- ╚══════════════════════════════════════════════════════════════
-- ══════════════════════════════════════════════════════
-- Migration 036: OT — "requiere parar el sector"
-- ══════════════════════════════════════════════════════
-- Marca en la OT si el trabajo necesita que se pare el sector. Se muestra
-- como alerta (mientras la OT esté pendiente) en el listado de OT, en la
-- planificación de producción y en las tarjetas de sector del dashboard.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS requiere_parada_sector boolean NOT NULL DEFAULT false;

