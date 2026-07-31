-- ══════════════════════════════════════════════════════
-- Migration 023: Orden manual de OTs (priorización)
-- ══════════════════════════════════════════════════════
-- Permite arrastrar las OTs para fijar un orden propio, además del
-- orden automático por prioridad/estado/criticidad/antigüedad.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS orden_manual integer;

CREATE INDEX IF NOT EXISTS wo_orden_manual_idx ON work_orders(orden_manual);
