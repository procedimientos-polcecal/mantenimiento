-- ═══════════════════════════════════════════════════════════════
-- PERMISOS DE MANTENIMIENTO — sobre el modelo del ERP (usuario_modulos)
-- Se aplica en el Supabase del ERP, DESPUÉS de integracion-delta.sql.
-- ═══════════════════════════════════════════════════════════════
-- Modelo del ERP: usuario_modulos(usuario_id, modulo, nivel) con
-- nivel ∈ nivel_acceso = {lectura, edicion, admin} (en ese orden).
-- El enum ordena lectura < edicion < admin, así que se puede comparar con >=.

-- ── Helpers ──────────────────────────────────────────────────────
-- Nivel del usuario en el módulo mantenimiento (NULL si no tiene acceso).
CREATE OR REPLACE FUNCTION mant_nivel(uid uuid DEFAULT auth.uid())
RETURNS nivel_acceso
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT um.nivel
  FROM usuario_modulos um
  WHERE um.usuario_id = uid AND um.modulo = 'mantenimiento'
  ORDER BY um.nivel DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION mant_puede_ver(uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT mant_nivel(uid) >= 'lectura'::nivel_acceso;
$$;

CREATE OR REPLACE FUNCTION mant_puede_editar(uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT mant_nivel(uid) >= 'edicion'::nivel_acceso;
$$;

CREATE OR REPLACE FUNCTION mant_es_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT mant_nivel(uid) >= 'admin'::nivel_acceso;
$$;
-- (Si tenés un rol global superadmin en usuarios.rol y querés que saltee el
--  gating por módulo, sumale un OR aquí, p. ej.:
--    OR EXISTS (SELECT 1 FROM usuarios u WHERE u.id=uid AND u.rol='admin_sistema'))

-- ── RLS de las tablas nuevas del delta ───────────────────────────
-- Lectura: cualquiera con acceso a mantenimiento. Escritura: 'edicion' para
-- lo operativo, 'admin' para config (operarios/contratistas/tipos/repuestos).

-- Operativas (escritura = edicion+)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['avisos','ordenes_servicio','os_comparativas','production_plan','work_order_parts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_read',  t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_write', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (mant_puede_ver())', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL    TO authenticated USING (mant_puede_editar())', t||'_write', t);
  END LOOP;
END $$;

-- Config (escritura = admin)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['operarios','contratistas','equipment_types','equipment_components','equipment_parts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_read',  t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_write', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (mant_puede_ver())', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL    TO authenticated USING (mant_es_admin())', t||'_write', t);
  END LOOP;
END $$;

-- Nota: las tablas reusadas del ERP (equipos, ordenes_trabajo, sectores, etc.)
-- ya tienen su RLS; no se tocan acá. Si querés alinearlas al mismo criterio,
-- reemplazá sus policies de escritura por mant_puede_editar()/mant_es_admin().
