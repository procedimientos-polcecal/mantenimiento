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
