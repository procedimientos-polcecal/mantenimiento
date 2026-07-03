-- ══════════════════════════════════════════════════════
-- Migration 016: Vínculo mantenimiento ↔ orden de trabajo
-- ══════════════════════════════════════════════════════
-- Una OT puede originarse en (o vincularse a) un mantenimiento programado.
-- Relación: un maintenance_schedule → muchas work_orders.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wo_schedule_idx ON work_orders(schedule_id);
