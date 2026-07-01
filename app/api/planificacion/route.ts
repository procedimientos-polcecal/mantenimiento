import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list plans
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("daily_plans")
    .select("*, created_by_user:created_by(full_name), daily_plan_items(id)")
    .order("fecha", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — create plan
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { fecha, titulo, notas } = await request.json();
  if (!fecha) return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("daily_plans")
    .insert({ fecha, titulo: titulo?.trim() || null, notas: notas?.trim() || null, created_by: user.id })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
