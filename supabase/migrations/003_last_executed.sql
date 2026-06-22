ALTER TABLE maintenance_schedules
  ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;
