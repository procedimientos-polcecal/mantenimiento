import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendExecutionNotification } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data: appUser } = await supabase
    .from("app_users")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: schedule } = await supabase
    .from("maintenance_schedules")
    .select("*, equipment(name, code)")
    .eq("id", body.schedule_id)
    .single();

  const { data: execution, error } = await supabase
    .from("maintenance_executions")
    .insert({
      schedule_id:          body.schedule_id,
      executed_by:          user.id,
      execution_status:     body.execution_status,
      executed_at:          body.executed_at,
      duration_hours:       body.duration_hours ?? null,
      observations:         body.observations ?? null,
      checklist_snapshot:   body.checklist_snapshot ?? null,
      checklist_responses:  body.checklist_responses ?? null,
      photo_urls:           body.photo_urls ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Advance next_date if completed
  if (body.execution_status === "completado" && schedule) {
    const nextDate = body.next_date_override || calcNextDate(schedule);
    if (nextDate) {
      await supabase
        .from("maintenance_schedules")
        .update({ next_date: nextDate, last_executed_at: body.executed_at })
        .eq("id", body.schedule_id);
    }
  }

  // Send notification email (non-blocking)
  if (schedule) {
    sendExecutionNotification({
      equipment_code:   schedule.equipment?.code ?? "",
      equipment_name:   schedule.equipment?.name ?? "",
      maintenance_type: schedule.maintenance_type,
      executor_name:    appUser?.full_name ?? user.email ?? "",
      executed_at:      body.executed_at,
      execution_status: body.execution_status,
      duration_hours:   body.duration_hours,
      observations:     body.observations,
    }).catch(() => {});
  }

  return NextResponse.json({ data: execution });
}

function calcNextDate(schedule: any): string | null {
  if (!schedule.next_date) return null;
  const base = new Date(schedule.next_date + "T00:00:00");
  const INTERVALS: Record<string, number> = {
    DIARIO: 1, SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30,
    TRIMESTRAL: 90, SEMESTRAL: 180, ANUAL: 365,
  };
  if (schedule.schedule_type === "FECHA_FIJA") return null;
  if (schedule.schedule_type === "PERSONALIZADO" && schedule.interval_days) {
    base.setDate(base.getDate() + Number(schedule.interval_days));
  } else {
    const days = INTERVALS[schedule.schedule_type];
    if (!days) return null;
    base.setDate(base.getDate() + days);
  }
  return base.toISOString().split("T")[0];
}
