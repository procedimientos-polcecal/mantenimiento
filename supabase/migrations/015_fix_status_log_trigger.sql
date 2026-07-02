-- ══════════════════════════════════════════════════════
-- Migration 015: Fix equipment_status_log changed_by nullable
--                + fix auto-status trigger
-- ══════════════════════════════════════════════════════

-- Allow NULL changed_by (system-generated changes from triggers)
ALTER TABLE equipment_status_log
  ALTER COLUMN changed_by DROP NOT NULL;

-- Fix trigger: don't read status back from updated row (race condition)
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
    WHEN 'REALIZADO'  THEN new_eq_status := 'OPERATIVO';
    WHEN 'EN_PROCESO' THEN new_eq_status := 'EN_MANTENIMIENTO';
    ELSE RETURN NEW;
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
