-- ══════════════════════════════════════════════════════
-- Migration 034: Iniciar una OT ya no fuerza "En mantenimiento"
-- ══════════════════════════════════════════════════════
-- Que una OT pase a EN_PROCESO no implica que el equipo deje de estar
-- operativo. Se quita ese mapeo automático; el estado del equipo al iniciar
-- una OT lo decide la persona (desde la app). Se mantiene REALIZADO→OPERATIVO.

CREATE OR REPLACE FUNCTION sync_equipment_status_from_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eq_id          UUID;
  new_eq_status  equipment_status;
  cur_eq_status  equipment_status;
BEGIN
  eq_id := NEW.equipment_id;
  IF eq_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.estado
    WHEN 'REALIZADO' THEN new_eq_status := 'OPERATIVO';
    ELSE RETURN NEW;   -- EN_PROCESO y demás ya no cambian el estado del equipo
  END CASE;

  SELECT status INTO cur_eq_status FROM equipment WHERE id = eq_id;
  IF cur_eq_status = new_eq_status THEN RETURN NEW; END IF;

  UPDATE equipment SET status = new_eq_status WHERE id = eq_id;

  INSERT INTO equipment_status_log (equipment_id, old_status, new_status, reason, changed_by)
  VALUES (
    eq_id,
    cur_eq_status,
    new_eq_status,
    'Actualizado automáticamente por OT #' || NEW.ot_number,
    NULL
  );

  RETURN NEW;
END;
$$;
