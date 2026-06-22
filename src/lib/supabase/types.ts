export type PlantName = 'POLCECAL' | 'POLYSAN' | 'AMBOS'
export type EquipmentStatus = 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'EN_REPARACION' | 'STANDBY' | 'FUERA_DE_SERVICIO' | 'DADO_DE_BAJA'
export type Criticality = 'ALTA' | 'MEDIA' | 'BAJA'
export type UserRole = 'gerente' | 'administrador' | 'operario' | 'admin_sistema'
export type MaintenanceType = 'Lubricacion' | 'Inspeccion' | 'Limpieza' | 'Ajuste' | 'Reemplazo' | 'Revision_electrica' | 'Otro'
export type ScheduleType = 'fixed_interval' | 'specific_date'
export type ScheduleStatus = 'active' | 'paused' | 'cancelled'
export type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'not_done'

export interface Plant {
  id: string
  name: PlantName
  created_at: string
}

export interface Sector {
  id: string
  plant_id: string
  name: string
  created_at: string
  plants?: Plant
}

export interface Equipment {
  id: string
  sector_id: string
  name: string
  code: string
  power_kw: number | null
  description: string | null
  status: EquipmentStatus
  criticality: Criticality
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  sectors?: Sector
}

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface ChecklistItem {
  id: string
  task: string
  required: boolean
  order: number
}

export interface EquipmentChecklist {
  id: string
  equipment_id: string
  maintenance_type: MaintenanceType
  version: number
  items: ChecklistItem[]
  created_by: string
  created_at: string
  is_active: boolean
}

export interface MaintenanceSchedule {
  id: string
  equipment_id: string
  checklist_id: string
  maintenance_type: MaintenanceType
  schedule_type: ScheduleType
  interval_days: number | null
  next_date: string
  assigned_to: string
  status: ScheduleStatus
  created_by: string
  created_at: string
  equipment?: Equipment
  assigned_user?: AppUser
  checklist?: EquipmentChecklist
}

export interface ChecklistResponse {
  item_id: string
  task: string
  done: boolean
  note: string | null
}

export interface MaintenanceExecution {
  id: string
  schedule_id: string
  equipment_id: string
  assigned_to: string
  started_at: string | null
  completed_at: string | null
  status: ExecutionStatus
  checklist_responses: ChecklistResponse[]
  notes_start: string | null
  notes_end: string | null
  photos_start: string[]
  photos_end: string[]
  drive_folder_url: string | null
  synced_at: string | null
  created_at: string
  equipment?: Equipment
  assigned_user?: AppUser
  schedule?: MaintenanceSchedule
}

export interface EquipmentStatusLog {
  id: string
  equipment_id: string
  old_status: EquipmentStatus | null
  new_status: EquipmentStatus
  changed_by: string
  changed_at: string
  reason: string | null
  changed_user?: AppUser
}
