import Dexie, { type Table } from "dexie";

export interface PendingExecution {
  id?: number;
  schedule_id: string;
  executed_by: string;
  execution_status: string;
  executed_at: string;
  duration_hours?: number;
  observations?: string;
  checklist_responses?: any;
  photo_data?: string[]; // base64 for offline photos
  next_date_override?: string;
  synced: boolean;
  created_at: string;
  // local display data
  equipment_code?: string;
  equipment_name?: string;
  maintenance_type?: string;
}

export interface CachedSchedule {
  id: string;
  equipment_id: string;
  maintenance_type: string;
  schedule_type: string;
  interval_days?: number;
  next_date?: string;
  description?: string;
  estimated_hours?: number;
  equipment_name: string;
  equipment_code: string;
  sector_name: string;
  plant_name: string;
  assigned_to?: string;
}

export interface CachedChecklist {
  id: string;
  equipment_id: string;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  type: "check" | "number" | "text" | "photo";
  required: boolean;
  unit?: string;
}

class MantenimientoDB extends Dexie {
  pending_executions!: Table<PendingExecution>;
  cached_schedules!: Table<CachedSchedule>;
  cached_checklists!: Table<CachedChecklist>;

  constructor() {
    super("MantenimientoDB");
    this.version(1).stores({
      pending_executions: "++id, synced, created_at, schedule_id",
      cached_schedules:   "id, equipment_id, next_date",
      cached_checklists:  "id, equipment_id",
    });
  }
}

export const db = typeof window !== "undefined" ? new MantenimientoDB() : null as any;
