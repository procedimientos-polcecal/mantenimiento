import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_STATUSES = ["ACTIVA", "PARADA", "EN_REPARACION"];
const REQUIRES_REASON = ["PARADA", "EN_REPARACION"];

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { plant_id, new_status, reason } = await request.json();

  if (!plant_id || !new_status) {
    return NextResponse.json({ error: "Planta y nuevo estado son requeridos" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(new_status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (REQUIRES_REASON.includes(new_status) && !reason?.trim()) {
    return NextResponse.json({ error: "Se requiere una justificación para este cambio de estado" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get current status
  const { data: plant } = await admin
    .from("plants").select("status").eq("id", plant_id).single();
  if (!plant) return NextResponse.json({ error: "Planta no encontrada" }, { status: 404 });

  // Update plant status
  const { error: updateErr } = await admin
    .from("plants").update({ status: new_status }).eq("id", plant_id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log the change
  await admin.from("plant_status_log").insert({
    plant_id,
    old_status:  plant.status ?? null,
    new_status,
    reason:      reason?.trim() || null,
    changed_by:  user.id,
  });

  return NextResponse.json({ success: true });
}
