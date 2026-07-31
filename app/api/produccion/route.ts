import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID = ["EN_PRODUCCION", "PARCIAL", "LIBRE"];

// GET /api/produccion?week=YYYY-MM-DD  → filas de esa semana
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const week = new URL(request.url).searchParams.get("week");
  if (!week) return NextResponse.json({ error: "Semana requerida" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("production_plan").select("*").eq("week_start", week);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/produccion  → upsert del plan de un sector para una semana
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin_sistema") {
    return NextResponse.json({ error: "Solo administrador de sistema" }, { status: 403 });
  }

  const { week_start, sector_id, days, note } = await request.json();
  if (!week_start || !sector_id || !Array.isArray(days) || days.length !== 7) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const clean = days.map((d: string) => (VALID.includes(d) ? d : "LIBRE"));

  const admin = createAdminClient();
  const { error } = await admin.from("production_plan").upsert(
    { week_start, sector_id, days: clean, note: note?.trim() || null, updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "week_start,sector_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
