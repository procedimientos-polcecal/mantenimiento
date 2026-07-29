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
