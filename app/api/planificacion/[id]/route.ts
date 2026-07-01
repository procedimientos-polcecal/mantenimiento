import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

// GET — plan + items
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: plan, error } = await admin
    .from("daily_plans")
    .select("*, created_by_user:created_by(full_name), daily_plan_items(*, assigned_user:assigned_to(full_name))")
    .eq("id", id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: plan });
}

// PATCH — update plan header
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const admin = createAdminClient();

  // Add item
  if (body.action === "add_item") {
    const { work_order_id, ot_number, especialidad, sector_raw, equipo_raw,
            descripcion, repuesto, fecha_ejecucion, assigned_to, assigned_name, notas_item } = body;

    const { data: existing } = await admin
      .from("daily_plan_items")
      .select("id").eq("plan_id", id).eq("work_order_id", work_order_id ?? "").maybeSingle();
    if (existing) return NextResponse.json({ error: "Esta OT ya está en el plan" }, { status: 400 });

    const { count } = await admin
      .from("daily_plan_items").select("id", { count: "exact", head: true }).eq("plan_id", id);

    const { data, error } = await admin.from("daily_plan_items").insert({
      plan_id: id, work_order_id, ot_number, especialidad, sector_raw,
      equipo_raw, descripcion, repuesto, fecha_ejecucion: fecha_ejecucion || null,
      assigned_to: assigned_to || null, assigned_name: assigned_name?.trim() || null,
      notas_item: notas_item?.trim() || null, orden: count ?? 0,
    }).select("*, assigned_user:assigned_to(full_name)").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Remove item
  if (body.action === "remove_item") {
    const { item_id } = body;
    await admin.from("daily_plan_items").delete().eq("id", item_id);
    return NextResponse.json({ success: true });
  }

  // Update item (assignment / notes)
  if (body.action === "update_item") {
    const { item_id, assigned_to, assigned_name, notas_item, fecha_ejecucion } = body;
    const { data, error } = await admin.from("daily_plan_items")
      .update({ assigned_to: assigned_to || null, assigned_name: assigned_name?.trim() || null,
                notas_item: notas_item?.trim() || null, fecha_ejecucion: fecha_ejecucion || null })
      .eq("id", item_id).select("*, assigned_user:assigned_to(full_name)").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Update plan header
  const { titulo, notas } = body;
  const { data, error } = await admin.from("daily_plans")
    .update({ titulo: titulo?.trim() || null, notas: notas?.trim() || null })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — delete plan
export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();
  await admin.from("daily_plans").delete().eq("id", id);
  return NextResponse.json({ success: true });
}
