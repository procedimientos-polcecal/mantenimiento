-- ══════════════════════════════════════════════════════
-- Migration 032: Rol "Jefe de Producción"
-- ══════════════════════════════════════════════════════
-- Nuevo rol que puede editar la Planificación de producción (además de
-- admin_sistema). No es admin general: is_admin() NO lo incluye, así que
-- no gana permisos de escritura sobre el resto de las tablas (RLS).
-- La edición de la planificación se gatea en la API (cliente admin).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'jefe_produccion';
