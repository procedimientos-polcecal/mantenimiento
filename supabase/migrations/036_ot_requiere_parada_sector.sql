-- ══════════════════════════════════════════════════════
-- Migration 036: OT — "requiere parar el sector"
-- ══════════════════════════════════════════════════════
-- Marca en la OT si el trabajo necesita que se pare el sector. Se muestra
-- como alerta (mientras la OT esté pendiente) en el listado de OT, en la
-- planificación de producción y en las tarjetas de sector del dashboard.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS requiere_parada_sector boolean NOT NULL DEFAULT false;
