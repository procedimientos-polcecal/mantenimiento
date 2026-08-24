#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Exporta los datos de la app de Mantenimiento (data-only) para migrarlos a
# otro Supabase. Ver MUDANZA.md para el paso a paso completo.
#
# Uso:
#   OLD_DB_URL="postgresql://postgres:PASS@db.XXXX.supabase.co:5432/postgres" \
#     bash scripts/exportar-datos.sh
#
# La connection string sale de: Supabase (proyecto viejo) → Settings → Database
# → Connection string → URI (usá la conexión directa, puerto 5432).
# Requiere pg_dump instalado (viene con PostgreSQL / `brew install libpq`).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${OLD_DB_URL:?Definí OLD_DB_URL con la connection string del Supabase viejo}"

OUT_DIR="export-mantenimiento"
mkdir -p "$OUT_DIR"

# Datos maestros + app-only + historial. NO incluye work_orders/avisos/
# ordenes_servicio/os_comparativas: esos son espejo de Google Sheets y conviene
# RE-SINCRONIZARLOS en el destino (Sync) en vez de migrarlos. Si igual los
# querés migrar, agregalos a la lista de abajo.
TABLES=(
  plants
  sectors
  equipment_types
  equipment
  equipment_components
  equipment_parts
  equipment_checklists
  operarios
  contratistas
  production_plan
  maintenance_executions
  work_order_parts
  daily_plans
  daily_plan_items
  maintenance_schedules
  equipment_status_log
  sector_status_log
  plant_status_log
  app_users
)

ARGS=()
for t in "${TABLES[@]}"; do ARGS+=(-t "public.$t"); done

echo "Exportando ${#TABLES[@]} tablas (data-only) a $OUT_DIR/datos.sql ..."
pg_dump "$OLD_DB_URL" \
  --data-only --no-owner --no-privileges \
  --column-inserts --rows-per-insert=500 \
  "${ARGS[@]}" \
  > "$OUT_DIR/datos.sql"

echo "✓ Listo: $OUT_DIR/datos.sql"
echo
echo "Para RESTAURAR en el Supabase destino (ver MUDANZA.md):"
echo "  1) Primero corré supabase/schema.sql en el destino."
echo "  2) Recreá los usuarios (auth) y sus app_users (los IDs cambian)."
echo "  3) psql \"\$NEW_DB_URL\" -c 'SET session_replication_role = replica;' -f $OUT_DIR/datos.sql"
echo "     (session_replication_role=replica desactiva triggers y FKs durante la carga)"
