-- Add executed_by column to maintenance_executions
ALTER TABLE maintenance_executions
  ADD COLUMN IF NOT EXISTS executed_by UUID REFERENCES app_users(id);

-- Add reference_photos column to maintenance_schedules
ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS reference_photos JSONB DEFAULT '[]';
