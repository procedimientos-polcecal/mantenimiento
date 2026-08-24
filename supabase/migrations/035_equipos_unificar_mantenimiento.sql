-- ══════════════════════════════════════════════════════
-- Migration 035: Unificar estado de equipos "En reparación" en "En mantenimiento"
-- ══════════════════════════════════════════════════════
-- Se deja de usar EN_REPARACION como estado de equipo: los que estaban en ese
-- estado pasan a EN_MANTENIMIENTO. (El valor del enum se conserva por
-- compatibilidad con el historial; ya no se ofrece como opción en la app.)

UPDATE equipment SET status = 'EN_MANTENIMIENTO' WHERE status = 'EN_REPARACION';
