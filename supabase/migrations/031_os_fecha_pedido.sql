-- ══════════════════════════════════════════════════════
-- Migration 031: Seguimiento de OS — fecha de pedido
-- ══════════════════════════════════════════════════════
-- Se registra cuándo se pide el servicio (fecha_pedido) y cuándo se recibe/
-- termina (se reutiliza fecha_realizacion). Permite ver la demora.

ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS fecha_pedido date;
