import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendExecutionNotification } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data: appUser } = await supabase
    .from("app_users").select("full_name").eq("id", user.id).single();

  // Insertar la ejecución (vinculada a la OT)
  const { data: execution, error } = await supabase
    .from("maintenance_executions")
    .insert({
      work_order_id:       body.work_order_id ?? null,
      executed_by:         user.id,
      execution_status:    body.execution_status,
      executed_at:         body.executed_at,
      duration_hours:      body.duration_hours ?? null,
      observations:        body.observations ?? null,
      checklist_snapshot:  body.checklist_snapshot ?? null,
      checklist_responses: body.checklist_responses ?? null,
      photo_urls:          body.photo_urls ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si se completó, marcar la OT como Realizada (dispara el estado del equipo)
  if (body.execution_status === "completado" && body.work_order_id) {
    const admin = createAdminClient();
    await admin.from("work_orders")
      .update({ estado: "REALIZADO", synced_at: new Date().toISOString() })
      .eq("id", body.work_order_id);
  }

  // Notificación por email (no bloqueante)
  sendExecutionNotification({
    equipment_code:   body.equipment_code ?? "",
    equipment_name:   body.equipment_name ?? "",
    maintenance_type: body.ot_number ? `OT #${body.ot_number}` : "OT",
    executor_name:    appUser?.full_name ?? user.email ?? "",
    executed_at:      body.executed_at,
    execution_status: body.execution_status,
    duration_hours:   body.duration_hours,
    observations:     body.observations,
  }).catch(() => {});

  return NextResponse.json({ data: execution });
}
