-- ══════════════════════════════════════════════════════
-- Migration 013: Work orders v2 — bidirectional + auto-status
-- ══════════════════════════════════════════════════════

-- Track which OT were created from the app (vs imported from Sheets)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS app_created   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheets_row    INTEGER,          -- row index in Google Sheet (for write-back)
  ADD COLUMN IF NOT EXISTS sector_id     UUID REFERENCES sectors(id),
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS created_at_app TIMESTAMPTZ;

-- Function: auto-update equipment status when an OT changes state
CREATE OR REPLACE FUNCTION sync_equipment_status_from_ot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  eq_id UUID;
  new_eq_status equipment_status;
BEGIN
  eq_id := NEW.equipment_id;
  IF eq_id IS NULL THEN RETURN NEW; END IF;

  -- Map OT estado → equipment status
  CASE NEW.estado
    WHEN 'REALIZADO'   THEN new_eq_status := 'OPERATIVO';
    WHEN 'EN_PROCESO'  THEN new_eq_status := 'EN_MANTENIMIENTO';
    ELSE RETURN NEW;  -- ATRASADO / POR_HACER: no tocar el equipo
  END CASE;

  -- Only update if status actually changed
  UPDATE equipment SET status = new_eq_status
  WHERE id = eq_id AND status <> new_eq_status;

  -- Log the change
  IF FOUND THEN
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, reason)
    SELECT eq_id, status, new_eq_status,
           'Actualizado automáticamente por OT #' || NEW.ot_number
    FROM equipment WHERE id = eq_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ot_auto_equipment_status ON work_orders;
CREATE TRIGGER ot_auto_equipment_status
  AFTER INSERT OR UPDATE OF estado ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_equipment_status_from_ot();
