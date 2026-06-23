import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const REQUIRES_REASON = ["EN_MANTENIMIENTO", "EN_REPARACION", "STANDBY", "FUERA_DE_SERVICIO", "DADO_DE_BAJA"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const admin = createAdminClient();

  // ── Status-only change ───────────────────────────────────────────────────
  if (body.action === "change_status") {
    const { new_status, reason } = body;
    if (!new_status) return NextResponse.json({ error: "Estado requerido" }, { status: 400 });
    if (REQUIRES_REASON.includes(new_status) && !reason?.trim()) {
      return NextResponse.json({ error: "Se requiere una justificación para este estado" }, { status: 400 });
    }

    const { data: equipo } = await admin.from("equipment").select("status").eq("id", id).single();
    if (!equipo) return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });

    const { error: upErr } = await admin.from("equipment").update({ status: new_status }).eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    await admin.from("equipment_status_log").insert({
      equipment_id: id,
      old_status:   equipo.status,
      new_status,
      reason:       reason?.trim() || null,
      changed_by:   user.id,
    });

    return NextResponse.json({ success: true });
  }

  // ── Full field update ────────────────────────────────────────────────────
  const { name, code, sector_id, power_kw, description, criticality, notes, status, old_status } = body;

  const payload: any = {
    name: name?.trim(), code: code?.trim(), sector_id,
    power_kw: power_kw === "" ? null : power_kw != null ? Number(power_kw) : undefined,
    description: description?.trim() || null,
    criticality, notes: notes?.trim() || null,
  };
  if (status) payload.status = status;

  const { error: upErr } = await admin.from("equipment").update(payload).eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  if (status && old_status && status !== old_status) {
    await admin.from("equipment_status_log").insert({
      equipment_id: id,
      old_status,
      new_status: status,
      reason: null,
      changed_by: user.id,
    });
  }

  return NextResponse.json({ success: true });
}
