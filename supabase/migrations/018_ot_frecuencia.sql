-- ══════════════════════════════════════════════════════
-- Migration 018: Frecuencia, próxima fecha y fotos en OTs
-- ══════════════════════════════════════════════════════
-- Campos rescatados del viejo formulario de mantenimiento, ahora en la OT.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS frecuencia       text,     -- MENSUAL, SEMANAL, etc. (o null)
  ADD COLUMN IF NOT EXISTS proxima_fecha    date,
  ADD COLUMN IF NOT EXISTS reference_photos text[];
